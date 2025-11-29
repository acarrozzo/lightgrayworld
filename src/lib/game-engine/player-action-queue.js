class PlayerActionQueue {
  constructor({ timeoutMs = 5000, maxQueueLength = 5, logger = console } = {}) {
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
    const complete = (handler) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      this.activePlayers.delete(playerId);
      handler();
      this.processNext(playerId);
    };

    const timeoutHandle = setTimeout(() => {
      this.metrics.timedOut += 1;
      const timeoutError = this._createError(
        `Action timed out after ${this.timeoutMs}ms`,
        'ACTION_TIMEOUT'
      );
      this._log('error', '[ActionQueue] Action timed out', {
        playerId,
        actionType: metadata?.actionType,
        timeoutMs: this.timeoutMs,
      });
      complete(() => {
        reject(timeoutError);
      });
    }, this.timeoutMs);

    Promise.resolve()
      .then(() => actionFn())
      .then((result) => {
        const duration = Date.now() - startedAt;
        this._recordDuration(duration);
        this.metrics.completed += 1;
        this._log('info', '[ActionQueue] Action completed', {
          playerId,
          actionType: metadata?.actionType,
          durationMs: duration,
        });

        complete(() => resolve(result));
      })
      .catch((error) => {
        const duration = Date.now() - startedAt;
        this._recordDuration(duration);
        this._log('error', '[ActionQueue] Action failed', {
          playerId,
          actionType: metadata?.actionType,
          error: error?.message,
        });

        complete(() => reject(error));
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
};

