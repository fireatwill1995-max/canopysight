import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";
import { getSignedUploadUrl, getSignedDownloadUrl, deleteFile as deleteR2File } from "../services/storage-service";
import { addJob } from "../services/queue-service";
import { logAuditEventAsync } from "../services/audit-service";
import crypto from "crypto";

export const fileRouter = router({
  createUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1),
        siteId: z.string().optional(),
        deviceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const fileId = crypto.randomUUID();
        const ext = input.filename.split(".").pop() || "";
        const key = `${ctx.organizationId}/${fileId}${ext ? `.${ext}` : ""}`;

        const uploadUrl = await getSignedUploadUrl(key, input.contentType, 3600, {
          "organization-id": ctx.organizationId!,
          "user-id": ctx.userId!,
          "original-filename": input.filename,
        });

        return {
          fileId,
          uploadUrl,
          key,
          expiresIn: 3600,
        };
      } catch (error) {
        logger.error("Error creating upload URL", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate upload URL",
        });
      }
    }),

  confirmUpload: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        key: z.string(),
        filename: z.string(),
        contentType: z.string(),
        size: z.number().positive(),
        siteId: z.string().optional(),
        deviceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Record file in database using raw SQL (File model may not exist yet)
        await ctx.prisma.$executeRaw`
          INSERT INTO "files" ("id", "key", "filename", "content_type", "size", "organization_id", "uploaded_by", "site_id", "device_id", "status", "created_at", "updated_at")
          VALUES (
            ${input.fileId},
            ${input.key},
            ${input.filename},
            ${input.contentType},
            ${input.size},
            ${ctx.organizationId},
            ${ctx.userId},
            ${input.siteId ?? null},
            ${input.deviceId ?? null},
            'uploaded',
            NOW(),
            NOW()
          )
        `;

        // Trigger CV pipeline job
        const job = await addJob("ai-inference", {
          fileId: input.fileId,
          modelId: "default",
          organizationId: ctx.organizationId!,
        });

        logAuditEventAsync({
          userId: ctx.userId!,
          action: "upload",
          resource: `file:${input.fileId}`,
          metadata: { filename: input.filename, key: input.key, size: input.size },
        });

        logger.info("File upload confirmed", {
          fileId: input.fileId,
          organizationId: ctx.organizationId,
          jobId: job.jobId,
        });

        return {
          fileId: input.fileId,
          jobId: job.jobId,
          status: "processing",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error confirming upload", error, {
          fileId: input.fileId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to confirm file upload",
        });
      }
    }),

  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        deviceId: z.string().optional(),
        contentType: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const results = (await ctx.prisma.$queryRawUnsafe(
          `SELECT id, key, filename, content_type, size, status, site_id, device_id, created_at
           FROM files
           WHERE organization_id = $1
             AND ($2::text IS NULL OR site_id = $2)
             AND ($3::text IS NULL OR device_id = $3)
             AND ($4::text IS NULL OR content_type LIKE $4)
             AND deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT $5
           OFFSET $6`,
          ctx.organizationId,
          input.siteId ?? null,
          input.deviceId ?? null,
          input.contentType ? `${input.contentType}%` : null,
          input.limit + 1,
          input.cursor ? Number(input.cursor) : 0,
        )) as Array<{
          id: string;
          key: string;
          filename: string;
          content_type: string;
          size: number;
          status: string;
          site_id: string | null;
          device_id: string | null;
          created_at: Date;
        }>;

        const hasMore = results.length > input.limit;
        const items = hasMore ? results.slice(0, input.limit) : results;

        return {
          items: items.map((r) => ({
            id: r.id,
            key: r.key,
            filename: r.filename,
            contentType: r.content_type,
            size: r.size,
            status: r.status,
            siteId: r.site_id,
            deviceId: r.device_id,
            createdAt: r.created_at,
          })),
          nextCursor: hasMore
            ? String((input.cursor ? Number(input.cursor) : 0) + input.limit)
            : undefined,
        };
      } catch (error) {
        logger.error("Error listing files", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list files",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete
        const result = await ctx.prisma.$executeRaw`
          UPDATE files SET deleted_at = NOW(), updated_at = NOW()
          WHERE id = ${input.id} AND organization_id = ${ctx.organizationId} AND deleted_at IS NULL
        `;

        if (result === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
        }

        logAuditEventAsync({
          userId: ctx.userId!,
          action: "delete",
          resource: `file:${input.id}`,
        });

        logger.info("File soft-deleted", {
          fileId: input.id,
          organizationId: ctx.organizationId,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error deleting file", error, {
          fileId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete file",
        });
      }
    }),

  getDetections: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const detections = (await ctx.prisma.$queryRawUnsafe(
          `SELECT d.id, d.label, d.confidence, d.bbox, d.created_at
           FROM detections d
           JOIN files f ON f.id = d.file_id
           WHERE d.file_id = $1 AND f.organization_id = $2 AND f.deleted_at IS NULL
           ORDER BY d.confidence DESC`,
          input.fileId,
          ctx.organizationId,
        )) as Array<{
          id: string;
          label: string;
          confidence: number;
          bbox: unknown;
          created_at: Date;
        }>;

        return detections.map((d) => ({
          id: d.id,
          label: d.label,
          confidence: d.confidence,
          bbox: d.bbox,
          createdAt: d.created_at,
        }));
      } catch (error) {
        logger.error("Error fetching detections", error, {
          fileId: input.fileId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch detections for file",
        });
      }
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const url = await getSignedDownloadUrl(input.key);
        return { url, expiresIn: 3600 };
      } catch (error) {
        logger.error("Error generating download URL", error, {
          key: input.key,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate download URL",
        });
      }
    }),
});
