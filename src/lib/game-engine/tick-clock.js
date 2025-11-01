const DEFAULT_TICK_MS = 100;

class TickClock {
  constructor(tickMs = DEFAULT_TICK_MS) {
    this.tickMs = tickMs;
    this.epoch = Date.now();
    this.running = false;
    this.timer = null;
    this.currentTickId = 0;
    this.nextTickTimestamp = this.epoch + this.tickMs;

    this.tickDurations = [];
    this.maxSamples = 1000;
  }

  start(onTick) {
    if (this.running) return;

    this.running = true;
    this.scheduleNextTick(onTick);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getCurrentTick() {
    return this.currentTickId;
  }

  getMetrics() {
    const samples = this.tickDurations.slice(-100);
    const avg = samples.length === 0
      ? 0
      : samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const p95 = this.calculatePercentile(samples, 0.95);
    const max = samples.length === 0 ? 0 : Math.max(...samples);

    return {
      currentTick: this.currentTickId,
      running: this.running,
      avgTickTime: avg,
      p95TickTime: p95,
      maxTickTime: max,
    };
  }

  scheduleNextTick(onTick) {
    if (!this.running) return;

    const now = Date.now();
    const delay = Math.max(0, this.nextTickTimestamp - now);

    this.timer = setTimeout(async () => {
      const tickStart = Date.now();
      this.currentTickId = Math.floor((tickStart - this.epoch) / this.tickMs);

      try {
        await onTick(this.currentTickId);
      } catch (error) {
        console.error(`[TickClock] Tick ${this.currentTickId} handler error`, error);
      }

      const duration = Date.now() - tickStart;
      this.recordDuration(duration);

      const expectedNext = this.epoch + (this.currentTickId + 1) * this.tickMs;
      this.nextTickTimestamp = Math.max(expectedNext, Date.now());

      if (duration > this.tickMs * 0.8) {
        console.warn(`[TickClock] Tick ${this.currentTickId} consumed ${duration}ms`);
      }

      this.scheduleNextTick(onTick);
    }, delay);
  }

  recordDuration(duration) {
    this.tickDurations.push(duration);
    if (this.tickDurations.length > this.maxSamples) {
      this.tickDurations.shift();
    }
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
    return sorted[index];
  }
}

module.exports = {
  TickClock,
  DEFAULT_TICK_MS,
};
