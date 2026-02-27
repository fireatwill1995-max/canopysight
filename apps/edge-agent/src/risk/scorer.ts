import { Detection, TrackedObject, RiskScore } from "../types";
import { SORTTracker } from "../tracking/sort";

/**
 * Risk scoring engine
 * Calculates risk based on multiple factors
 */
export class RiskScorer {
  constructor(_tracker: SORTTracker) {
    // tracker reference reserved for future use (e.g., trajectory prediction)
  }

  /**
   * Calculate risk score for a detection
   */
  calculateRisk(
    detection: Detection,
    trackedObject?: TrackedObject,
    zoneIds: string[] = [],
    timeOfDay: number = new Date().getHours()
  ): RiskScore {
    // Speed factor (0-100)
    const speedFactor = this.calculateSpeedFactor(trackedObject);

    // Direction factor (0-100)
    const directionFactor = this.calculateDirectionFactor(trackedObject, zoneIds);

    // Dwell time factor (0-100)
    const dwellTimeFactor = this.calculateDwellTimeFactor(trackedObject);

    // Zone factor (0-100)
    const zoneFactor = this.calculateZoneFactor(zoneIds);

    // Time of day factor (0-100)
    const timeOfDayFactor = this.calculateTimeOfDayFactor(timeOfDay);

    // Weighted overall score
    const overall =
      speedFactor * 0.2 +
      directionFactor * 0.2 +
      dwellTimeFactor * 0.2 +
      zoneFactor * 0.3 +
      timeOfDayFactor * 0.1;

    return {
      overall: Math.min(100, Math.max(0, overall)),
      speedFactor,
      directionFactor,
      dwellTimeFactor,
      zoneFactor,
      timeOfDayFactor,
    };
  }

  private calculateSpeedFactor(trackedObject?: TrackedObject): number {
    if (!trackedObject?.velocity) return 0;

    const speed = Math.sqrt(
      trackedObject.velocity.x ** 2 + trackedObject.velocity.y ** 2
    );
    // Higher speed = higher risk (normalized to 0-100)
    return Math.min(100, (speed / 10) * 100);
  }

  private calculateDirectionFactor(
    trackedObject?: TrackedObject,
    zoneIds: string[] = []
  ): number {
    if (!trackedObject?.velocity || zoneIds.length === 0) return 50;

    const speed = Math.sqrt(trackedObject.velocity.x ** 2 + trackedObject.velocity.y ** 2);
    if (speed < 0.5) return 50;

    // Scale risk by number of zones breached and object speed
    return Math.min(100, 60 + zoneIds.length * 10);
  }

  private calculateDwellTimeFactor(trackedObject?: TrackedObject): number {
    if (!trackedObject) return 0;

    // Longer dwell time = higher risk
    const minutes = trackedObject.dwellTime / 60;
    return Math.min(100, minutes * 10); // 10 minutes = 100 risk
  }

  private calculateZoneFactor(zoneIds: string[]): number {
    if (zoneIds.length === 0) return 0;

    // More zones breached = higher risk
    // Critical zones (exclusion) have higher weight
    let factor = zoneIds.length * 25;
    return Math.min(100, factor);
  }

  private calculateTimeOfDayFactor(hour: number): number {
    // Higher risk during night hours (22:00 - 6:00)
    if (hour >= 22 || hour < 6) {
      return 80;
    }
    // Medium risk during rush hours (7:00-9:00, 17:00-19:00)
    if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
      return 60;
    }
    // Lower risk during normal hours
    return 40;
  }
}
