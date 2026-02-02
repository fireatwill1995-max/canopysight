import { TrackedObject } from "../types";

/**
 * Loitering detection for suicide prevention and suspicious behavior
 * Detects when objects remain in restricted areas for extended periods
 */
export interface LoiteringEvent {
  trackId: number;
  zoneId: string;
  duration: number; // seconds
  startTime: Date;
  severity: "low" | "medium" | "high" | "critical";
}

export class LoiteringDetector {
  private loiteringThresholds = {
    low: 30, // 30 seconds
    medium: 60, // 1 minute
    high: 120, // 2 minutes
    critical: 300, // 5 minutes
  };

  /**
   * Detect loitering based on dwell time in zones
   */
  detectLoitering(
    trackedObjects: TrackedObject[],
    zoneId: string,
    currentTime: Date = new Date()
  ): LoiteringEvent[] {
    const events: LoiteringEvent[] = [];

    for (const track of trackedObjects) {
      const dwellTime = track.dwellTime;

      if (dwellTime >= this.loiteringThresholds.critical) {
        events.push({
          trackId: track.id,
          zoneId,
          duration: dwellTime,
          startTime: new Date(currentTime.getTime() - dwellTime * 1000),
          severity: "critical",
        });
      } else if (dwellTime >= this.loiteringThresholds.high) {
        events.push({
          trackId: track.id,
          zoneId,
          duration: dwellTime,
          startTime: new Date(currentTime.getTime() - dwellTime * 1000),
          severity: "high",
        });
      } else if (dwellTime >= this.loiteringThresholds.medium) {
        events.push({
          trackId: track.id,
          zoneId,
          duration: dwellTime,
          startTime: new Date(currentTime.getTime() - dwellTime * 1000),
          severity: "medium",
        });
      } else if (dwellTime >= this.loiteringThresholds.low) {
        events.push({
          trackId: track.id,
          zoneId,
          duration: dwellTime,
          startTime: new Date(currentTime.getTime() - dwellTime * 1000),
          severity: "low",
        });
      }
    }

    return events;
  }

  /**
   * Set custom loitering thresholds
   */
  setThresholds(thresholds: Partial<typeof this.loiteringThresholds>): void {
    this.loiteringThresholds = { ...this.loiteringThresholds, ...thresholds };
  }
}
