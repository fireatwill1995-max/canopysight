import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createIncidentSchema, updateIncidentSchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const incidentRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: {
          organizationId: string;
          siteId?: string;
          severity?: string;
          resolvedAt?: null;
        } = {
          organizationId: ctx.organizationId,
          ...(input.siteId && { siteId: input.siteId }),
          ...(input.severity && { severity: input.severity }),
        };

        // Optionally filter only unresolved incidents
        // where.resolvedAt = null;

        const items = await ctx.prisma.incidentReport.findMany({
          where,
          include: {
            site: true,
          },
          orderBy: { reportedAt: "desc" },
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
        logger.error("Error fetching incidents", error, {
          organizationId: ctx.organizationId,
          filters: { siteId: input.siteId, severity: input.severity },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch incidents",
        });
      }
    }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const incident = await ctx.prisma.incidentReport.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          site: true,
        },
      });

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      return incident;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error fetching incident", error, {
        incidentId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch incident",
      });
    }
  }),

  /** Incident reconstruction & learning: visual timeline, environmental context, contributing conditions */
  reconstruction: protectedProcedure
    .input(z.object({ id: z.string(), windowMinutes: z.number().min(5).max(120).default(30) }))
    .query(async ({ ctx, input }) => {
      try {
        const incident = await ctx.prisma.incidentReport.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
          include: { site: true },
        });

        if (!incident) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Incident not found",
          });
        }

        const reportedAt = incident.reportedAt;
        const start = new Date(reportedAt.getTime() - input.windowMinutes * 60 * 1000);
        const end = new Date(reportedAt.getTime() + input.windowMinutes * 60 * 1000);

        const timelineEvents = await ctx.prisma.detectionEvent.findMany({
          where: {
            siteId: incident.siteId,
            organizationId: ctx.organizationId,
            timestamp: { gte: start, lte: end },
          },
          orderBy: { timestamp: "asc" },
          take: 200,
        });

        const contributingConditions =
          incident.contributingConditions != null
            ? (incident.contributingConditions as {
                crowding?: boolean;
                crowdingLevel?: number;
                zoneIds?: string[];
                layoutNotes?: string;
                timeOfDay?: string;
                hourOfDay?: number;
              })
            : null;

        return {
          incident,
          timeline: timelineEvents,
          contributingConditions,
          windowStart: start,
          windowEnd: end,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching incident reconstruction", error, {
          incidentId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch incident reconstruction",
        });
      }
    }),

  create: protectedProcedure.input(createIncidentSchema).mutation(async ({ ctx, input }) => {
    try {
      // Verify site belongs to organization
      const site = await ctx.prisma.site.findFirst({
        where: {
          id: input.siteId,
          organizationId: ctx.organizationId,
        },
      });

      if (!site) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Site not found",
        });
      }

      const incident = await ctx.prisma.incidentReport.create({
        data: {
          siteId: input.siteId,
          title: input.title,
          description: input.description,
          severity: input.severity,
          reportedBy: input.reportedBy || ctx.userId,
          organizationId: ctx.organizationId,
          metadata: (input.metadata ?? {}) as Record<string, string | number | boolean | null>,
          ...(input.contributingConditions && {
            contributingConditions: input.contributingConditions as object,
          }),
        },
        include: {
          site: true,
        },
      });

      logger.info("Incident created", {
        incidentId: incident.id,
        severity: incident.severity,
        organizationId: ctx.organizationId,
        siteId: incident.siteId,
      });

      return incident;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error creating incident", error, {
        organizationId: ctx.organizationId,
        siteId: input.siteId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create incident",
      });
    }
  }),

  update: protectedProcedure.input(updateIncidentSchema).mutation(async ({ ctx, input }) => {
    try {
      const { id, ...updateData } = input;

      // Verify incident belongs to organization
      const existing = await ctx.prisma.incidentReport.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      const data: Record<string, unknown> = { ...updateData };
      if (input.contributingConditions !== undefined) {
        data.contributingConditions = input.contributingConditions ?? undefined;
      }
      const incident = await ctx.prisma.incidentReport.update({
        where: { id },
        data,
        include: {
          site: true,
        },
      });

      logger.info("Incident updated", {
        incidentId: id,
        organizationId: ctx.organizationId,
      });

      return incident;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error updating incident", error, {
        incidentId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update incident",
      });
    }
  }),

  resolve: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      // Verify incident belongs to organization
      const existing = await ctx.prisma.incidentReport.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      const incident = await ctx.prisma.incidentReport.update({
        where: { id: input.id },
        data: {
          resolvedAt: new Date(),
        },
        include: {
          site: true,
        },
      });

      logger.info("Incident resolved", {
        incidentId: input.id,
        organizationId: ctx.organizationId,
      });

      return incident;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error resolving incident", error, {
        incidentId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to resolve incident",
      });
    }
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      // Verify incident belongs to organization
      const existing = await ctx.prisma.incidentReport.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      await ctx.prisma.incidentReport.delete({
        where: { id: input.id },
      });

      logger.info("Incident deleted", {
        incidentId: input.id,
        organizationId: ctx.organizationId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("Error deleting incident", error, {
        incidentId: input.id,
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete incident",
      });
    }
  }),
});
