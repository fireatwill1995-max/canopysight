import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

/**
 * Deployable Sensing (Truth Layer) — ingestion scaffolding (v1).
 *
 * This is metadata-first: it supports geospatial tagging, time-sync, buffering hooks,
 * and health/status reporting without binding to specific hardware vendors.
 */
export const ingestionRouter = router({
  /**
   * Register / upsert a sensing “stream” (UAV run, sensor node, external feed).
   * This is a minimal hook that maps onto existing `Device` + `SystemHealth`.
   */
  registerStream: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        streamType: z.enum(["uav", "ground_sensor", "external_api"]),
        name: z.string().min(1),
        // GIS-native tagging
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        // Time sync hint (e.g., device clock offset in ms)
        timeOffsetMs: z.number().optional(),
        confidence: z.number().min(0).max(1).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.siteId, organizationId: ctx.organizationId },
        });
        if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });

        // Atomic find-or-create: try create first, fall back to update on conflict.
        let device;
        try {
          device = await ctx.prisma.device.create({
            data: {
              name: input.name,
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              status: "offline",
              firmwareVersion: input.streamType,
            },
          });
        } catch (createError) {
          // If creation failed (likely duplicate), find and update
          const existing = await ctx.prisma.device.findFirst({
            where: {
              organizationId: ctx.organizationId,
              siteId: input.siteId,
              name: input.name,
            },
          });
          if (!existing) throw createError;
          device = await ctx.prisma.device.update({
            where: { id: existing.id },
            data: { firmwareVersion: input.streamType },
          });
        }

        // Emit a health/status datapoint (confidence first-class)
        await ctx.prisma.systemHealth.create({
          data: {
            organizationId: ctx.organizationId,
            deviceId: device.id,
            metadata: {
              streamType: input.streamType,
              latitude: input.latitude ?? site.latitude,
              longitude: input.longitude ?? site.longitude,
              timeOffsetMs: input.timeOffsetMs ?? 0,
              confidence: input.confidence ?? 0.7,
              ...input.metadata,
            },
          },
        });

        return {
          streamId: device.id,
          siteId: input.siteId,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error registering stream", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to register stream" });
      }
    }),

  /**
   * Buffered upload hook — accepts an “envelope” describing an upload.
   * Payload storage is intentionally deferred in v1; we store metadata for auditability.
   */
  bufferedUpload: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        streamId: z.string().optional(),
        kind: z.enum(["imagery", "lidar", "telemetry", "environmental", "vibration", "other"]),
        capturedAt: z.coerce.date(),
        location: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
          })
          .optional(),
        confidence: z.number().min(0).max(1).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.siteId, organizationId: ctx.organizationId },
        });
        if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });

        // Persist as audit log entry for now (storage adapter deferred).
        await ctx.prisma.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "buffered_upload",
            resourceType: "sensing",
            resourceId: input.streamId ?? input.siteId,
            changes: {
              ...input,
              location: input.location ?? { latitude: site.latitude, longitude: site.longitude },
              confidence: input.confidence ?? 0.7,
            } as object,
          },
        });

        return { accepted: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error accepting buffered upload", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to accept upload" });
      }
    }),
});

