import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc/trpc";
import {
  createDeviceSchema,
  updateDeviceSchema,
  createCameraConfigSchema,
  updateCameraConfigSchema,
} from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const deviceRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        status: z.enum(["online", "offline", "maintenance", "error"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Optimize query: only select needed fields
        return await ctx.prisma.device.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
            ...(input.status && { status: input.status }),
          },
          select: {
            id: true,
            name: true,
            siteId: true,
            serialNumber: true,
            firmwareVersion: true,
            status: true,
            lastHeartbeat: true,
            ipAddress: true,
            macAddress: true,
            deviceType: true,
            streamUrl: true,
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
            cameraConfigs: {
              select: {
                id: true,
                cameraIndex: true,
                name: true,
                resolution: true,
                fps: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      } catch (error) {
        logger.error("Error fetching devices", error, {
          organizationId: ctx.organizationId,
          filters: { siteId: input.siteId, status: input.status },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch devices",
        });
      }
    }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const device = await ctx.prisma.device.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          site: true,
          cameraConfigs: true,
          systemHealth: {
            take: 10,
            orderBy: { timestamp: "desc" },
          },
        },
      });

      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
      }

      return device;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error fetching device", error, {
        deviceId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch device",
      });
    }
  }),

  create: adminProcedure.input(createDeviceSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Organization context is missing. Please sign in again.",
      });
    }
    try {
      const device = await ctx.prisma.device.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
          streamUrl: input.streamUrl ?? undefined,
        },
      });

      logger.info("Device created", {
        deviceId: device.id,
        name: device.name,
        organizationId: ctx.organizationId,
        siteId: device.siteId,
      });

      return device;
    } catch (error) {
      logger.error("Error creating device", error, {
        organizationId: ctx.organizationId,
        input: { ...input, siteId: input.siteId },
      });
      const message = error instanceof Error ? error.message : "Failed to create device";
      const prismaCode = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : undefined;
      if (prismaCode === "P2002") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A device with this serial number already exists.",
        });
      }
      if (prismaCode === "P2003") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The selected site does not exist or you don't have access to it.",
        });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: message.length > 200 ? "Failed to create device" : message,
      });
    }
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(updateDeviceSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const device = await ctx.prisma.device.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
        });

        if (!device) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        }

        const updated = await ctx.prisma.device.update({
          where: { id },
          data,
        });
        
        logger.info("Device updated", {
          deviceId: id,
          organizationId: ctx.organizationId,
        });
        
        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error updating device", error, {
          deviceId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update device",
        });
      }
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      const device = await ctx.prisma.device.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
      }

      const deleted = await ctx.prisma.device.delete({
        where: { id: input.id },
      });

      logger.info("Device deleted", {
        deviceId: input.id,
        organizationId: ctx.organizationId,
      });

      return deleted;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error deleting device", error, {
        deviceId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete device",
      });
    }
  }),

  createCameraConfig: adminProcedure
    .input(createCameraConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: input.deviceId,
            organizationId: ctx.organizationId!,
          },
        });
        if (!device) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        }
        const { deviceId, fov, ...rest } = input;
        const created = await ctx.prisma.cameraConfig.create({
          data: {
            deviceId,
            ...rest,
            ...(fov !== undefined && { fov: fov as object }),
          },
        });
        logger.info("Camera config created", {
          cameraConfigId: created.id,
          deviceId,
          organizationId: ctx.organizationId,
        });
        return created;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error creating camera config", error, {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create camera configuration",
        });
      }
    }),

  updateCameraConfig: adminProcedure
    .input(
      z.object({
        id: z.string(),
        deviceId: z.string(),
      }).merge(updateCameraConfigSchema)
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, deviceId, fov, ...rest } = input;
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: deviceId,
            organizationId: ctx.organizationId!,
          },
        });
        if (!device) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        }
        const config = await ctx.prisma.cameraConfig.findFirst({
          where: { id, deviceId },
        });
        if (!config) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Camera configuration not found" });
        }
        const data = { ...rest, ...(fov !== undefined && { fov: fov as object }) };
        const updated = await ctx.prisma.cameraConfig.update({
          where: { id },
          data,
        });
        logger.info("Camera config updated", { id, deviceId, organizationId: ctx.organizationId });
        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating camera config", error, {
          id: input.id,
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update camera configuration",
        });
      }
    }),

  deleteCameraConfig: adminProcedure
    .input(z.object({ id: z.string(), deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: input.deviceId,
            organizationId: ctx.organizationId!,
          },
        });
        if (!device) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        }
        const config = await ctx.prisma.cameraConfig.findFirst({
          where: { id: input.id, deviceId: input.deviceId },
        });
        if (!config) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Camera configuration not found" });
        }
        await ctx.prisma.cameraConfig.delete({ where: { id: input.id } });
        logger.info("Camera config deleted", {
          id: input.id,
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error deleting camera config", error, {
          id: input.id,
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete camera configuration",
        });
      }
    }),

  heartbeat: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        status: z.enum(["online", "offline", "maintenance", "error"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: input.deviceId,
            organizationId: ctx.organizationId,
          },
        });

        if (!device) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        }

        return await ctx.prisma.device.update({
          where: { id: input.deviceId },
          data: {
            lastHeartbeat: new Date(),
            ...(input.status && { status: input.status }),
          },
        });
        
        logger.debug("Device heartbeat updated", {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        
        return device;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error updating device heartbeat", error, {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update device heartbeat",
        });
      }
    }),
});
