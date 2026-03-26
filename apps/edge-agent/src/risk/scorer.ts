import { Detection, TrackedObject, RiskScore, CONSERVATION_TIER } from "../types";
import { SORTTracker } from "../tracking/sort";
import { BehaviorAnalyzer } from "../features/behavior-analyzer";

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

    // Behavior factor — risk delta from classifier (0-50 mapped to 0-100)
    const rawBehaviorDelta = BehaviorAnalyzer.riskDelta(trackedObject?.behavior);
    const behaviorFactor   = Math.min(100, rawBehaviorDelta * 2);

    // Threat factor — weapon / snare / trap / drone detected near person
    const threatFactor = this.calculateThreatFactor(detection);

    // Weighted overall score (weights sum to 1.0)
    const overall =
      speedFactor    * 0.15 +
      directionFactor * 0.15 +
      dwellTimeFactor * 0.15 +
      zoneFactor      * 0.25 +
      timeOfDayFactor * 0.10 +
      behaviorFactor  * 0.10 +
      threatFactor    * 0.10;

    return {
      overall: Math.min(100, Math.max(0, overall)),
      speedFactor,
      directionFactor,
      dwellTimeFactor,
      zoneFactor,
      timeOfDayFactor,
      behaviorFactor,
      threatFactor,
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
    const factor = zoneIds.length * 25;
    return Math.min(100, factor);
  }

  /**
   * Threat factor: direct weapon/snare/trap/drone detection = instant high risk.
   * Also boosts score for critically threatened species near perimeter.
   */
  private calculateThreatFactor(detection: Detection): number {
    // Direct threat objects
    if (["weapon", "snare", "trap", "drone"].includes(detection.type)) return 100;

    // Conservation tier boost — critically endangered species near humans
    const tier = CONSERVATION_TIER[detection.type];
    if (tier === "critical") return 60;
    if (tier === "high")     return 30;

    return 0;
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
