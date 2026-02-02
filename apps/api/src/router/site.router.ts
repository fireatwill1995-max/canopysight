import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc/trpc";
import { createSiteSchema, updateSiteSchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const siteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.prisma.site.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error fetching sites", error, {
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch sites",
      });
    }
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const site = await ctx.prisma.site.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          devices: true,
          zones: true,
        },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      return site;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error fetching site", error, {
        siteId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch site",
      });
    }
  }),

  create: adminProcedure.input(createSiteSchema).mutation(async ({ ctx, input }) => {
    try {
      const site = await ctx.prisma.site.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
        },
      });
      
      logger.info("Site created", {
        siteId: site.id,
        name: site.name,
        organizationId: ctx.organizationId,
      });
      
      return site;
    } catch (error) {
      logger.error("Error creating site", error, {
        organizationId: ctx.organizationId,
        input: { ...input, latitude: input.latitude, longitude: input.longitude },
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create site",
      });
    }
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(updateSiteSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const site = await ctx.prisma.site.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
        });

        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const updated = await ctx.prisma.site.update({
          where: { id },
          data,
        });
        
        logger.info("Site updated", {
          siteId: id,
          organizationId: ctx.organizationId,
        });
        
        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error updating site", error, {
          siteId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update site",
        });
      }
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      const site = await ctx.prisma.site.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const deleted = await ctx.prisma.site.delete({
        where: { id: input.id },
      });
      
      logger.info("Site deleted", {
        siteId: input.id,
        organizationId: ctx.organizationId,
      });
      
      return deleted;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error deleting site", error, {
        siteId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete site",
      });
    }
  }),
});
