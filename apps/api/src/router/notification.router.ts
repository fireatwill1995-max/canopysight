import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.prisma.notificationPreference.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(ctx.userRole !== "admin" && ctx.userId && { userId: ctx.userId }),
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error fetching notification preferences", error, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch notification preferences",
      });
    }
  }),

  create: adminProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        channel: z.enum(["sms", "email", "push", "webhook"]),
        severity: z.enum(["advisory", "warning", "critical"]).optional(),
        siteIds: z.array(z.string()).default([]),
        isActive: z.boolean().default(true),
        config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const preference = await ctx.prisma.notificationPreference.create({
          data: {
            organizationId: ctx.organizationId,
            userId: input.userId,
            channel: input.channel,
            severity: input.severity,
            siteIds: input.siteIds,
            isActive: input.isActive ?? true,
            config: input.config != null ? (input.config as object) : undefined,
          },
        });
        
        logger.info("Notification preference created", {
          preferenceId: preference.id,
          organizationId: ctx.organizationId,
          channel: preference.channel,
        });
        
        return preference;
      } catch (error) {
        logger.error("Error creating notification preference", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create notification preference",
        });
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const preference = await ctx.prisma.notificationPreference.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
      });

      if (!preference) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification preference not found" });
      }

      return ctx.prisma.notificationPreference.update({
        where: { id },
        data: {
          isActive: data.isActive,
          config: data.config != null ? (data.config as object) : undefined,
        },
      });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      const preference = await ctx.prisma.notificationPreference.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!preference) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification preference not found" });
      }

      const deleted = await ctx.prisma.notificationPreference.delete({
        where: { id: input.id },
      });

      logger.info("Notification preference deleted", {
        preferenceId: input.id,
        organizationId: ctx.organizationId,
      });

      return deleted;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error deleting notification preference", error, {
        preferenceId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete notification preference",
      });
    }
  }),
});
