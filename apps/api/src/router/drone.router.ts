import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

export const droneRouter = router({
  // ─── DroneAsset CRUD ──────────────────────────────────────────────────────

  listAssets: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        status: z
          .enum(["ground", "flying", "charging", "maintenance", "offline"])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const items = await ctx.prisma.droneAsset.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
            ...(input.status && { status: input.status }),
          },
          include: { site: true },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
          ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        });

        let nextCursor: string | undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return { items, nextCursor };
      } catch (error) {
        logger.error("Error fetching drone assets", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch drone assets",
        });
      }
    }),

  assetById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const drone = await ctx.prisma.droneAsset.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          include: {
            site: true,
            missions: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        });

        if (!drone) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
        }

        return drone;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching drone asset", error, {
          droneId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch drone asset",
        });
      }
    }),

  createAsset: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        siteId: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        firmware: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.siteId) {
          const site = await ctx.prisma.site.findFirst({
            where: { id: input.siteId, organizationId: ctx.organizationId },
          });
          if (!site) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
          }
        }

        const drone = await ctx.prisma.droneAsset.create({
          data: {
            organizationId: ctx.organizationId,
            name: input.name,
            siteId: input.siteId ?? null,
            model: input.model ?? null,
            serialNumber: input.serialNumber ?? null,
            firmware: input.firmware ?? null,
            notes: input.notes ?? null,
          },
          include: { site: true },
        });

        logger.info("Drone asset created", {
          droneId: drone.id,
          name: drone.name,
          organizationId: ctx.organizationId,
        });

        return drone;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error creating drone asset", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create drone asset",
        });
      }
    }),

  updateAsset: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        siteId: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        status: z
          .enum(["ground", "flying", "charging", "maintenance", "offline"])
          .optional(),
        firmware: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.droneAsset.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
        }

        const { id, ...data } = input;
        const drone = await ctx.prisma.droneAsset.update({
          where: { id },
          data,
          include: { site: true },
        });

        logger.info("Drone asset updated", { droneId: id, organizationId: ctx.organizationId });
        return drone;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating drone asset", error, {
          droneId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update drone asset",
        });
      }
    }),

  deleteAsset: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.droneAsset.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
        }

        await ctx.prisma.droneAsset.delete({ where: { id: input.id } });
        logger.info("Drone asset deleted", { droneId: input.id, organizationId: ctx.organizationId });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error deleting drone asset", error, {
          droneId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete drone asset",
        });
      }
    }),

  // ─── DroneMission CRUD ────────────────────────────────────────────────────

  listMissions: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        droneId: z.string().optional(),
        status: z
          .enum(["planned", "active", "completed", "aborted", "failed"])
          .optional(),
        missionType: z
          .enum(["patrol", "survey", "response", "inspection"])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const items = await ctx.prisma.droneMission.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
            ...(input.droneId && { droneId: input.droneId }),
            ...(input.status && { status: input.status }),
            ...(input.missionType && { missionType: input.missionType }),
          },
          include: { site: true, drone: true },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
          ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        });

        let nextCursor: string | undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return { items, nextCursor };
      } catch (error) {
        logger.error("Error fetching drone missions", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch drone missions",
        });
      }
    }),

  missionById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const mission = await ctx.prisma.droneMission.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          include: { site: true, drone: true },
        });

        if (!mission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
        }

        return mission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching drone mission", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch drone mission",
        });
      }
    }),

  createMission: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        droneId: z.string().optional(),
        name: z.string().min(1).max(255),
        missionType: z
          .enum(["patrol", "survey", "response", "inspection"])
          .default("patrol"),
        waypoints: z.array(z.record(z.unknown())).optional(),
        plannedDuration: z.number().int().positive().optional(),
        maxAltitude: z.number().positive().optional(),
        plannedAt: z.string().optional(),
        pilotId: z.string().optional(),
        aiRecommendations: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.siteId, organizationId: ctx.organizationId },
        });
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        if (input.droneId) {
          const drone = await ctx.prisma.droneAsset.findFirst({
            where: { id: input.droneId, organizationId: ctx.organizationId },
          });
          if (!drone) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
          }
        }

        const mission = await ctx.prisma.droneMission.create({
          data: {
            organizationId: ctx.organizationId,
            siteId: input.siteId,
            droneId: input.droneId ?? null,
            name: input.name,
            missionType: input.missionType,
            waypoints: input.waypoints ? (input.waypoints as object) : undefined,
            plannedDuration: input.plannedDuration ?? null,
            maxAltitude: input.maxAltitude ?? null,
            plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
            pilotId: input.pilotId ?? null,
            aiRecommendations: input.aiRecommendations ?? null,
            notes: input.notes ?? null,
          },
          include: { site: true, drone: true },
        });

        logger.info("Drone mission created", {
          missionId: mission.id,
          name: mission.name,
          organizationId: ctx.organizationId,
        });

        return mission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error creating drone mission", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create drone mission",
        });
      }
    }),

  updateMissionStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["planned", "active", "completed", "aborted", "failed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.droneMission.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
        }

        const now = new Date();
        const timeData: Record<string, Date | null> = {};
        if (input.status === "active" && !existing.startedAt) {
          timeData.startedAt = now;
        }
        if (
          (input.status === "completed" ||
            input.status === "aborted" ||
            input.status === "failed") &&
          !existing.completedAt
        ) {
          timeData.completedAt = now;
          if (existing.startedAt) {
            // actualDuration computed as seconds
            const durationSeconds = Math.round(
              (now.getTime() - existing.startedAt.getTime()) / 1000
            );
            Object.assign(timeData, { actualDuration: durationSeconds });
          }
        }

        const mission = await ctx.prisma.droneMission.update({
          where: { id: input.id },
          data: { status: input.status, ...timeData },
          include: { site: true, drone: true },
        });

        logger.info("Drone mission status updated", {
          missionId: input.id,
          status: input.status,
          organizationId: ctx.organizationId,
        });

        return mission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating drone mission status", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update mission status",
        });
      }
    }),

  completeMission: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        flightPath: z.array(z.record(z.unknown())).optional(),
        coverageArea: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.droneMission.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
        }

        const now = new Date();
        const actualDuration =
          existing.startedAt
            ? Math.round((now.getTime() - existing.startedAt.getTime()) / 1000)
            : null;

        const mission = await ctx.prisma.droneMission.update({
          where: { id: input.id },
          data: {
            status: "completed",
            completedAt: now,
            ...(actualDuration !== null && { actualDuration }),
            ...(input.flightPath && { flightPath: input.flightPath as object }),
            ...(input.coverageArea !== undefined && { coverageArea: input.coverageArea }),
            ...(input.notes && { notes: input.notes }),
          },
          include: { site: true, drone: true },
        });

        // Update drone flight stats if drone assigned
        if (existing.droneId) {
          await ctx.prisma.droneAsset.update({
            where: { id: existing.droneId },
            data: {
              lastFlightAt: now,
              totalFlights: { increment: 1 },
              flightHours: {
                increment: actualDuration ? actualDuration / 3600 : 0,
              },
              status: "ground",
            },
          });
        }

        logger.info("Drone mission completed", {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });

        return mission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error completing drone mission", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete mission",
        });
      }
    }),

  abortMission: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.droneMission.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
        }

        const mission = await ctx.prisma.droneMission.update({
          where: { id: input.id },
          data: {
            status: "aborted",
            completedAt: new Date(),
            ...(input.reason && { notes: input.reason }),
          },
          include: { site: true, drone: true },
        });

        if (existing.droneId) {
          await ctx.prisma.droneAsset.update({
            where: { id: existing.droneId },
            data: { status: "ground" },
          });
        }

        logger.info("Drone mission aborted", {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });

        return mission;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error aborting drone mission", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to abort mission",
        });
      }
    }),

  // ─── Telemetry ────────────────────────────────────────────────────────────

  updateTelemetry: protectedProcedure
    .input(
      z.object({
        droneId: z.string(),
        batteryLevel: z.number().min(0).max(100).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        altitude: z.number().optional(),
        heading: z.number().min(0).max(360).optional(),
        speed: z.number().min(0).optional(),
        status: z
          .enum(["ground", "flying", "charging", "maintenance", "offline"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { droneId, ...telemetry } = input;

        const drone = await ctx.prisma.droneAsset.findFirst({
          where: { id: droneId, organizationId: ctx.organizationId },
        });
        if (!drone) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
        }

        const updated = await ctx.prisma.droneAsset.update({
          where: { id: droneId },
          data: {
            ...telemetry,
            lastTelemetryAt: new Date(),
          },
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error updating drone telemetry", error, {
          droneId: input.droneId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update drone telemetry",
        });
      }
    }),

  // ─── Maintenance ──────────────────────────────────────────────────────────

  scheduleMaintenance: protectedProcedure
    .input(
      z.object({
        droneId: z.string(),
        maintenanceDueAt: z.string(), // ISO date string
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const drone = await ctx.prisma.droneAsset.findFirst({
          where: { id: input.droneId, organizationId: ctx.organizationId },
        });
        if (!drone) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
        }

        const updated = await ctx.prisma.droneAsset.update({
          where: { id: input.droneId },
          data: {
            maintenanceDueAt: new Date(input.maintenanceDueAt),
            ...(input.notes && { notes: input.notes }),
          },
        });

        logger.info("Drone maintenance scheduled", {
          droneId: input.droneId,
          maintenanceDueAt: input.maintenanceDueAt,
          organizationId: ctx.organizationId,
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error scheduling drone maintenance", error, {
          droneId: input.droneId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to schedule maintenance",
        });
      }
    }),

  recordFlight: protectedProcedure
    .input(
      z.object({
        droneId: z.string(),
        flightDurationSeconds: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const drone = await ctx.prisma.droneAsset.findFirst({
          where: { id: input.droneId, organizationId: ctx.organizationId },
        });
        if (!drone) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Drone not found" });
        }

        const updated = await ctx.prisma.droneAsset.update({
          where: { id: input.droneId },
          data: {
            totalFlights: { increment: 1 },
            flightHours: { increment: input.flightDurationSeconds / 3600 },
            lastFlightAt: new Date(),
          },
        });

        logger.info("Drone flight recorded", {
          droneId: input.droneId,
          durationSeconds: input.flightDurationSeconds,
          organizationId: ctx.organizationId,
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error recording drone flight", error, {
          droneId: input.droneId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record flight",
        });
      }
    }),
});
