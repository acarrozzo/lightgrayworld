const WORLD_TICK_MS = 3600000; // 1 hour (UTC-aligned)




class TickClock {
  constructor(tickMs = WORLD_TICK_MS) {
    this.tickMs = tickMs;
    this.running = false;
    this.timer = null;

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

  /**
   * Get current tick ID from wall-clock time (stateless, UTC-aligned).
   * Single source of truth for tick IDs.
   */
  getCurrentTickId() {
    return Math.floor(Date.now() / this.tickMs);
  }

  /**
   * Get next tick timestamp, derived deterministically from current tickId.
   */
  getNextTickTimestamp() {
    const tickId = this.getCurrentTickId();
    return (tickId + 1) * this.tickMs;
  }

  /**
   * Backward compatibility method - calls getCurrentTickId().
   */
  getCurrentTick() {
    return this.getCurrentTickId();
  }

  getMetrics() {
    const samples = this.tickDurations.slice(-100);
    const avg = samples.length === 0
      ? 0
      : samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const p95 = this.calculatePercentile(samples, 0.95);
    const max = samples.length === 0 ? 0 : Math.max(...samples);

    return {
      currentTick: this.getCurrentTickId(),
      running: this.running,
      avgTickTime: avg,
      p95TickTime: p95,
      maxTickTime: max,
    };
  }

  scheduleNextTick(onTick) {
    if (!this.running) return;

    const now = Date.now();
    // Calculate next UTC hour boundary (absolute time, not relative)
    const nextTickAt = Math.ceil(now / this.tickMs) * this.tickMs;
    const delay = Math.max(0, nextTickAt - now);

    this.timer = setTimeout(async () => {
      const tickStart = Date.now();
      
      // CRITICAL: Compute tickId from the scheduled boundary time, not Date.now()
      // This guarantees the tick event is exactly aligned to the boundary you intended
      const tickId = Math.floor(nextTickAt / this.tickMs);

      try {
        await onTick(tickId);
      } catch (error) {
        console.error(`[TickClock] Tick ${tickId} handler error`, error);
      }

      const duration = Date.now() - tickStart;
      this.recordDuration(duration);

      if (duration > this.tickMs * 0.8) {
        console.warn(`[TickClock] Tick ${tickId} consumed ${duration}ms`);
      }

      // Schedule next tick at absolute boundary (avoid drift)
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
  WORLD_TICK_MS,
};
