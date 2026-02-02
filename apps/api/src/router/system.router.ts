import { z } from "zod";
import { router, adminProcedure, publicProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const systemRouter = router({
  /**
   * Public liveness probe for the web UI.
   * Used to determine whether the API is reachable before auth is established.
   */
  ping: publicProcedure.query(async () => {
    return {
      ok: true,
      timestamp: new Date(),
    };
  }),

  health: adminProcedure.query(async ({ ctx }) => {
    try {
      const [deviceCount, siteCount, activeAlerts, recentEvents] = await Promise.all([
        ctx.prisma.device.count({
          where: { organizationId: ctx.organizationId },
        }),
        ctx.prisma.site.count({
          where: { organizationId: ctx.organizationId },
        }),
        ctx.prisma.alert.count({
          where: {
            organizationId: ctx.organizationId,
            status: "active",
          },
        }),
        ctx.prisma.detectionEvent.count({
          where: {
            organizationId: ctx.organizationId,
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
      ]);

      return {
        deviceCount,
        siteCount,
        activeAlerts,
        recentEvents,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error("Error fetching system health", error, {
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch system health",
      });
    }
  }),

  auditLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const items = await ctx.prisma.auditLog.findMany({
          where: {
            organizationId: ctx.organizationId,
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
        logger.error("Error fetching audit logs", error, {
          organizationId: ctx.organizationId,
          limit: input.limit,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch audit logs",
        });
      }
    }),
});
