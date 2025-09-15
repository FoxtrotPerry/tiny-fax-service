const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 12000; // if no data received within this window, assume dead

export type HeartbeatCallback = (late: boolean) => void;

export class Heartbeat {
  private heartbeatTimer: Timer | null = null;
  private lastDataAt = 0;
  private heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS;
  private heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS;

  /**
   * Start the heartbeat, calling the provided callback at each interval.
   */
  start(callback: HeartbeatCallback) {
    this.stop();
    this.heartbeatTimer = setInterval(() => {
      const late = Date.now() - this.lastDataAt > this.heartbeatTimeoutMs;
      callback(late);
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop the heartbeat.
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Signal that a heartbeat occurred.
   */
  beat() {
    this.lastDataAt = Date.now();
  }
}
