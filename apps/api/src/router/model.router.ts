import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

/**
 * Synthetic Model (v1) — minimal “living model” API.
 * This does NOT attempt photoreal rendering or game visuals.
 *
 * It aggregates current state + time-series slices from existing domain entities
 * and surfaces confidence/uncertainty per layer as first-class data.
 */
export const modelRouter = router({
  /**
   * Current model state for a single environment (site).
   * Output is GIS-native (site + zones) and time-aware.
   */
  state: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        // How far back we consider “current” activity.
        windowMinutes: z.number().min(1).max(24 * 60).default(60),
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

        const since = new Date(Date.now() - input.windowMinutes * 60 * 1000);

        const devices = await ctx.prisma.device.findMany({
          where: { siteId: input.siteId, organizationId: ctx.organizationId },
          orderBy: { createdAt: "asc" },
        });

        const [zones, alerts, detections, recentHealth] = await Promise.all([
          ctx.prisma.detectionZone.findMany({
            where: { siteId: input.siteId, organizationId: ctx.organizationId },
            orderBy: { createdAt: "asc" },
          }),
          ctx.prisma.alert.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              createdAt: { gte: since },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
          }),
          ctx.prisma.detectionEvent.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              timestamp: { gte: since },
            },
            orderBy: { timestamp: "desc" },
            take: 500,
          }),
          ctx.prisma.systemHealth.findMany({
            where: {
              organizationId: ctx.organizationId,
              deviceId: { in: devices.map((d: { id: string }) => d.id) },
              timestamp: { gte: since },
            },
            orderBy: { timestamp: "desc" },
            take: 200,
          }),
        ]);

        // Confidence/uncertainty per “layer”.
        const detectionConfidences = detections
          .map((d: { confidence: number | null }) => (typeof d.confidence === "number" ? d.confidence : null))
          .filter((v: number | null): v is number => v !== null);
        const avgDetectionConfidence =
          detectionConfidences.length > 0
            ? detectionConfidences.reduce((a: number, b: number) => a + b, 0) / detectionConfidences.length
            : 0;

        const deviceUptimeConfidence =
          devices.length === 0 ? 0 : devices.filter((d: { status: string }) => d.status === "online").length / devices.length;

        const layers = [
          {
            name: "sensing.devices",
            confidence: deviceUptimeConfidence,
            uncertainty: 1 - deviceUptimeConfidence,
            updatedAt: new Date(),
          },
          {
            name: "sensing.detections",
            confidence: avgDetectionConfidence,
            uncertainty: 1 - avgDetectionConfidence,
            updatedAt: detections[0]?.timestamp ?? new Date(0),
          },
          {
            name: "ops.alerts",
            confidence: alerts.length > 0 ? 1 : 0.5, // presence indicates system is emitting; not accuracy
            uncertainty: alerts.length > 0 ? 0 : 0.5,
            updatedAt: alerts[0]?.createdAt ?? new Date(0),
          },
          {
            name: "gis.zones",
            confidence: zones.length > 0 ? 1 : 0.7, // zone config exists vs default
            uncertainty: zones.length > 0 ? 0 : 0.3,
            updatedAt: zones[0]?.updatedAt ?? new Date(0),
          },
        ];

        return {
          environment: {
            id: site.id,
            name: site.name,
            description: site.description,
            address: site.address,
            latitude: site.latitude,
            longitude: site.longitude,
          },
          window: {
            since,
            until: new Date(),
            windowMinutes: input.windowMinutes,
          },
          layers,
          state: {
            devices,
            zones,
            alerts,
            detections,
            systemHealth: recentHealth,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error building model state", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to build model state" });
      }
    }),

  /**
   * Time-series persistence for “what has happened”.
   * Returns a lightweight series for dashboards/simulations.
   */
  history: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        // Accept ISO date strings and coerce to Date objects (tRPC serializes dates as strings over HTTP)
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
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

        const detections = await ctx.prisma.detectionEvent.findMany({
          where: {
            siteId: input.siteId,
            organizationId: ctx.organizationId,
            timestamp: { gte: input.startDate, lte: input.endDate },
          },
          select: {
            id: true,
            type: true,
            confidence: true,
            timestamp: true,
            riskScore: true,
          },
          orderBy: { timestamp: "asc" },
          take: 5000,
        });

        const alerts = await ctx.prisma.alert.findMany({
          where: {
            siteId: input.siteId,
            organizationId: ctx.organizationId,
            createdAt: { gte: input.startDate, lte: input.endDate },
          },
          select: {
            id: true,
            severity: true,
            status: true,
            title: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
          take: 5000,
        });

        return {
          environment: {
            id: site.id,
            name: site.name,
            latitude: site.latitude,
            longitude: site.longitude,
          },
          range: {
            startDate: input.startDate,
            endDate: input.endDate,
          },
          series: {
            detections,
            alerts,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching model history", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch model history" });
      }
    }),
});

