import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrelationInput {
  siteId: string;
  organizationId: string;
  type: string;           // detection type used as a proxy for alert title/type matching
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Haversine distance helper (returns distance in metres)
// ---------------------------------------------------------------------------

function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// AlertCorrelator
// ---------------------------------------------------------------------------

/**
 * Deduplicates and correlates incoming alerts against open alerts in the DB.
 *
 * Correlation rules (applied in order):
 *  1. Same organisation + same site + same detection type within the last 30 minutes.
 *  2. If coordinates are provided, the existing alert must also have coordinates
 *     stored in its metadata AND be within a 500 m radius.
 *  3. If a match is found the correlationCount on the existing alert's metadata
 *     is incremented and the existing alert's ID is returned (merge signal).
 *  4. If no match, return null → caller should create a new alert.
 *
 * Suppression rules:
 *  Suppression is stored as a JSON array in a well-known AuditLog record
 *  (resourceType = "alert_suppression") belonging to the organisation.
 *  Each entry: { siteId?, alertType?, startsAt, endsAt }
 */
export class AlertCorrelator {
  private readonly correlationWindowMs = 30 * 60 * 1000; // 30 minutes
  private readonly radiusMetres        = 500;

  // -------------------------------------------------------------------------
  // correlate
  // -------------------------------------------------------------------------

  async correlate(newAlert: CorrelationInput): Promise<string | null> {
    try {
      const windowStart = new Date(newAlert.timestamp.getTime() - this.correlationWindowMs);

      // Fetch open alerts for the same organisation/site/type in the window
      const candidates = await prisma.alert.findMany({
        where: {
          organizationId: newAlert.organizationId,
          siteId:         newAlert.siteId,
          status:         { in: ["active", "acknowledged"] },
          createdAt:      { gte: windowStart },
          // Match on alert title containing the detection type (best-effort)
          title:          { contains: newAlert.type, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      if (candidates.length === 0) {
        return null;
      }

      // If coordinates are available, filter by proximity
      if (newAlert.latitude != null && newAlert.longitude != null) {
        for (const candidate of candidates) {
          const meta = candidate.metadata as Record<string, unknown> | null;
          const cLat = typeof meta?.latitude  === "number" ? meta.latitude  : null;
          const cLon = typeof meta?.longitude === "number" ? meta.longitude : null;

          if (cLat != null && cLon != null) {
            const dist = haversineMetres(newAlert.latitude, newAlert.longitude, cLat, cLon);
            if (dist <= this.radiusMetres) {
              await this.incrementCorrelationCount(candidate.id, candidate.metadata);
              logger.debug("Alert correlated (geo match)", {
                existingAlertId: candidate.id,
                distanceMetres:  Math.round(dist),
                type:            newAlert.type,
              });
              return candidate.id;
            }
          } else {
            // Existing alert has no coordinates — correlate by time/type window only
            await this.incrementCorrelationCount(candidate.id, candidate.metadata);
            logger.debug("Alert correlated (time/type window, no coords)", {
              existingAlertId: candidate.id,
              type:            newAlert.type,
            });
            return candidate.id;
          }
        }
        // No proximate match found — new alert needed
        return null;
      }

      // No coordinates on new alert — use the most recent candidate
      const best = candidates[0];
      await this.incrementCorrelationCount(best.id, best.metadata);
      logger.debug("Alert correlated (time/type window)", {
        existingAlertId: best.id,
        type:            newAlert.type,
      });
      return best.id;
    } catch (error) {
      logger.error("AlertCorrelator.correlate error", error, {
        siteId:         newAlert.siteId,
        organizationId: newAlert.organizationId,
        type:           newAlert.type,
      });
      // On error, return null so a new alert is created rather than silently dropping
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // shouldSuppress
  // -------------------------------------------------------------------------

  /**
   * Check whether the incoming alert should be suppressed based on active
   * suppression rules stored in the DB.
   *
   * Suppression rules are stored as an AuditLog row with:
   *   resourceType = "alert_suppression"
   *   organizationId = <org>
   *   changes = [ { siteId?, alertType?, startsAt, endsAt } ]
   */
  async shouldSuppress(alert: CorrelationInput): Promise<boolean> {
    try {
      const now = alert.timestamp;

      const suppressionLogs = await prisma.auditLog.findMany({
        where: {
          organizationId: alert.organizationId,
          resourceType:   "alert_suppression",
          // Only fetch logs that could be active (rough range check via createdAt)
          createdAt:      { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      for (const log of suppressionLogs) {
        const rules = log.changes as Array<{
          siteId?:    string;
          alertType?: string;
          startsAt:   string;
          endsAt:     string;
        }> | null;

        if (!Array.isArray(rules)) continue;

        for (const rule of rules) {
          const starts = new Date(rule.startsAt);
          const ends   = new Date(rule.endsAt);

          if (now < starts || now > ends) continue; // not in active window

          // Check site match (omit = all sites)
          if (rule.siteId && rule.siteId !== alert.siteId) continue;

          // Check alert type match (omit = all types)
          if (rule.alertType && !alert.type.toLowerCase().includes(rule.alertType.toLowerCase())) continue;

          logger.info("Alert suppressed by rule", {
            siteId:         alert.siteId,
            organizationId: alert.organizationId,
            type:           alert.type,
            rule,
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error("AlertCorrelator.shouldSuppress error", error, {
        siteId:         alert.siteId,
        organizationId: alert.organizationId,
      });
      // On error, default to NOT suppressing so alerts are never silently lost
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async incrementCorrelationCount(
    alertId: string,
    currentMetadata: unknown
  ): Promise<void> {
    const meta = (currentMetadata as Record<string, unknown>) ?? {};
    const currentCount = typeof meta.correlationCount === "number" ? meta.correlationCount : 0;

    await prisma.alert.update({
      where: { id: alertId },
      data:  {
        metadata: {
          ...meta,
          correlationCount: currentCount + 1,
          lastCorrelatedAt: new Date().toISOString(),
        },
      },
    });
  }
}

export const alertCorrelator = new AlertCorrelator();
