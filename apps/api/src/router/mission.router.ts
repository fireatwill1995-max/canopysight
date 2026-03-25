import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

// No Mission model exists in the Prisma schema. This router uses raw SQL
// against a "missions" table. The table should be created via migration:
//
//   CREATE TABLE missions (
//     id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
//     name        TEXT NOT NULL,
//     site_id     TEXT NOT NULL REFERENCES "Site"(id) ON DELETE CASCADE,
//     drone_id    TEXT REFERENCES "Device"(id) ON DELETE SET NULL,
//     status      TEXT NOT NULL DEFAULT 'planned',
//     flight_path JSONB,
//     metadata    JSONB,
//     organization_id TEXT NOT NULL,
//     started_at  TIMESTAMPTZ,
//     completed_at TIMESTAMPTZ,
//     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
// Until the migration runs, procedures will fail gracefully.

export const missionRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["planned", "active", "completed", "failed"]).optional(),
          projectId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const missions = (await ctx.prisma.$queryRawUnsafe(
          `SELECT m.id, m.name, m.site_id, s.name as site_name,
                  m.drone_id, d.name as drone_name,
                  m.status, m.flight_path,
                  m.started_at, m.completed_at, m.created_at,
                  COALESCE((SELECT COUNT(*)::int FROM "DetectionEvent" de WHERE de."siteId" = m.site_id AND de."timestamp" >= COALESCE(m.started_at, m.created_at) AND (m.completed_at IS NULL OR de."timestamp" <= m.completed_at)), 0) as detection_count
           FROM missions m
           JOIN "Site" s ON s.id = m.site_id
           LEFT JOIN "Device" d ON d.id = m.drone_id
           WHERE m.organization_id = $1
             AND ($2::text IS NULL OR m.status = $2)
             AND ($3::text IS NULL OR m.site_id = $3)
           ORDER BY m.created_at DESC`,
          ctx.organizationId,
          input?.status ?? null,
          input?.projectId ?? null,
        )) as Array<{
          id: string;
          name: string;
          site_id: string;
          site_name: string;
          drone_id: string | null;
          drone_name: string | null;
          status: string;
          flight_path: unknown;
          started_at: Date | null;
          completed_at: Date | null;
          created_at: Date;
          detection_count: number;
        }>;

        return missions.map((m) => ({
          id: m.id,
          name: m.name,
          projectId: m.site_id,
          projectName: m.site_name,
          droneId: m.drone_id,
          drone: m.drone_name,
          status: m.status,
          flightPath: m.flight_path,
          startTime: m.started_at?.toISOString() ?? null,
          endTime: m.completed_at?.toISOString() ?? null,
          createdAt: m.created_at.toISOString(),
          detectionCount: m.detection_count,
        }));
      } catch (error) {
        logger.error("Error fetching missions", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch missions. The missions table may not exist yet.",
        });
      }
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const rows = (await ctx.prisma.$queryRawUnsafe(
          `SELECT m.id, m.name, m.site_id, s.name as site_name,
                  m.drone_id, d.name as drone_name,
                  m.status, m.flight_path, m.metadata,
                  m.started_at, m.completed_at, m.created_at
           FROM missions m
           JOIN "Site" s ON s.id = m.site_id
           LEFT JOIN "Device" d ON d.id = m.drone_id
           WHERE m.id = $1 AND m.organization_id = $2`,
          input.id,
          ctx.organizationId,
        )) as Array<{
          id: string;
          name: string;
          site_id: string;
          site_name: string;
          drone_id: string | null;
          drone_name: string | null;
          status: string;
          flight_path: unknown;
          metadata: unknown;
          started_at: Date | null;
          completed_at: Date | null;
          created_at: Date;
        }>;

        if (rows.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
        }

        const m = rows[0];
        return {
          id: m.id,
          name: m.name,
          projectId: m.site_id,
          projectName: m.site_name,
          droneId: m.drone_id,
          drone: m.drone_name,
          status: m.status,
          flightPath: m.flight_path,
          metadata: m.metadata,
          startTime: m.started_at?.toISOString() ?? null,
          endTime: m.completed_at?.toISOString() ?? null,
          createdAt: m.created_at.toISOString(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching mission", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch mission",
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        projectId: z.string(),
        droneId: z.string().optional(),
        flightPath: z
          .array(z.object({ lat: z.number(), lng: z.number() }))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify the project (site) belongs to the organization
        const site = await ctx.prisma.site.findFirst({
          where: { id: input.projectId, organizationId: ctx.organizationId },
        });
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        // Verify drone belongs to organization if provided
        if (input.droneId) {
          const device = await ctx.prisma.device.findFirst({
            where: { id: input.droneId, organizationId: ctx.organizationId },
          });
          if (!device) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Drone device not found" });
          }
        }

        const rows = (await ctx.prisma.$queryRawUnsafe(
          `INSERT INTO missions (name, site_id, drone_id, flight_path, organization_id, status)
           VALUES ($1, $2, $3, $4::jsonb, $5, 'planned')
           RETURNING id`,
          input.name,
          input.projectId,
          input.droneId ?? null,
          input.flightPath ? JSON.stringify(input.flightPath) : null,
          ctx.organizationId,
        )) as Array<{ id: string }>;

        logger.info("Mission created", {
          missionId: rows[0].id,
          name: input.name,
          projectId: input.projectId,
          organizationId: ctx.organizationId,
        });

        return {
          id: rows[0].id,
          name: input.name,
          projectId: input.projectId,
          status: "planned",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error creating mission", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create mission",
        });
      }
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.prisma.$executeRawUnsafe(
          `UPDATE missions
           SET status = 'active', started_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND organization_id = $2 AND status = 'planned'`,
          input.id,
          ctx.organizationId,
        );

        if (result === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mission not found or not in planned status",
          });
        }

        logger.info("Mission started", {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });

        return { success: true, status: "active" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error starting mission", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start mission",
        });
      }
    }),

  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.prisma.$executeRawUnsafe(
          `UPDATE missions
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
          input.id,
          ctx.organizationId,
        );

        if (result === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mission not found or not currently active",
          });
        }

        logger.info("Mission stopped", {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });

        return { success: true, status: "completed" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error stopping mission", error, {
          missionId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to stop mission",
        });
      }
    }),
});
