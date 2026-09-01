/**
 * How long a single action may run before the caller is answered with a timeout.
 * Exported so the engine and the socket layer's user-facing message cannot drift
 * from it — the message used to quote 5000ms while the engine ran at 15000ms.
 */
const DEFAULT_ACTION_TIMEOUT_MS = 15000;

/**
 * Only these three levels are ever used, so any object providing them works —
 * the engine passes one whose `info` is gated behind a verbosity flag.
 * @typedef {{ info: Function, warn: Function, error: Function }} QueueLogger
 */

class PlayerActionQueue {
  /**
   * @param {Object} [options]
   * @param {number} [options.timeoutMs]
   * @param {number} [options.maxQueueLength]
   * @param {QueueLogger} [options.logger]
   */
  constructor({ timeoutMs = DEFAULT_ACTION_TIMEOUT_MS, maxQueueLength = 5, logger = console } = {}) {
    this.timeoutMs = timeoutMs;
    this.maxQueueLength = maxQueueLength;
    this.logger = logger || console;

    this.queues = new Map(); // playerId -> task array
    this.activePlayers = new Map(); // playerId -> { metadata, startedAt }

    this.metrics = {
      enqueued: 0,
      started: 0,
      completed: 0,
      timedOut: 0,
      rejected: 0,
      cleanupCount: 0,
      duration: {
        totalMs: 0,
        count: 0,
        minMs: Infinity,
        maxMs: 0,
        lastMs: 0,
      },
    };
  }

  async enqueueAction(playerId, actionFn, metadata = {}) {
    if (!playerId || typeof actionFn !== 'function') {
      throw new Error('enqueueAction requires a playerId and an action function');
    }

    return new Promise((resolve, reject) => {
      const task = { actionFn, resolve, reject, metadata };

      if (!this.queues.has(playerId)) {
        this.queues.set(playerId, []);
      }

      const queue = this.queues.get(playerId);
      if (queue.length >= this.maxQueueLength) {
        this.metrics.rejected += 1;
        const error = this._createError(
          'Action queue is full. Please wait for pending actions to complete.',
          'QUEUE_FULL'
        );
        this._log('warn', '[ActionQueue] Action rejected - queue full', {
          playerId,
          actionType: metadata.actionType,
          queueLength: queue.length,
        });
        reject(error);
        return;
      }

      queue.push(task);
      this.metrics.enqueued += 1;
      this._log('info', '[ActionQueue] Action enqueued', {
        playerId,
        actionType: metadata.actionType,
        queueDepth: queue.length,
      });

      this.processNext(playerId);
    });
  }

  isPlayerBusy(playerId) {
    return this.activePlayers.has(playerId);
  }

  clearPlayer(playerId, { rejectPending = false } = {}) {
    const queue = this.queues.get(playerId);
    let rejectedActions = 0;

    if (rejectPending && queue && queue.length > 0) {
      queue.forEach((task) => {
        rejectedActions += 1;
        task.reject(this._createError('Action cancelled', 'PLAYER_CLEARED'));
      });
    }

    if (queue) {
      this.queues.delete(playerId);
    }

    if (this.activePlayers.has(playerId)) {
      this.activePlayers.delete(playerId);
    }

    if (rejectedActions > 0) {
      this.metrics.cleanupCount += 1;
    }

    if (rejectedActions > 0 || queue) {
      this._log('info', '[ActionQueue] Player cleanup', {
        playerId,
        rejectedActions,
      });
    }
  }

  getMetrics() {
    const avgDuration =
      this.metrics.duration.count === 0
        ? 0
        : this.metrics.duration.totalMs / this.metrics.duration.count;

    const queueDepths = {};
    this.queues.forEach((queue, playerId) => {
      queueDepths[playerId] = queue.length;
    });

    return {
      timeoutMs: this.timeoutMs,
      maxQueueLength: this.maxQueueLength,
      enqueued: this.metrics.enqueued,
      started: this.metrics.started,
      completed: this.metrics.completed,
      timedOut: this.metrics.timedOut,
      rejected: this.metrics.rejected,
      cleanupCount: this.metrics.cleanupCount,
      avgDurationMs: avgDuration,
      maxDurationMs: this.metrics.duration.maxMs,
      minDurationMs: this.metrics.duration.minMs === Infinity ? 0 : this.metrics.duration.minMs,
      lastDurationMs: this.metrics.duration.lastMs,
      activePlayers: this.activePlayers.size,
      queueDepths,
    };
  }

