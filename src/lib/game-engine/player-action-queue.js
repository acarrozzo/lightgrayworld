class PlayerActionQueue {
  constructor({ timeoutMs = 5000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.queues = new Map(); // playerId -> task array
    this.activePlayers = new Set(); // playerIds currently executing
  }

  async enqueueAction(playerId, actionFn) {
    if (!playerId || typeof actionFn !== 'function') {
      throw new Error('enqueueAction requires a playerId and an action function');
    }

    return new Promise((resolve, reject) => {
      const task = { actionFn, resolve, reject };

      if (!this.queues.has(playerId)) {
        this.queues.set(playerId, []);
      }

      this.queues.get(playerId).push(task);
      this.processNext(playerId);
    });
  }

  isPlayerBusy(playerId) {
    return this.activePlayers.has(playerId);
  }

  clearPlayer(playerId, { rejectPending = false } = {}) {
    if (rejectPending && this.queues.has(playerId)) {
      const pendingTasks = this.queues.get(playerId);
      pendingTasks.forEach((task) => {
        task.reject(new Error('Action cancelled'));
      });
    }

    this.queues.delete(playerId);
    this.activePlayers.delete(playerId);
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

    const { actionFn, resolve, reject } = queue.shift();
    this.activePlayers.add(playerId);

    const timeoutHandle = setTimeout(() => {
      this.activePlayers.delete(playerId);
      reject(new Error('Action timed out'));
      this.processNext(playerId);
    }, this.timeoutMs);

    const finalize = () => {
      clearTimeout(timeoutHandle);
      this.activePlayers.delete(playerId);
      this.processNext(playerId);
    };

    Promise.resolve()
      .then(() => actionFn())
      .then((result) => {
        resolve(result);
        finalize();
      })
      .catch((error) => {
        reject(error);
        finalize();
      });
  }
}

module.exports = {
  PlayerActionQueue,
};

