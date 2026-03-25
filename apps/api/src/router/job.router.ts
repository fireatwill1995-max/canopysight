import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";
import {
  getJobStatus,
  cancelJob as cancelQueueJob,
  retryJob as retryQueueJob,
  type QueueName,
} from "../services/queue-service";

const queueNameSchema = z.enum([
  "ai-inference",
  "image-processing",
  "report-generation",
  "notifications",
]);

export const jobRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        queue: queueNameSchema.optional(),
        status: z
          .enum(["completed", "failed", "delayed", "active", "waiting"])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Query job records from the database
        const jobs = (await ctx.prisma.$queryRawUnsafe(
          `SELECT id, queue, status, data, result, error, created_at, updated_at
           FROM jobs
           WHERE organization_id = $1
             AND ($2::text IS NULL OR queue = $2)
             AND ($3::text IS NULL OR status = $3)
           ORDER BY created_at DESC
           LIMIT $4 OFFSET $5`,
          ctx.organizationId,
          input.queue ?? null,
          input.status ?? null,
          input.limit,
          input.offset,
        )) as Array<{
          id: string;
          queue: string;
          status: string;
          data: unknown;
          result: unknown;
          error: string | null;
          created_at: Date;
          updated_at: Date;
        }>;

        return jobs.map((j) => ({
          id: j.id,
          queue: j.queue,
          status: j.status,
          data: j.data,
          result: j.result,
          error: j.error,
          createdAt: j.created_at,
          updatedAt: j.updated_at,
        }));
      } catch (error) {
        logger.error("Error listing jobs", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list jobs",
        });
      }
    }),

  get: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        queue: queueNameSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const status = await getJobStatus(input.queue, input.jobId);

        if (!status) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }

        return status;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching job", error, {
          jobId: input.jobId,
          queue: input.queue,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch job details",
        });
      }
    }),

  cancel: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        queue: queueNameSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const cancelled = await cancelQueueJob(input.queue, input.jobId);

        if (!cancelled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Job cannot be cancelled (not found or already completed/failed)",
          });
        }

        logger.info("Job cancelled via API", {
          jobId: input.jobId,
          queue: input.queue,
          userId: ctx.userId,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error cancelling job", error, {
          jobId: input.jobId,
          queue: input.queue,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel job",
        });
      }
    }),

  retry: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        queue: queueNameSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const retried = await retryQueueJob(input.queue, input.jobId);

        if (!retried) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Job cannot be retried (not found or not in failed state)",
          });
        }

        logger.info("Job retried via API", {
          jobId: input.jobId,
          queue: input.queue,
          userId: ctx.userId,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error retrying job", error, {
          jobId: input.jobId,
          queue: input.queue,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retry job",
        });
      }
    }),
});
