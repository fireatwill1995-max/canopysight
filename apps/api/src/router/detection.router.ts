import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createDetectionEventSchema, detectionListQuerySchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { getWsServer } from "../services/ws-server-ref";
import { cacheMiddleware, cacheInvalidation } from "../middleware/cache-middleware";
import { logger } from "@canopy-sight/config";

export const detectionRouter = router({
  list: protectedProcedure
    .use(cacheMiddleware(60)) // Cache for 1 minute
    .input(detectionListQuerySchema)
    .query(async ({ ctx, input }) => {
    try {
      const where: {
        organizationId: string;
        siteId?: string;
        deviceId?: string;
        timestamp?: { gte?: Date; lte?: Date };
        type?: { in: string[] };
        riskScore?: { gte: number };
        zoneIds?: { hasSome: string[] };
      } = {
        organizationId: ctx.organizationId,
        ...(input.siteId && { siteId: input.siteId }),
        ...(input.deviceId && { deviceId: input.deviceId }),
        ...(input.startDate || input.endDate ? {
          timestamp: {
            ...(input.startDate && { gte: input.startDate }),
            ...(input.endDate && { lte: input.endDate }),
          },
        } : {}),
        ...(input.types && input.types.length > 0 && { type: { in: input.types } }),
        ...(input.minRiskScore !== undefined && { riskScore: { gte: input.minRiskScore } }),
        ...(input.zones && input.zones.length > 0 && { zoneIds: { hasSome: input.zones } }),
      };

      // Optimize query: only select needed fields to reduce payload size
      const items = await ctx.prisma.detectionEvent.findMany({
        where,
        select: {
          id: true,
          type: true,
          confidence: true,
          timestamp: true,
          boundingBox: true,
          zoneIds: true,
          riskScore: true,
          videoClipId: true,
          metadata: true,
          createdAt: true,
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
          videoClip: {
            select: {
              id: true,
              filePath: true,
              thumbnailPath: true,
              duration: true,
            },
          },
        },
        orderBy: { timestamp: "desc" },
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
      logger.error("Error fetching detection events", error, {
        organizationId: ctx.organizationId,
        input: { ...input, cursor: input.cursor ? "***" : undefined },
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch detection events",
      });
    }
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const event = await ctx.prisma.detectionEvent.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          site: true,
          device: true,
          videoClip: true,
          riskScores: true,
          alerts: true,
        },
      });

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Detection event not found" });
      }

      return event;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error fetching detection event", error, {
        eventId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch detection event",
      });
    }
  }),

  create: protectedProcedure.input(createDetectionEventSchema).mutation(async ({ ctx, input }) => {
    try {
      // Validate bounding box
      if (input.boundingBox && (
        typeof input.boundingBox.x !== "number" ||
        typeof input.boundingBox.y !== "number" ||
        typeof input.boundingBox.width !== "number" ||
        typeof input.boundingBox.height !== "number"
      )) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid bounding box format",
        });
      }

      const event = await ctx.prisma.detectionEvent.create({
        data: {
          organizationId: ctx.organizationId,
          deviceId: input.deviceId,
          siteId: input.siteId,
          type: input.type,
          confidence: input.confidence,
          timestamp: input.timestamp,
          boundingBox: input.boundingBox as { x: number; y: number; width: number; height: number },
          zoneIds: input.zoneIds ?? [],
          riskScore: input.riskScore,
          videoClipId: input.videoClipId,
          metadata: input.metadata != null ? (input.metadata as object) : undefined,
        },
        include: {
          site: true,
          device: true,
        },
      });

      // Generate embedding for vector search (async, don't block)
      // This runs in background to avoid slowing down event creation
      setImmediate(async () => {
        try {
          const { embeddingsService } = await import("../services/embeddings-service");
          const embedding = await embeddingsService.generateForEvent({
            type: event.type,
            confidence: event.confidence,
            riskScore: event.riskScore || undefined,
            zoneIds: event.zoneIds,
            timestamp: event.timestamp,
            metadata: (event.metadata as Record<string, unknown>) || {},
          });

          // Store embedding in metadata (pgvector would require schema migration)
          await ctx.prisma.detectionEvent.update({
            where: { id: event.id },
            data: {
              metadata: {
                ...((event.metadata as Record<string, unknown>) || {}),
                embeddingGenerated: true,
                embeddingLength: embedding.length,
              } as object,
            },
          });
        } catch (embeddingError) {
          logger.warn("Failed to generate embedding", {
            error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
            eventId: event.id,
          });
          // Continue without embedding
        }
      });

      // Broadcast via WebSocket
      getWsServer()?.broadcastDetection(ctx.organizationId, {
        id: event.id,
        type: event.type,
        confidence: event.confidence,
        siteId: event.siteId,
        timestamp: event.timestamp,
      });

      // Invalidate relevant caches
      await cacheInvalidation.organization(ctx.organizationId);

      return event;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error creating detection event", error, {
        organizationId: ctx.organizationId,
        deviceId: input.deviceId,
        siteId: input.siteId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create detection event",
      });
    }
  }),

  stats: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        // tRPC serializes Date objects as ISO strings over HTTP
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Validate date range
        if (input.endDate < input.startDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "End date must be after start date",
          });
        }

        const where = {
          organizationId: ctx.organizationId,
          ...(input.siteId && { siteId: input.siteId }),
          timestamp: {
            gte: input.startDate,
            lte: input.endDate,
          },
        };

        const [total, byType, avgRiskScore] = await Promise.all([
          ctx.prisma.detectionEvent.count({ where }),
          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where,
            _count: true,
          }),
          ctx.prisma.detectionEvent.aggregate({
            where: {
              ...where,
              riskScore: { not: null },
            },
            _avg: { riskScore: true },
          }),
        ]);

        return {
          total,
          byType: byType.map((item: { type: string; _count: number }) => ({
            type: item.type,
            count: item._count,
          })),
          avgRiskScore: avgRiskScore._avg.riskScore ?? 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error fetching detection stats", error, {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
          startDate: input.startDate.toISOString(),
          endDate: input.endDate.toISOString(),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch detection stats",
        });
      }
    }),
});
