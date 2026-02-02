import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  createMeshConnectConfigSchema,
  updateMeshConnectConfigSchema,
} from "@canopy-sight/validators";
import { logger } from "@canopy-sight/config";

export const meshconnectRouter = router({
  /**
   * Get MeshConnect configuration for a device
   */
  getConfig: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify device belongs to organization
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: input.deviceId,
            organizationId: ctx.organizationId,
            deviceType: "meshconnect",
          },
        });

        if (!device) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "MeshConnect device not found",
          });
        }

        const config = await ctx.prisma.meshConnectConfig.findUnique({
          where: { deviceId: input.deviceId },
        });

        return config;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error fetching MeshConnect config", error, {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch MeshConnect configuration",
        });
      }
    }),

  /**
   * Create or update MeshConnect configuration
   */
  upsertConfig: adminProcedure
    .input(
      z.object({
        deviceId: z.string(),
      }).merge(createMeshConnectConfigSchema)
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify device belongs to organization and is MeshConnect type
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: input.deviceId,
            organizationId: ctx.organizationId,
            deviceType: "meshconnect",
          },
        });

        if (!device) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "MeshConnect device not found",
          });
        }

        const { deviceId, ...configData } = input;

        // Check if config exists
        const existing = await ctx.prisma.meshConnectConfig.findUnique({
          where: { deviceId },
        });

        const result = existing
          ? await ctx.prisma.meshConnectConfig.update({
              where: { deviceId },
              data: configData,
            })
          : await ctx.prisma.meshConnectConfig.create({
              data: {
                deviceId,
                ...configData,
              },
            });

        logger.info("MeshConnect config saved", {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });

        return result;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error upserting MeshConnect config", error, {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save MeshConnect configuration",
        });
      }
    }),

  /**
   * Update MeshConnect status (called by edge agent)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        nodeStatus: z.enum(["connected", "disconnected", "syncing", "error"]),
        signalStrength: z.number().optional(),
        neighborNodes: z.array(z.string()).optional(),
        latency: z.number().optional(),
        throughput: z.number().optional(),
        lastSyncTime: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { deviceId, ...statusData } = input;

        // Verify device belongs to organization
        const device = await ctx.prisma.device.findFirst({
          where: {
            id: deviceId,
            organizationId: ctx.organizationId,
          },
        });

        if (!device) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Device not found",
          });
        }

        const config = await ctx.prisma.meshConnectConfig.findUnique({
          where: { deviceId },
        });

        if (!config) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "MeshConnect configuration not found",
          });
        }

        const updated = await ctx.prisma.meshConnectConfig.update({
          where: { deviceId },
          data: {
            nodeStatus: statusData.nodeStatus,
            signalStrength: statusData.signalStrength,
            neighborNodes: statusData.neighborNodes || [],
            latency: statusData.latency,
            throughput: statusData.throughput,
            lastSyncTime: statusData.lastSyncTime || new Date(),
            updatedAt: new Date(),
          },
        });

        logger.info("MeshConnect status updated", {
          deviceId,
          nodeStatus: statusData.nodeStatus,
          organizationId: ctx.organizationId,
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error updating MeshConnect status", error, {
          deviceId: input.deviceId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update MeshConnect status",
        });
      }
    }),

  /**
   * Get mesh network topology for a site
   */
  getTopology: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Get all MeshConnect devices for this site
        const devices = await ctx.prisma.device.findMany({
          where: {
            siteId: input.siteId,
            organizationId: ctx.organizationId,
            deviceType: "meshconnect",
          },
          include: {
            meshConnectConfig: true,
          },
        });

        type DeviceWithMesh = (typeof devices)[number];
        const nodes = devices
          .filter((d: DeviceWithMesh): d is DeviceWithMesh & { meshConnectConfig: NonNullable<DeviceWithMesh["meshConnectConfig"]> } => d.meshConnectConfig != null)
          .map((device: DeviceWithMesh & { meshConnectConfig: NonNullable<DeviceWithMesh["meshConnectConfig"]> }) => ({
            nodeId: device.meshConnectConfig.meshNodeId || device.id,
            deviceId: device.id,
            deviceName: device.name,
            ipAddress: device.ipAddress,
            status: device.meshConnectConfig.nodeStatus,
            signalStrength: device.meshConnectConfig.signalStrength ?? undefined,
            neighborNodes: (Array.isArray(device.meshConnectConfig.neighborNodes) ? device.meshConnectConfig.neighborNodes : []) as string[],
            latency: device.meshConnectConfig.latency ?? undefined,
            throughput: device.meshConnectConfig.throughput ?? undefined,
            isGateway: device.meshConnectConfig.isGateway,
          }));

        type NodeItem = { nodeId: string; deviceId: string; neighborNodes: string[]; signalStrength?: number; latency?: number };
        // Build edges from neighbor relationships
        const edges: Array<{ from: string; to: string; signalStrength?: number; latency?: number }> = [];
        nodes.forEach((node: NodeItem) => {
          const neighbors = Array.isArray(node.neighborNodes) ? node.neighborNodes : [];
          neighbors.forEach((neighborId: string) => {
            const neighbor = nodes.find((n: NodeItem) => n.nodeId === neighborId);
            if (neighbor) {
              edges.push({
                from: node.nodeId,
                to: neighborId,
                signalStrength: node.signalStrength ?? undefined,
                latency: node.latency ?? undefined,
              });
            }
          });
        });

        return {
          nodes,
          edges,
        };
      } catch (error) {
        logger.error("Error fetching mesh topology", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch mesh topology",
        });
      }
    }),

  /**
   * List all MeshConnect devices for a site
   */
  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.prisma.device.findMany({
          where: {
            organizationId: ctx.organizationId,
            deviceType: "meshconnect",
            ...(input.siteId && { siteId: input.siteId }),
          },
          include: {
            site: true,
            meshConnectConfig: true,
          },
          orderBy: { createdAt: "desc" },
        });
      } catch (error) {
        logger.error("Error fetching MeshConnect devices", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch MeshConnect devices",
        });
      }
    }),
});
