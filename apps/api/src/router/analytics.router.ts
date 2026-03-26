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
import { generateSafetyReport } from "@canopy-sight/ai";

// IUCN status lookup by detection type keyword
const IUCN_STATUS_MAP: Record<string, { status: string | null; label: string; color: string; weight: number }> = {
  elephant:  { status: "VU", label: "Vulnerable",             color: "#f59e0b", weight: 3 },
  lion:      { status: "VU", label: "Vulnerable",             color: "#f59e0b", weight: 3 },
  rhino:     { status: "CR", label: "Critically Endangered",  color: "#ef4444", weight: 5 },
  leopard:   { status: "VU", label: "Vulnerable",             color: "#f59e0b", weight: 3 },
  cheetah:   { status: "VU", label: "Vulnerable",             color: "#f59e0b", weight: 3 },
  "wild dog":{ status: "EN", label: "Endangered",             color: "#ef4444", weight: 4 },
  gorilla:   { status: "CR", label: "Critically Endangered",  color: "#ef4444", weight: 5 },
  tiger:     { status: "EN", label: "Endangered",             color: "#ef4444", weight: 4 },
  bird:      { status: "LC", label: "Least Concern",          color: "#22c55e", weight: 1 },
  antelope:  { status: "LC", label: "Least Concern",          color: "#22c55e", weight: 1 },
  zebra:     { status: "NT", label: "Near Threatened",        color: "#84cc16", weight: 2 },
  buffalo:   { status: "LC", label: "Least Concern",          color: "#22c55e", weight: 1 },
  hyena:     { status: "LC", label: "Least Concern",          color: "#22c55e", weight: 1 },
  person:    { status: null, label: "Human Activity",         color: "#6b7280", weight: 0 },
  vehicle:   { status: null, label: "Vehicle",                color: "#6b7280", weight: 0 },
  unknown:   { status: null, label: "Unknown",                color: "#9ca3af", weight: 1 },
  animal:    { status: "LC", label: "Wildlife",               color: "#22c55e", weight: 1 },
};

function getIucnInfo(type: string) {
  const lower = type.toLowerCase();
  for (const [key, val] of Object.entries(IUCN_STATUS_MAP)) {
    if (lower.includes(key)) return val;
  }
  return { status: "LC", label: "Wildlife", color: "#22c55e", weight: 1 };
}

