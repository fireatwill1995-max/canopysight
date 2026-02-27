import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc/trpc";
import { createZoneSchema, updateZoneSchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const zoneRouter = router({
  list: protectedProcedure
    .input(z.object({ siteId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.prisma.detectionZone.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
          },
          include: {
            site: true,
          },
          orderBy: { createdAt: "desc" },
        });
      } catch (error) {
        logger.error("Error fetching zones", error, {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch zones",
        });
      }
    }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const zone = await ctx.prisma.detectionZone.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          site: true,
        },
      });

      if (!zone) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
      }

      return zone;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error fetching zone", error, {
        zoneId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch zone",
      });
    }
  }),

  create: adminProcedure.input(createZoneSchema).mutation(async ({ ctx, input }) => {
    try {
      // Validate points array
      if (!input.points || input.points.length < 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Zone must have at least 3 points",
        });
      }

      return await ctx.prisma.detectionZone.create({
        data: {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
          name: input.name,
          type: input.type,
          points: input.points as Array<{ x: number; y: number }>,
          cameraId: input.cameraId,
          isActive: input.isActive ?? true,
          sensitivity: input.sensitivity ?? 50,
          metadata: input.metadata ? (input.metadata as object) : undefined,
        },
        include: {
          site: true,
        },
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error creating zone", error, {
        organizationId: ctx.organizationId,
        siteId: input.siteId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create zone",
      });
    }
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(updateZoneSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        // Validate points if provided
        if (data.points && data.points.length < 3) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Zone must have at least 3 points",
          });
        }

        const zone = await ctx.prisma.detectionZone.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
        });

        if (!zone) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
        }

        const updated = await ctx.prisma.detectionZone.update({
          where: { id },
          data: {
            // Avoid updating siteId/organizationId via generic spread
            name: data.name,
            type: data.type,
            points: data.points ? (data.points as Array<{ x: number; y: number }>) : undefined,
            cameraId: data.cameraId,
            isActive: data.isActive,
            sensitivity: data.sensitivity,
            metadata: data.metadata != null ? (data.metadata as object) : undefined,
          },
        });

        logger.info("Zone updated", {
          zoneId: id,
          organizationId: ctx.organizationId,
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error updating zone", error, {
          zoneId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update zone",
        });
      }
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      const zone = await ctx.prisma.detectionZone.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!zone) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
      }

      const deleted = await ctx.prisma.detectionZone.delete({
        where: { id: input.id },
      });
      
      logger.info("Zone deleted", {
        zoneId: input.id,
        organizationId: ctx.organizationId,
      });
      
      return deleted;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error deleting zone", error, {
        zoneId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete zone",
      });
    }
  }),
});
