import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

const trackPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  timestamp: z.string(), // ISO date string
  accuracy: z.number().optional(),
});

export const patrolRouter = router({
  // ─── Start a new patrol ───────────────────────────────────────────────────

  startPatrol: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        userId: z.string().optional(),
        rangerName: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.siteId, organizationId: ctx.organizationId },
        });
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const patrol = await ctx.prisma.patrolTrack.create({
          data: {
            organizationId: ctx.organizationId,
            siteId: input.siteId,
            userId: input.userId ?? ctx.userId ?? null,
            rangerName: input.rangerName ?? null,
            notes: input.notes ?? null,
            status: "active",
            trackPoints: [],
            zonesPatrolled: [],
          },
          include: { site: true },
        });

        logger.info("Patrol started", {
          patrolId: patrol.id,
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });

        return patrol;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error starting patrol", error, {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start patrol",
        });
      }
    }),

  // ─── Append GPS track points ──────────────────────────────────────────────

  updateTrack: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        points: z.array(trackPointSchema),
        zonesPatrolled: z.array(z.string()).optional(),
        observationsCount: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.patrolTrack.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            status: "active",
          },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Active patrol not found",
          });
        }

        // Merge new points with existing
        const existingPoints = Array.isArray(existing.trackPoints)
          ? (existing.trackPoints as object[])
          : [];
        const mergedPoints = [...existingPoints, ...input.points];

        // Merge zone IDs
        const existingZones = Array.isArray(existing.zonesPatrolled)
          ? (existing.zonesPatrolled as string[])
          : [];
        const mergedZones = input.zonesPatrolled
          ? Array.from(new Set([...existingZones, ...input.zonesPatrolled]))
          : existingZones;

        const patrol = await ctx.prisma.patrolTrack.update({
          where: { id: input.id },
          data: {
            trackPoints: mergedPoints,
            zonesPatrolled: mergedZones,
            ...(input.observationsCount !== undefined && {
              observationsCount: input.observationsCount,
            }),
          },
          include: { site: true },
        });

        return patrol;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating patrol track", error, {
          patrolId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update patrol track",
        });
      }
    }),

  // ─── End a patrol ─────────────────────────────────────────────────────────

  endPatrol: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["completed", "abandoned"]).default("completed"),
        distanceKm: z.number().min(0).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.patrolTrack.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            status: "active",
          },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Active patrol not found",
          });
        }

        const now = new Date();
        const durationMinutes = Math.round(
          (now.getTime() - existing.startedAt.getTime()) / 60000
        );

        const patrol = await ctx.prisma.patrolTrack.update({
          where: { id: input.id },
          data: {
            status: input.status,
            endedAt: now,
            durationMinutes,
            ...(input.distanceKm !== undefined && { distanceKm: input.distanceKm }),
            ...(input.notes && { notes: input.notes }),
          },
          include: { site: true },
        });

        logger.info("Patrol ended", {
          patrolId: input.id,
          status: input.status,
          durationMinutes,
          organizationId: ctx.organizationId,
        });

        return patrol;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error ending patrol", error, {
          patrolId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to end patrol",
        });
      }
    }),

  // ─── List patrols ─────────────────────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        userId: z.string().optional(),
        status: z.enum(["active", "completed", "abandoned"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const items = await ctx.prisma.patrolTrack.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
            ...(input.userId && { userId: input.userId }),
            ...(input.status && { status: input.status }),
          },
          include: { site: true },
          orderBy: { startedAt: "desc" },
          take: input.limit + 1,
          ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        });

        let nextCursor: string | undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return { items, nextCursor };
      } catch (error) {
        logger.error("Error fetching patrols", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch patrols",
        });
      }
    }),

  // ─── Get patrol by ID ─────────────────────────────────────────────────────

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const patrol = await ctx.prisma.patrolTrack.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          include: { site: true },
        });

        if (!patrol) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Patrol not found" });
        }

        return patrol;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching patrol", error, {
          patrolId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch patrol",
        });
      }
    }),

  // ─── Patrol coverage stats for a site ────────────────────────────────────

  getCoverageStats: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        fromDate: z.string().optional(), // ISO date string
        toDate: z.string().optional(),   // ISO date string
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.siteId, organizationId: ctx.organizationId },
        });
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const dateFilter = {
          ...(input.fromDate && { gte: new Date(input.fromDate) }),
          ...(input.toDate && { lte: new Date(input.toDate) }),
        };

        const patrols = await ctx.prisma.patrolTrack.findMany({
          where: {
            organizationId: ctx.organizationId,
            siteId: input.siteId,
            status: "completed",
            ...(Object.keys(dateFilter).length > 0 && { startedAt: dateFilter }),
          },
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            distanceKm: true,
            durationMinutes: true,
            zonesPatrolled: true,
            observationsCount: true,
            userId: true,
            rangerName: true,
          },
          orderBy: { startedAt: "desc" },
        });

        const totalPatrols = patrols.length;
        const totalDistanceKm = patrols.reduce((sum, p) => sum + (p.distanceKm ?? 0), 0);
        const totalDurationMinutes = patrols.reduce(
          (sum, p) => sum + (p.durationMinutes ?? 0),
          0
        );
        const totalObservations = patrols.reduce(
          (sum, p) => sum + (p.observationsCount ?? 0),
          0
        );

        // Unique zones covered across all patrols
        const allZones = new Set<string>();
        for (const p of patrols) {
          const zones = Array.isArray(p.zonesPatrolled)
            ? (p.zonesPatrolled as string[])
            : [];
          zones.forEach((z) => allZones.add(z));
        }

        return {
          siteId: input.siteId,
          totalPatrols,
          totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
          totalDurationMinutes,
          totalObservations,
          uniqueZonesCovered: allZones.size,
          zoneIds: Array.from(allZones),
          averagePatrolDistanceKm:
            totalPatrols > 0
              ? Math.round((totalDistanceKm / totalPatrols) * 100) / 100
              : 0,
          averagePatrolDurationMinutes:
            totalPatrols > 0 ? Math.round(totalDurationMinutes / totalPatrols) : 0,
          recentPatrols: patrols.slice(0, 5),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching patrol coverage stats", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch patrol coverage stats",
        });
      }
    }),
});