export const analyticsRouter = router({
  heatmap: protectedProcedure.input(heatmapQuerySchema).query(async ({ ctx, input }) => {
    try {
      // Paginated via SQL grouping for efficiency – no hard cap
      const limit = Math.min(50_000, Math.max(1, 1000));

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
        take: limit,
      });

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
        .filter(
          (point: { x: number; y: number; intensity: number; timestamp: Date } | null): point is { x: number; y: number; intensity: number; timestamp: Date } =>
            point !== null
        );

      return {
        data: heatmapData,
        resolution: input.resolution,
        total: heatmapData.length,
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
        return { patterns: [] };
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

      const events = await ctx.prisma.detectionEvent.findMany({
        where,
        select: {
          type: true,
          timestamp: true,
          riskScore: true,
          boundingBox: true,
        },
        orderBy: { timestamp: "asc" },
        take: 50_000,
      });

      const patterns: Array<{
        type: string;
        description: string;
        confidence: number;
      }> = [];

      if (events.length === 0) {
        return { patterns: [] };
      }

      const timeRangeHours = (input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60);
      const eventFrequency = timeRangeHours > 0 ? events.length / timeRangeHours : 0;
      if (eventFrequency > 10 && Number.isFinite(eventFrequency)) {
        patterns.push({
          type: "high_frequency",
          description: `High detection frequency: ${eventFrequency.toFixed(1)} events/hour`,
          confidence: Math.min(eventFrequency / 20, 1),
        });
      }

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

      return { patterns };
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
        take: 50_000,
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

  // ── NEW: Species stats grouped by detection type ──────────────────────────
  speciesStats: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const startDate = input.startDate ? new Date(input.startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const endDate   = input.endDate   ? new Date(input.endDate)   : now;

        // This month and last month boundaries for trend calculation
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const baseWhere = {
          organizationId: ctx.organizationId,
          ...(input.siteId && { siteId: input.siteId }),
        };

        const [grouped, thisMonthGrouped, lastMonthGrouped] = await Promise.all([
          // All-time (in range) grouped by type
          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where: { ...baseWhere, timestamp: { gte: startDate, lte: endDate } },
            _count: { type: true },
            _avg:   { confidence: true },
          }),
          // This month grouped by type
          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where: { ...baseWhere, timestamp: { gte: thisMonthStart, lte: endDate } },
            _count: { type: true },
          }),
          // Last month grouped by type
          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where: { ...baseWhere, timestamp: { gte: lastMonthStart, lte: lastMonthEnd } },
            _count: { type: true },
          }),
        ]);

        // Collect first/last seen per type efficiently
        const types = grouped.map((g: { type: string }) => g.type);
        const firstLastSeen: Record<string, { first: Date; last: Date }> = {};

        await Promise.all(
          types.map(async (type) => {
            const [first, last] = await Promise.all([
              ctx.prisma.detectionEvent.findFirst({
                where: { ...baseWhere, type, timestamp: { gte: startDate, lte: endDate } },
                select: { timestamp: true },
                orderBy: { timestamp: "asc" },
              }),
              ctx.prisma.detectionEvent.findFirst({
                where: { ...baseWhere, type, timestamp: { gte: startDate, lte: endDate } },
                select: { timestamp: true },
                orderBy: { timestamp: "desc" },
              }),
            ]);
            firstLastSeen[type] = {
              first: first?.timestamp ?? startDate,
              last:  last?.timestamp ?? endDate,
            };
          })
        );

        const thisMonthMap  = new Map(thisMonthGrouped.map((g: { type: string; _count: { type: number } }) => [g.type, g._count.type]));
        const lastMonthMap  = new Map(lastMonthGrouped.map((g: { type: string; _count: { type: number } }) => [g.type, g._count.type]));

        const species = grouped.map((g: { type: string; _count: { type: number }; _avg: { confidence: number | null } }) => {
          const thisMonth = thisMonthMap.get(g.type) ?? 0;
          const lastMonth = lastMonthMap.get(g.type) ?? 0;
          const trend: "up" | "down" | "stable" =
            lastMonth === 0 ? "stable" :
            thisMonth > lastMonth * 1.1 ? "up" :
            thisMonth < lastMonth * 0.9 ? "down" : "stable";

          const iucn = getIucnInfo(g.type);

          return {
            species:        g.type,
            count:          g._count.type,
            thisMonthCount: thisMonth,
            lastMonthCount: lastMonth,
            trend,
            firstSeen:      firstLastSeen[g.type]?.first ?? startDate,
            lastSeen:       firstLastSeen[g.type]?.last  ?? endDate,
            avgConfidence:  g._avg.confidence ?? 0,
            iucnStatus:     iucn.status,
            iucnLabel:      iucn.label,
            iucnColor:      iucn.color,
          };
        });

        return { species };
      } catch (error) {
        logger.error("Error fetching species stats", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch species stats",
        });
      }
    }),

  // ── NEW: Daily threat trend over N days ──────────────────────────────────
  threatTrend: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const endDate   = new Date();
        const startDate = new Date(endDate.getTime() - input.days * 24 * 60 * 60 * 1000);

        type DailyRow = { date: Date; avg_risk: number | null; alert_count: bigint; detection_count: bigint };

        const rows = input.siteId
          ? await ctx.prisma.$queryRaw<DailyRow[]>`
              SELECT
                DATE(timestamp)              AS date,
                AVG("riskScore")             AS avg_risk,
                COUNT(*) FILTER (WHERE "riskScore" > 70)  AS alert_count,
                COUNT(*)                                   AS detection_count
              FROM "DetectionEvent"
              WHERE "organizationId" = ${ctx.organizationId}::text
                AND "siteId"         = ${input.siteId}::text
                AND timestamp >= ${startDate}::timestamp
                AND timestamp <= ${endDate}::timestamp
              GROUP BY DATE(timestamp)
              ORDER BY date ASC
            `
          : await ctx.prisma.$queryRaw<DailyRow[]>`
              SELECT
                DATE(timestamp)              AS date,
                AVG("riskScore")             AS avg_risk,
                COUNT(*) FILTER (WHERE "riskScore" > 70)  AS alert_count,
                COUNT(*)                                   AS detection_count
              FROM "DetectionEvent"
              WHERE "organizationId" = ${ctx.organizationId}::text
                AND timestamp >= ${startDate}::timestamp
                AND timestamp <= ${endDate}::timestamp
              GROUP BY DATE(timestamp)
              ORDER BY date ASC
            `;

        const trend = rows.map((row) => {
          const avgRisk = row.avg_risk ? Number(row.avg_risk) : 0;
          const threatLevel: "low" | "medium" | "high" | "critical" =
            avgRisk >= 80 ? "critical" :
            avgRisk >= 60 ? "high" :
            avgRisk >= 30 ? "medium" : "low";
          return {
            date:           row.date,
            avgRiskScore:   avgRisk,
            alertCount:     Number(row.alert_count),
            detectionCount: Number(row.detection_count),
            threatLevel,
          };
        });

        return { trend };
      } catch (error) {
        logger.error("Error fetching threat trend", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch threat trend",
        });
      }
    }),

  // ── NEW: Biodiversity index ───────────────────────────────────────────────
  biodiversityIndex: protectedProcedure
    .input(z.object({ siteId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const now          = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const baseWhere = {
          organizationId: ctx.organizationId,
          ...(input.siteId && { siteId: input.siteId }),
        };

        const EXCLUDED = new Set(["person", "vehicle", "unknown"]);

        const [thisMonthGrouped, lastMonthGrouped] = await Promise.all([
          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where: { ...baseWhere, timestamp: { gte: thisMonthStart, lte: now } },
            _count: { type: true },
          }),
          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where: { ...baseWhere, timestamp: { gte: lastMonthStart, lte: lastMonthEnd } },
            _count: { type: true },
          }),
        ]);

        const wildlifeThisMonth = thisMonthGrouped.filter(
          (g: { type: string }) => !EXCLUDED.has(g.type.toLowerCase())
        );
        const wildlifeLastMonth = lastMonthGrouped.filter(
          (g: { type: string }) => !EXCLUDED.has(g.type.toLowerCase())
        );

        const speciesCount = wildlifeThisMonth.length;

        // Weighted score by IUCN status
        let rawScore = 0;
        const topSpecies: Array<{ species: string; count: number; iucnStatus: string | null; iucnColor: string }> = [];

        for (const g of wildlifeThisMonth as Array<{ type: string; _count: { type: number } }>) {
          const info = getIucnInfo(g.type);
          rawScore += info.weight * g._count.type;
          topSpecies.push({
            species:    g.type,
            count:      g._count.type,
            iucnStatus: info.status,
            iucnColor:  info.color,
          });
        }

        topSpecies.sort((a, b) => b.count - a.count);

        // Normalise to 0-100: cap reference at 200 weighted units
        const NORM_REF = 200;
        const score = Math.min(100, Math.round((rawScore / NORM_REF) * 100));
        const grade: "A" | "B" | "C" | "D" =
          score >= 75 ? "A" :
          score >= 50 ? "B" :
          score >= 25 ? "C" : "D";

        const prevScore = wildlifeLastMonth.length > 0
          ? Math.min(100, Math.round(
              (wildlifeLastMonth.reduce((sum: number, g: { type: string; _count: { type: number } }) => {
                return sum + getIucnInfo(g.type).weight * g._count.type;
              }, 0) / NORM_REF) * 100
            ))
          : 0;

        const trendVsPreviousMonth: "up" | "down" | "stable" =
          prevScore === 0 ? "stable" :
          score > prevScore + 2 ? "up" :
          score < prevScore - 2 ? "down" : "stable";

        return {
          score,
          grade,
          speciesCount,
          trendVsPreviousMonth,
          topSpecies: topSpecies.slice(0, 5),
        };
      } catch (error) {
        logger.error("Error computing biodiversity index", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute biodiversity index",
        });
      }
    }),

  // ── NEW: Patrol / monitoring coverage estimate ────────────────────────────
  patrolCoverage: protectedProcedure
    .input(z.object({ siteId: z.string(), date: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const dayStart = new Date(input.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(input.date);
        dayEnd.setHours(23, 59, 59, 999);

        const [allDevices, activeDevices] = await Promise.all([
          ctx.prisma.device.count({
            where: { siteId: input.siteId, organizationId: ctx.organizationId },
          }),
          ctx.prisma.device.count({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              lastHeartbeat: { gte: dayStart, lte: dayEnd },
            },
          }),
        ]);

        // Identify hours with detection activity (proxy for coverage)
        const detections = await ctx.prisma.detectionEvent.findMany({
          where: {
            siteId: input.siteId,
            organizationId: ctx.organizationId,
            timestamp: { gte: dayStart, lte: dayEnd },
          },
          select: { timestamp: true },
        });

        const coveredHours = new Set<number>();
        detections.forEach((d: { timestamp: Date }) => {
          coveredHours.add(new Date(d.timestamp).getHours());
        });

        const coveragePercent =
          allDevices === 0 ? 0 : Math.round((activeDevices / allDevices) * 100);

        const gaps: Array<{ hour: number; label: string }> = [];
        for (let h = 0; h < 24; h++) {
          if (!coveredHours.has(h)) {
            gaps.push({ hour: h, label: `${h.toString().padStart(2, "0")}:00` });
          }
        }

        return {
          coveragePercent,
          activeDevices,
          totalDevices: allDevices,
          coveredHours: coveredHours.size,
          gaps,
        };
      } catch (error) {
        logger.error("Error computing patrol coverage", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute patrol coverage",
        });
      }
    }),

  // ── NEW: Incident hotspots by zone ───────────────────────────────────────
  incidentHotspots: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        days:   z.number().min(1).max(365).default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const endDate   = new Date();
        const startDate = new Date(endDate.getTime() - input.days * 24 * 60 * 60 * 1000);

        const events = await ctx.prisma.detectionEvent.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
            timestamp:  { gte: startDate, lte: endDate },
            riskScore:  { gte: 50 },
          },
          select: { zoneIds: true, timestamp: true, riskScore: true },
          take: 50_000,
        });

        const zoneMap = new Map<string, { count: number; lastIncident: Date; maxRisk: number }>();

        events.forEach((e: { zoneIds: string[]; timestamp: Date; riskScore: number | null }) => {
          const zones = Array.isArray(e.zoneIds) ? e.zoneIds : [];
          if (zones.length === 0) {
            // Group under synthetic "Unzoned" bucket
            zones.push("unzoned");
          }
          zones.forEach((z) => {
            if (!zoneMap.has(z)) {
              zoneMap.set(z, { count: 0, lastIncident: e.timestamp, maxRisk: 0 });
            }
            const entry = zoneMap.get(z)!;
            entry.count += 1;
            if (e.timestamp > entry.lastIncident) entry.lastIncident = e.timestamp;
            if ((e.riskScore ?? 0) > entry.maxRisk) entry.maxRisk = e.riskScore ?? 0;
          });
        });

        const hotspots = Array.from(zoneMap.entries())
          .map(([zone, { count, lastIncident, maxRisk }]) => {
            const riskLevel: "low" | "medium" | "high" | "critical" =
              maxRisk >= 90 ? "critical" :
              maxRisk >= 70 ? "high" :
              maxRisk >= 50 ? "medium" : "low";
            return { zone, incidentCount: count, lastIncident, riskLevel, maxRisk };
          })
          .sort((a, b) => b.incidentCount - a.incidentCount)
          .slice(0, 10);

        return { hotspots };
      } catch (error) {
        logger.error("Error computing incident hotspots", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute incident hotspots",
        });
      }
    }),

  generateReport: protectedProcedure
    .input(occupancyByZoneSchema)
    .mutation(async ({ ctx, input }) => {
      try {
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
            id: true,
            type: true,
            timestamp: true,
            confidence: true,
            riskScore: true,
          },
          orderBy: { timestamp: "asc" },
          take: 5000,
        });
        const report = await generateSafetyReport({
          siteId: input.siteId,
          startDate: input.startDate,
          endDate: input.endDate,
          events: events.map((e: { id: string; type: string; timestamp: Date; confidence: number | null; riskScore: number | null }) => ({
            id: e.id,
            type: e.type,
            timestamp: e.timestamp,
            confidence: e.confidence ?? 0,
            riskScore: e.riskScore ?? undefined,
          })),
        });
        return { report };
      } catch (error) {
        logger.error("Error generating safety report", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate report",
        });
      }
    }),
});
