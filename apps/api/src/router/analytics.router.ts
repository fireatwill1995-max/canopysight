import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  heatmapQuerySchema,
  analyticsTimeRangeSchema,
  occupancyByZoneSchema,
  timeOfDayPressureSchema,
} from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const analyticsRouter = router({
  heatmap: protectedProcedure.input(heatmapQuerySchema).query(async ({ ctx, input }) => {
    try {
      // Get detection events for the time range
      const events = await ctx.prisma.detectionEvent.findMany({
        where: {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
          timestamp: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        select: {
          boundingBox: true,
          timestamp: true,
        },
        orderBy: { timestamp: "desc" },
        take: 10_000,
      });

      // Generate heatmap data points from bounding boxes
      // This is a simplified version - in production, you'd aggregate by grid cells
      const heatmapData = events
        .map((event: { boundingBox: unknown; timestamp: Date }) => {
          try {
            const bbox = event.boundingBox as { x: number; y: number; width: number; height: number };
            if (!bbox || typeof bbox.x !== "number" || typeof bbox.y !== "number") {
              return null;
            }
            return {
              x: bbox.x + (bbox.width || 0) / 2,
              y: bbox.y + (bbox.height || 0) / 2,
              intensity: 1,
              timestamp: event.timestamp,
            };
          } catch {
            return null;
          }
        })
        .filter((point: { x: number; y: number; intensity: number; timestamp: Date } | null): point is { x: number; y: number; intensity: number; timestamp: Date } => point !== null);

      return {
        data: heatmapData,
        resolution: input.resolution,
      };
    } catch (error) {
      logger.error("Error generating heatmap", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate heatmap",
      });
    }
  }),

  trends: protectedProcedure.input(analyticsTimeRangeSchema).query(async ({ ctx, input }) => {
    try {
      const where: {
        organizationId: string;
        timestamp: { gte: Date; lte: Date };
        siteId?: string;
      } = {
        organizationId: ctx.organizationId,
        timestamp: {
          gte: input.startDate,
          lte: input.endDate,
        },
        ...(input.siteId && { siteId: input.siteId }),
      };

      const [totalEvents, byType, byDay] = await Promise.all([
        ctx.prisma.detectionEvent.count({ where }),
        ctx.prisma.detectionEvent.groupBy({
          by: ["type"],
          where,
          _count: true,
        }),
        input.siteId
          ? ctx.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
              SELECT DATE(timestamp) as date, COUNT(*)::bigint as count
              FROM "DetectionEvent"
              WHERE "organizationId" = ${ctx.organizationId}::text
                AND "siteId" = ${input.siteId}::text
                AND timestamp >= ${input.startDate}::timestamp
                AND timestamp <= ${input.endDate}::timestamp
              GROUP BY DATE(timestamp)
              ORDER BY date ASC
            `
          : ctx.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
              SELECT DATE(timestamp) as date, COUNT(*)::bigint as count
              FROM "DetectionEvent"
              WHERE "organizationId" = ${ctx.organizationId}::text
                AND timestamp >= ${input.startDate}::timestamp
                AND timestamp <= ${input.endDate}::timestamp
              GROUP BY DATE(timestamp)
              ORDER BY date ASC
            `,
      ]);

      return {
        totalEvents,
        byType: byType.map((item: { type: string; _count: number }) => ({
          type: item.type,
          count: Number(item._count),
        })),
        byDay: byDay.map((item: { date: Date; count: bigint }) => ({
          date: item.date,
          count: Number(item.count),
        })),
      };
    } catch (error) {
      logger.error("Error fetching trends", error, {
        organizationId: ctx.organizationId,
        siteId: input.siteId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch trends",
      });
    }
  }),

  behavioralPatterns: protectedProcedure.input(analyticsTimeRangeSchema).query(async ({ ctx, input }) => {
    try {
      if (!input.siteId) {
        return {
          patterns: [],
        };
      }

      const where: {
        organizationId: string;
        siteId: string;
        timestamp: { gte: Date; lte: Date };
      } = {
        organizationId: ctx.organizationId,
        siteId: input.siteId,
        timestamp: {
          gte: input.startDate,
          lte: input.endDate,
        },
      };

      // Get detection events for pattern analysis
      const events = await ctx.prisma.detectionEvent.findMany({
        where,
        select: {
          type: true,
          timestamp: true,
          riskScore: true,
          boundingBox: true,
        },
        orderBy: {
          timestamp: "asc",
        },
        take: 10_000,
      });

      // Simple pattern detection - in production, this would use AI/ML
      const patterns: Array<{
        type: string;
        description: string;
        confidence: number;
      }> = [];

      if (events.length === 0) {
        return { patterns: [] };
      }

      // Pattern 1: High frequency detections
      const timeRangeHours = (input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60);
      const eventFrequency = timeRangeHours > 0 ? events.length / timeRangeHours : 0; // events per hour
      if (eventFrequency > 10 && Number.isFinite(eventFrequency)) {
        patterns.push({
          type: "high_frequency",
          description: `High detection frequency: ${eventFrequency.toFixed(1)} events/hour`,
          confidence: Math.min(eventFrequency / 20, 1),
        });
      }

      // Pattern 2: Risk escalation
      const riskScores = events
        .map((e: { riskScore: number | null }) => (typeof e.riskScore === "number" ? e.riskScore : 0))
        .filter((score: number) => score > 0);
      if (riskScores.length > 0) {
        const avgRisk = riskScores.reduce((a: number, b: number) => a + b, 0) / riskScores.length;
        const maxRisk = Math.max(...riskScores);
        if (maxRisk > 70) {
          patterns.push({
            type: "high_risk",
            description: `High risk detections detected. Average: ${avgRisk.toFixed(1)}, Peak: ${maxRisk.toFixed(1)}`,
            confidence: maxRisk / 100,
          });
        }
      }

      // Pattern 3: Time-based clustering
      const timeGroups = new Map<string, number>();
      events.forEach((event: { timestamp: Date }) => {
        const hour = new Date(event.timestamp).getHours();
        const key = `${hour}:00`;
        timeGroups.set(key, (timeGroups.get(key) || 0) + 1);
      });

      const groupSizes = Array.from(timeGroups.values());
      if (groupSizes.length === 0) {
        return { patterns };
      }
      
      const maxGroupSize = Math.max(...groupSizes);
      if (maxGroupSize > events.length * 0.3 && Number.isFinite(maxGroupSize)) {
        const peakHour = Array.from(timeGroups.entries()).find((entry: [string, number]) => entry[1] === maxGroupSize)?.[0];
        patterns.push({
          type: "time_clustering",
          description: `Detections clustered around ${peakHour || "unknown time"}`,
          confidence: events.length > 0 ? Math.min(maxGroupSize / events.length, 1) : 0,
        });
      }

      return {
        patterns,
      };
    } catch (error) {
      logger.error("Error analyzing behavioral patterns", error, {
        siteId: input.siteId,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to analyze behavioral patterns",
      });
    }
  }),

  /** Congestion & flow: occupancy per zone (clustering, pinch points, waiting areas) */
  occupancyByZone: protectedProcedure.input(occupancyByZoneSchema).query(async ({ ctx, input }) => {
    try {
      const events = await ctx.prisma.detectionEvent.findMany({
        where: {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
          timestamp: { gte: input.startDate, lte: input.endDate },
        },
        select: { zoneIds: true, timestamp: true },
        orderBy: { timestamp: "desc" },
        take: 10_000,
      });

      const byZone = new Map<string, { count: number; timestamps: number[] }>();
      events.forEach((e: { zoneIds: string[]; timestamp: Date }) => {
        const ids = Array.isArray(e.zoneIds) ? e.zoneIds : [];
        ids.forEach((zoneId) => {
          if (!byZone.has(zoneId)) byZone.set(zoneId, { count: 0, timestamps: [] });
          const entry = byZone.get(zoneId)!;
          entry.count += 1;
          entry.timestamps.push(e.timestamp.getTime());
        });
      });

      const result = Array.from(byZone.entries()).map(([zoneId, { count, timestamps }]) => ({
        zoneId,
        count,
        maxCount: count,
        avgCount: timestamps.length > 0 ? count : 0,
      }));

      return { byZone: result };
    } catch (error) {
      logger.error("Error fetching occupancy by zone", error, { siteId: input.siteId });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch occupancy by zone",
      });
    }
  }),

  /** Time-of-day pressure patterns (rush hours, out-of-hours, lone worker context) */
  timeOfDayPressure: protectedProcedure.input(timeOfDayPressureSchema).query(async ({ ctx, input }) => {
    try {
      const where: {
        organizationId: string;
        timestamp: { gte: Date; lte: Date };
        siteId?: string;
      } = {
        organizationId: ctx.organizationId,
        timestamp: { gte: input.startDate, lte: input.endDate },
        ...(input.siteId && { siteId: input.siteId }),
      };

      const events = await ctx.prisma.detectionEvent.findMany({
        where,
        select: { timestamp: true },
        orderBy: { timestamp: "desc" },
        take: 50_000,
      });

      const byHour = new Map<number, number>();
      for (let h = 0; h < 24; h++) byHour.set(h, 0);
      events.forEach((e: { timestamp: Date }) => {
        const hour = new Date(e.timestamp).getHours();
        byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
      });

      const result = Array.from(byHour.entries())
        .map(([hour, count]) => ({
          hour,
          count,
          label:
            hour >= 22 || hour < 6
              ? "Out-of-hours"
              : (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)
                ? "Peak"
                : "Normal",
        }))
        .sort((a, b) => a.hour - b.hour);

      return { byHour: result };
    } catch (error) {
      logger.error("Error fetching time-of-day pressure", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch time-of-day pressure",
      });
    }
  }),
});
