import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

// The frontend "Project" concept maps to the Site model in the database.
// This router provides a project-oriented API facade over Site, enriched
// with aggregated stats (device count, detection count, etc.).

export const projectRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["active", "archived", "draft"]).optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const sites = await ctx.prisma.site.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input?.search && {
              OR: [
                { name: { contains: input.search, mode: "insensitive" as const } },
                { description: { contains: input.search, mode: "insensitive" as const } },
                { address: { contains: input.search, mode: "insensitive" as const } },
              ],
            }),
          },
          include: {
            _count: {
              select: {
                devices: true,
                detectionEvents: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return sites.map((site) => ({
          id: site.id,
          name: site.name,
          description: site.description,
          location: site.address,
          status: "active" as const, // Sites don't have status; default to active
          createdAt: site.createdAt.toISOString(),
          memberCount: 0, // No member-per-site tracking in current schema
          detectionCount: site._count.detectionEvents,
          deviceCount: site._count.devices,
        }));
      } catch (error) {
        logger.error("Error fetching projects", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch projects",
        });
      }
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
          include: {
            devices: {
              select: { id: true, name: true, status: true, deviceType: true },
            },
            zones: {
              select: { id: true, name: true, type: true, isActive: true },
            },
            _count: {
              select: {
                devices: true,
                detectionEvents: true,
                alerts: true,
                videoClips: true,
              },
            },
          },
        });

        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        return {
          id: site.id,
          name: site.name,
          description: site.description,
          location: site.address,
          latitude: site.latitude,
          longitude: site.longitude,
          status: "active" as const,
          createdAt: site.createdAt.toISOString(),
          devices: site.devices,
          zones: site.zones,
          detectionCount: site._count.detectionEvents,
          deviceCount: site._count.devices,
          alertCount: site._count.alerts,
          fileCount: site._count.videoClips,
          memberCount: 0,
          missionCount: 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching project", error, {
          projectId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch project",
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        location: z.string().max(500).optional(),
        latitude: z.number().min(-90).max(90).optional().default(0),
        longitude: z.number().min(-180).max(180).optional().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.create({
          data: {
            name: input.name,
            description: input.description,
            address: input.location,
            latitude: input.latitude,
            longitude: input.longitude,
            organizationId: ctx.organizationId!,
          },
        });

        logger.info("Project created", {
          projectId: site.id,
          name: site.name,
          organizationId: ctx.organizationId,
        });

        return {
          id: site.id,
          name: site.name,
          description: site.description,
          location: site.address,
          status: "active" as const,
          createdAt: site.createdAt.toISOString(),
        };
      } catch (error) {
        logger.error("Error creating project", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        location: z.string().max(500).optional(),
        status: z.enum(["active", "archived", "draft"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, status, location, ...rest } = input;

        const site = await ctx.prisma.site.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });

        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        const updated = await ctx.prisma.site.update({
          where: { id },
          data: {
            ...rest,
            ...(location !== undefined && { address: location }),
          },
        });

        logger.info("Project updated", {
          projectId: id,
          organizationId: ctx.organizationId,
        });

        return {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          location: updated.address,
          status: status ?? "active",
          createdAt: updated.createdAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating project", error, {
          projectId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update project",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });

        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        await ctx.prisma.site.delete({ where: { id: input.id } });

        logger.info("Project deleted", {
          projectId: input.id,
          organizationId: ctx.organizationId,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error deleting project", error, {
          projectId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete project",
        });
      }
    }),
});
