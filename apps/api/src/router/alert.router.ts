import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createAlertSchema, updateAlertSchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { alertDispatcher } from "../services/alert-dispatcher";
import { alertCorrelator } from "../services/alert-correlator";
import { logger } from "@canopy-sight/config";
import { cacheMiddleware } from "../middleware/cache-middleware";

// ---------------------------------------------------------------------------
// Escalation policy in-memory store
// (In production this could be persisted in a dedicated DB table)
// ---------------------------------------------------------------------------

interface EscalationPolicy {
  siteId: string;
  organizationId: string;
  unacknowledgedAfterMinutes: number;
  escalateTo: string[];
  channels: Array<"sms" | "email" | "push">;
  createdAt: Date;
  updatedAt: Date;
}

// keyed by `${organizationId}:${siteId}`
const escalationPolicies = new Map<string, EscalationPolicy>();

// ---------------------------------------------------------------------------
// Period helper → start Date
// ---------------------------------------------------------------------------

function periodStart(period: "24h" | "7d" | "30d"): Date {
  const ms =
    period === "24h" ? 24 * 60 * 60 * 1000 :
    period === "7d"  ?  7 * 24 * 60 * 60 * 1000 :
                       30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const alertRouter = router({

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  list: protectedProcedure
    .input(
      z.object({
        siteId:   z.string().optional(),
        severity: z.enum(["advisory", "warning", "critical"]).optional(),
        status:   z.enum(["active", "acknowledged", "resolved", "dismissed"]).optional(),
        limit:    z.number().min(1).max(100).default(50),
        cursor:   z.string().optional(),
      })
    )
    .use(cacheMiddleware(30))
    .query(async ({ ctx, input }) => {
      try {
        const where: {
          organizationId: string;
          siteId?:   string;
          severity?: string;
          status?:   string;
        } = {
          organizationId: ctx.organizationId,
          ...(input.siteId   && { siteId:   input.siteId   }),
          ...(input.severity && { severity: input.severity }),
          ...(input.status   && { status:   input.status   }),
        };

        const items = await ctx.prisma.alert.findMany({
          where,
          select: {
            id:            true,
            severity:      true,
            status:        true,
            title:         true,
            message:       true,
            acknowledgedBy: true,
            acknowledgedAt: true,
            resolvedAt:    true,
            metadata:      true,
            createdAt:     true,
            updatedAt:     true,
            site: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            device: {
              select: { id: true, name: true, status: true },
            },
            detectionEvent: {
              select: { id: true, type: true, confidence: true, timestamp: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
          ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        });

        let nextCursor: string | undefined = undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return { items, nextCursor };
      } catch (error) {
        logger.error("Error fetching alerts", error, {
          organizationId: ctx.organizationId,
          filters: { siteId: input.siteId, severity: input.severity, status: input.status },
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch alerts" });
      }
    }),

  // -------------------------------------------------------------------------
  // byId
  // -------------------------------------------------------------------------

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const alert = await ctx.prisma.alert.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          include: {
            site:   true,
            device: true,
            detectionEvent: { include: { videoClip: true } },
          },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        return alert;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching alert", error, {
          alertId:        input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch alert" });
      }
    }),

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  create: protectedProcedure
    .input(createAlertSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.prisma.alert.create({
          data: {
            organizationId:   ctx.organizationId,
            siteId:           input.siteId,
            deviceId:         input.deviceId,
            detectionEventId: input.detectionEventId,
            severity:         input.severity,
            status:           input.status,
            title:            input.title,
            message:          input.message,
            metadata:         input.metadata != null ? (input.metadata as object) : undefined,
          },
          include: { site: true, device: true },
        });

        // Dispatch alert via all channels
        await alertDispatcher.dispatch({
          alertId:        alert.id,
          organizationId: ctx.organizationId,
          severity:       alert.severity as "advisory" | "warning" | "critical",
          title:          alert.title,
          message:        alert.message,
          siteId:         alert.siteId,
          deviceId:       alert.deviceId || undefined,
          timestamp:      alert.createdAt,
        });

        logger.info("Alert created", {
          alertId:        alert.id,
          severity:       alert.severity,
          organizationId: ctx.organizationId,
          siteId:         alert.siteId,
        });

        return alert;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error creating alert", error, {
          organizationId: ctx.organizationId,
          siteId:         input.siteId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create alert" });
      }
    }),

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(updateAlertSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const alert = await ctx.prisma.alert.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        const updated = await ctx.prisma.alert.update({
          where: { id },
          data: {
            status:   data.status,
            severity: data.severity,
            title:    data.title,
            message:  data.message,
            metadata: data.metadata != null ? (data.metadata as object) : undefined,
            ...(data.status === "acknowledged" && ctx.userId && {
              acknowledgedBy: ctx.userId,
              acknowledgedAt: new Date(),
            }),
            ...(data.status === "resolved" && {
              resolvedAt: new Date(),
            }),
          },
        });

        logger.info("Alert updated", { alertId: id, organizationId: ctx.organizationId });
        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating alert", error, {
          alertId:        input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update alert" });
      }
    }),

  // -------------------------------------------------------------------------
  // acknowledge
  // -------------------------------------------------------------------------

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.prisma.alert.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        if (!ctx.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID required to acknowledge alert",
          });
        }

        const acknowledged = await ctx.prisma.alert.update({
          where: { id: input.id },
          data: {
            status:         "acknowledged",
            acknowledgedBy: ctx.userId,
            acknowledgedAt: new Date(),
          },
        });

        logger.info("Alert acknowledged", {
          alertId:        input.id,
          userId:         ctx.userId,
          organizationId: ctx.organizationId,
        });

        return acknowledged;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error acknowledging alert", error, {
          alertId:        input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to acknowledge alert" });
      }
    }),

  // -------------------------------------------------------------------------
  // resolve
  // -------------------------------------------------------------------------

  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.prisma.alert.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        const resolved = await ctx.prisma.alert.update({
          where: { id: input.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });

        logger.info("Alert resolved", { alertId: input.id, organizationId: ctx.organizationId });
        return resolved;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error resolving alert", error, {
          alertId:        input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to resolve alert" });
      }
    }),

  // -------------------------------------------------------------------------
  // bulkAcknowledge
  // -------------------------------------------------------------------------

  bulkAcknowledge: protectedProcedure
    .input(
      z.object({
        alertIds: z.array(z.string()).min(1).max(500),
        note:     z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID required to acknowledge alerts",
          });
        }

        const result = await ctx.prisma.alert.updateMany({
          where: {
            id:             { in: input.alertIds },
            organizationId: ctx.organizationId,
            // Only acknowledge alerts that are currently active
            status: "active",
          },
          data: {
            status:         "acknowledged",
            acknowledgedAt: new Date(),
            acknowledgedBy: ctx.userId,
          },
        });

        logger.info("Bulk alerts acknowledged", {
          count:          result.count,
          userId:         ctx.userId,
          organizationId: ctx.organizationId,
          note:           input.note,
        });

        return { count: result.count };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error bulk acknowledging alerts", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to bulk acknowledge alerts" });
      }
    }),

  // -------------------------------------------------------------------------
  // bulkResolve
  // -------------------------------------------------------------------------

  bulkResolve: protectedProcedure
    .input(
      z.object({
        alertIds:   z.array(z.string()).min(1).max(500),
        resolution: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.prisma.alert.updateMany({
          where: {
            id:             { in: input.alertIds },
            organizationId: ctx.organizationId,
            // Only resolve alerts that are active or acknowledged
            status: { in: ["active", "acknowledged"] },
          },
          data: {
            status:     "resolved",
            resolvedAt: new Date(),
            // Store optional resolution note in metadata via a raw update below
          },
        });

        // If a resolution note was provided, persist it per-alert
        if (input.resolution) {
          // updateMany doesn't support JSON field merge; do it in a transaction
          const alerts = await ctx.prisma.alert.findMany({
            where: {
              id:             { in: input.alertIds },
              organizationId: ctx.organizationId,
            },
            select: { id: true, metadata: true },
          });

          await ctx.prisma.$transaction(
            alerts.map((a) =>
              ctx.prisma.alert.update({
                where: { id: a.id },
                data: {
                  metadata: {
                    ...((a.metadata as Record<string, unknown>) ?? {}),
                    resolutionNote: input.resolution,
                  },
                },
              })
            )
          );
        }

        logger.info("Bulk alerts resolved", {
          count:          result.count,
          organizationId: ctx.organizationId,
        });

        return { count: result.count };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error bulk resolving alerts", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to bulk resolve alerts" });
      }
    }),

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  getStats: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        period: z.enum(["24h", "7d", "30d"]).default("24h"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const since = periodStart(input.period);

        const where = {
          organizationId: ctx.organizationId,
          createdAt:      { gte: since },
          ...(input.siteId && { siteId: input.siteId }),
        };

        const alerts = await ctx.prisma.alert.findMany({
          where,
          select: {
            status:         true,
            severity:       true,
            createdAt:      true,
            acknowledgedAt: true,
            resolvedAt:     true,
            metadata:       true,
          },
        });

        // Totals
        const total = alerts.length;

        // By status
        const byStatus: Record<string, number> = {};
        for (const a of alerts) {
          byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
        }

        // By severity
        const bySeverity: Record<string, number> = {};
        for (const a of alerts) {
          bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
        }

        // Average response time (acknowledged or resolved)
        const responseTimes: number[] = [];
        for (const a of alerts) {
          const responseTime = a.acknowledgedAt ?? a.resolvedAt;
          if (responseTime) {
            const mins = (responseTime.getTime() - a.createdAt.getTime()) / 60_000;
            if (mins >= 0) responseTimes.push(mins);
          }
        }
        const avgResponseTimeMinutes =
          responseTimes.length > 0
            ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
            : null;

        // False positive rate: alerts marked "dismissed" / total
        const dismissed = byStatus["dismissed"] ?? 0;
        const falsePositiveRate = total > 0 ? dismissed / total : 0;

        // Escalation count (stored in metadata.escalated)
        const escalatedCount = alerts.filter((a) => {
          const meta = a.metadata as Record<string, unknown> | null;
          return meta?.escalated === true;
        }).length;

        // Correlation count (duplicate detections merged)
        const correlatedCount = alerts.filter((a) => {
          const meta = a.metadata as Record<string, unknown> | null;
          return typeof meta?.correlationCount === "number" && (meta.correlationCount as number) > 0;
        }).length;

        return {
          period:                  input.period,
          total,
          byStatus,
          bySeverity,
          avgResponseTimeMinutes:  avgResponseTimeMinutes !== null
            ? Math.round(avgResponseTimeMinutes * 10) / 10
            : null,
          falsePositiveRate:       Math.round(falsePositiveRate * 1000) / 1000,
          escalatedCount,
          correlatedCount,
        };
      } catch (error) {
        logger.error("Error fetching alert stats", error, {
          organizationId: ctx.organizationId,
          siteId:         input.siteId,
          period:         input.period,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch alert statistics" });
      }
    }),

  // -------------------------------------------------------------------------
  // escalate — manually escalate an alert to the next tier
  // -------------------------------------------------------------------------

  escalate: protectedProcedure
    .input(
      z.object({
        alertId: z.string(),
        reason:  z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.prisma.alert.findFirst({
          where: { id: input.alertId, organizationId: ctx.organizationId },
          include: { site: true },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        // Determine next severity tier
        const severityChain: Array<"advisory" | "warning" | "critical"> = [
          "advisory", "warning", "critical",
        ];
        const currentIndex = severityChain.indexOf(
          alert.severity as "advisory" | "warning" | "critical"
        );
        const nextSeverity  = severityChain[Math.min(currentIndex + 1, severityChain.length - 1)];
        const alreadyMaxed  = currentIndex >= severityChain.length - 1;

        const escalationMeta = {
          ...((alert.metadata as Record<string, unknown>) ?? {}),
          escalated:         true,
          escalatedAt:       new Date().toISOString(),
          escalatedBy:       ctx.userId,
          escalationReason:  input.reason ?? null,
          previousSeverity:  alert.severity,
        };

        const updated = await ctx.prisma.alert.update({
          where: { id: input.alertId },
          data: {
            severity: nextSeverity,
            metadata: escalationMeta,
          },
        });

        // Look up escalation policy for this site
        const policyKey = `${ctx.organizationId}:${alert.siteId}`;
        const policy    = escalationPolicies.get(policyKey);

        // Re-dispatch with elevated severity so notification channels fire
        if (policy && policy.escalateTo.length > 0) {
          for (const channel of policy.channels) {
            // Retrieve matching NotificationPreferences for the escalation targets
            const prefs = await ctx.prisma.notificationPreference.findMany({
              where: {
                organizationId: ctx.organizationId,
                isActive:       true,
                channel,
                OR: [
                  { userId: { in: policy.escalateTo } },
                  // "all_supervisors" sentinel: match users with no specific userId filter
                  ...(policy.escalateTo.includes("all_supervisors")
                    ? [{ userId: null }]
                    : []),
                ],
              },
            });

            if (prefs.length === 0) {
              logger.warn("No notification preferences found for escalation targets", {
                channel,
                escalateTo: policy.escalateTo,
                alertId:    input.alertId,
              });
            }

            for (const pref of prefs) {
              await alertDispatcher
                .dispatch({
                  alertId:        alert.id,
                  organizationId: ctx.organizationId,
                  severity:       nextSeverity,
                  title:          `[ESCALATED] ${alert.title}`,
                  message:        input.reason
                    ? `${alert.message}\n\nEscalation reason: ${input.reason}`
                    : alert.message,
                  siteId:         alert.siteId,
                  deviceId:       alert.deviceId ?? undefined,
                  timestamp:      new Date(),
                })
                .catch((dispatchErr) => {
                  logger.error("Escalation dispatch error", dispatchErr, {
                    alertId: input.alertId,
                    channel,
                    prefId:  pref.id,
                  });
                });
            }
          }
        } else {
          // No policy — still re-dispatch so WebSocket + existing prefs get the updated severity
          await alertDispatcher.dispatch({
            alertId:        alert.id,
            organizationId: ctx.organizationId,
            severity:       nextSeverity,
            title:          `[ESCALATED] ${alert.title}`,
            message:        input.reason
              ? `${alert.message}\n\nEscalation reason: ${input.reason}`
              : alert.message,
            siteId:         alert.siteId,
            deviceId:       alert.deviceId ?? undefined,
            timestamp:      new Date(),
          });
        }

        logger.info("Alert escalated", {
          alertId:          input.alertId,
          previousSeverity: alert.severity,
          newSeverity:      nextSeverity,
          alreadyAtMax:     alreadyMaxed,
          escalatedBy:      ctx.userId,
          organizationId:   ctx.organizationId,
        });

        return {
          alert:           updated,
          previousSeverity: alert.severity as string,
          newSeverity:      nextSeverity as string,
          alreadyAtMax:     alreadyMaxed,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error escalating alert", error, {
          alertId:        input.alertId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to escalate alert" });
      }
    }),

  // -------------------------------------------------------------------------
  // setEscalationPolicy — configure auto-escalation for a site
  // -------------------------------------------------------------------------

  setEscalationPolicy: protectedProcedure
    .input(
      z.object({
        siteId:                     z.string(),
        unacknowledgedAfterMinutes: z.number().min(1).max(1440).default(15),
        escalateTo:                 z.array(z.string()).min(1),
        channels:                   z.array(z.enum(["sms", "email", "push"])).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify the site belongs to the organisation
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.siteId, organizationId: ctx.organizationId },
        });

        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const policyKey = `${ctx.organizationId}:${input.siteId}`;
        const existing  = escalationPolicies.get(policyKey);

        const policy: EscalationPolicy = {
          siteId:                     input.siteId,
          organizationId:             ctx.organizationId,
          unacknowledgedAfterMinutes: input.unacknowledgedAfterMinutes,
          escalateTo:                 input.escalateTo,
          channels:                   input.channels,
          createdAt:                  existing?.createdAt ?? new Date(),
          updatedAt:                  new Date(),
        };

        escalationPolicies.set(policyKey, policy);

        // Persist the policy as an AuditLog entry for durability across restarts
        await ctx.prisma.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            userId:         ctx.userId,
            action:         "update",
            resourceType:   "escalation_policy",
            resourceId:     input.siteId,
            changes:        policy as unknown as object,
          },
        });

        logger.info("Escalation policy set", {
          siteId:                     input.siteId,
          organizationId:             ctx.organizationId,
          unacknowledgedAfterMinutes: input.unacknowledgedAfterMinutes,
          escalateTo:                 input.escalateTo,
          channels:                   input.channels,
        });

        return { success: true, policy };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error setting escalation policy", error, {
          siteId:         input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set escalation policy" });
      }
    }),

  // -------------------------------------------------------------------------
  // getEscalationPolicy — retrieve the current policy for a site
  // -------------------------------------------------------------------------

  getEscalationPolicy: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const policyKey = `${ctx.organizationId}:${input.siteId}`;
      const policy    = escalationPolicies.get(policyKey);

      if (!policy) {
        // Attempt to reload from the latest AuditLog entry
        const log = await ctx.prisma.auditLog.findFirst({
          where: {
            organizationId: ctx.organizationId,
            resourceType:   "escalation_policy",
            resourceId:     input.siteId,
          },
          orderBy: { createdAt: "desc" },
        });

        if (log?.changes) {
          const restored = log.changes as unknown as EscalationPolicy;
          escalationPolicies.set(policyKey, restored);
          return restored;
        }

        return null;
      }

      return policy;
    }),

  // -------------------------------------------------------------------------
  // correlate — check if a new alert should be merged with an existing one
  // -------------------------------------------------------------------------

  correlate: protectedProcedure
    .input(
      z.object({
        siteId:    z.string(),
        type:      z.string(),
        latitude:  z.number().optional(),
        longitude: z.number().optional(),
        deviceId:  z.string().optional(),
        timestamp: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingAlertId = await alertCorrelator.correlate({
        siteId:         input.siteId,
        organizationId: ctx.organizationId,
        type:           input.type,
        latitude:       input.latitude,
        longitude:      input.longitude,
        deviceId:       input.deviceId,
        timestamp:      input.timestamp ?? new Date(),
      });

      return { existingAlertId };
    }),
});
