import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createAlertSchema, updateAlertSchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { alertDispatcher } from "../services/alert-dispatcher";
import { logger } from "@canopy-sight/config";
import { cacheMiddleware, cacheInvalidation } from "../middleware/cache-middleware";

export const alertRouter = router({
  list: protectedProcedure
    .use(cacheMiddleware(30)) // Cache for 30 seconds (alerts change frequently)
    .input(
      z.object({
        siteId: z.string().optional(),
        severity: z.enum(["advisory", "warning", "critical"]).optional(),
        status: z.enum(["active", "acknowledged", "resolved", "dismissed"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: {
          organizationId: string;
          siteId?: string;
          severity?: string;
          status?: string;
        } = {
          organizationId: ctx.organizationId,
          ...(input.siteId && { siteId: input.siteId }),
          ...(input.severity && { severity: input.severity }),
          ...(input.status && { status: input.status }),
        };

        // Optimize query: only select needed fields
        const items = await ctx.prisma.alert.findMany({
          where,
          select: {
            id: true,
            severity: true,
            status: true,
            title: true,
            message: true,
            acknowledgedBy: true,
            acknowledgedAt: true,
            resolvedAt: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
            site: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
              },
            },
            device: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
            detectionEvent: {
              select: {
                id: true,
                type: true,
                confidence: true,
                timestamp: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
          ...(input.cursor && {
            cursor: { id: input.cursor },
            skip: 1,
          }),
        });

        let nextCursor: string | undefined = undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return {
          items,
          nextCursor,
        };
      } catch (error) {
        logger.error("Error fetching alerts", error, {
          organizationId: ctx.organizationId,
          filters: { siteId: input.siteId, severity: input.severity, status: input.status },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch alerts",
        });
      }
    }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const alert = await ctx.prisma.alert.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          site: true,
          device: true,
          detectionEvent: {
            include: {
              videoClip: true,
            },
          },
        },
      });

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error fetching alert", error, {
        alertId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch alert",
      });
    }
  }),

  create: protectedProcedure.input(createAlertSchema).mutation(async ({ ctx, input }) => {
    try {
      const alert = await ctx.prisma.alert.create({
        data: {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
          deviceId: input.deviceId,
          detectionEventId: input.detectionEventId,
          severity: input.severity,
          status: input.status,
          title: input.title,
          message: input.message,
          metadata: input.metadata != null ? (input.metadata as object) : undefined,
        },
        include: {
          site: true,
          device: true,
        },
      });

      // Dispatch alert via all channels
      await alertDispatcher.dispatch({
        alertId: alert.id,
        organizationId: ctx.organizationId,
        severity: alert.severity as "advisory" | "warning" | "critical",
        title: alert.title,
        message: alert.message,
        siteId: alert.siteId,
        deviceId: alert.deviceId || undefined,
        timestamp: alert.createdAt,
      });

      logger.info("Alert created", {
        alertId: alert.id,
        severity: alert.severity,
        organizationId: ctx.organizationId,
        siteId: alert.siteId,
      });

      return alert;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error creating alert", error, {
        organizationId: ctx.organizationId,
        siteId: input.siteId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create alert",
      });
    }
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(updateAlertSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const alert = await ctx.prisma.alert.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        const updated = await ctx.prisma.alert.update({
          where: { id },
          data: {
            // Only allow mutable fields (avoid updating siteId/organizationId)
            status: data.status,
            severity: data.severity,
            title: data.title,
            message: data.message,
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
        
        logger.info("Alert updated", {
          alertId: id,
          organizationId: ctx.organizationId,
        });
        
        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error updating alert", error, {
          alertId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update alert",
        });
      }
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.prisma.alert.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
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
            status: "acknowledged",
            acknowledgedBy: ctx.userId,
            acknowledgedAt: new Date(),
          },
        });
        
        logger.info("Alert acknowledged", {
          alertId: input.id,
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        });
        
        return acknowledged;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error acknowledging alert", error, {
          alertId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to acknowledge alert",
        });
      }
    }),

  resolve: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      const alert = await ctx.prisma.alert.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      const resolved = await ctx.prisma.alert.update({
        where: { id: input.id },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      });
      
      logger.info("Alert resolved", {
        alertId: input.id,
        organizationId: ctx.organizationId,
      });
      
      return resolved;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error resolving alert", error, {
        alertId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to resolve alert",
      });
    }
  }),
});