  processNext(playerId) {
    if (this.activePlayers.has(playerId)) {
      return;
    }

    const queue = this.queues.get(playerId);
    if (!queue || queue.length === 0) {
      this.queues.delete(playerId);
      return;
    }

    const { actionFn, resolve, reject, metadata } = queue.shift();
    const startedAt = Date.now();
    this.activePlayers.set(playerId, { metadata, startedAt });
    this.metrics.started += 1;

    this._log('info', '[ActionQueue] Action started', {
      playerId,
      actionType: metadata?.actionType,
    });

    let settled = false;
    let timedOut = false;

    // The lane is released only when the action itself settles — never on the
    // timeout. A timeout answers the caller early; it does not mean the work
    // stopped, because an in-flight promise cannot be cancelled.
    const releaseLane = () => {
      clearTimeout(timeoutHandle);
      this.activePlayers.delete(playerId);
      this.processNext(playerId);
    };

    const timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      timedOut = true;
      this.metrics.timedOut += 1;
      this._log('error', '[ActionQueue] Action timed out', {
        playerId,
        actionType: metadata?.actionType,
        timeoutMs: this.timeoutMs,
      });
      // Tell the caller now so the client is not left hanging, but keep holding
      // the player's lane. Freeing it here used to start the next action while
      // the timed-out one was still running and still writing — voiding the
      // serialization this queue exists to provide, at exactly the moment it
      // matters most. Timeouts happen when the database is slow, which is
      // precisely when a player retries; the retry then raced the original.
      reject(
        this._createError(`Action timed out after ${this.timeoutMs}ms`, 'ACTION_TIMEOUT')
      );
    }, this.timeoutMs);

    Promise.resolve()
      .then(() => actionFn())
      .then((result) => {
        settled = true;
        const duration = Date.now() - startedAt;
        this._recordDuration(duration);
        this.metrics.completed += 1;

        if (timedOut) {
          // The caller was already rejected; surfacing the result now would
          // resolve a settled promise. Log it so a chronically slow action is
          // visible rather than silent.
          this._log('warn', '[ActionQueue] Action completed after it had timed out', {
            playerId,
            actionType: metadata?.actionType,
            durationMs: duration,
          });
        } else {
          this._log('info', '[ActionQueue] Action completed', {
            playerId,
            actionType: metadata?.actionType,
            durationMs: duration,
          });
          resolve(result);
        }

        releaseLane();
      })
      .catch((error) => {
        settled = true;
        const duration = Date.now() - startedAt;
        this._recordDuration(duration);
        this._log('error', '[ActionQueue] Action failed', {
          playerId,
          actionType: metadata?.actionType,
          error: error?.message,
          afterTimeout: timedOut,
        });

        if (!timedOut) {
          reject(error);
        }

        releaseLane();
      });
  }

  _recordDuration(durationMs) {
    this.metrics.duration.totalMs += durationMs;
    this.metrics.duration.count += 1;
    this.metrics.duration.lastMs = durationMs;

    if (durationMs < this.metrics.duration.minMs) {
      this.metrics.duration.minMs = durationMs;
    }
    if (durationMs > this.metrics.duration.maxMs) {
      this.metrics.duration.maxMs = durationMs;
    }
  }

  _log(level, message, details) {
    if (!this.logger || typeof this.logger[level] !== 'function') {
      return;
    }
    this.logger[level](message, details || {});
  }

  _createError(message, code) {
    const error = new Error(message);
    if (code) {
      error.code = code;
    }
    return error;
  }
}

module.exports = {
  PlayerActionQueue,
  DEFAULT_ACTION_TIMEOUT_MS,
};

