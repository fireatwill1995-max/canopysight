import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createVideoClipSchema } from "@canopy-sight/validators";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

// This would integrate with S3 or your storage service
// For now, we'll return placeholder signed URLs
async function generateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<{
  url: string;
  expiresAt: Date;
}> {
  // TODO: Implement actual S3 signed URL generation
  // const s3 = new S3Client({ ... });
  // const command = new GetObjectCommand({ ... });
  // const url = await getSignedUrl(s3, command, { expiresIn });

  return {
    url: `https://storage.example.com/${filePath}?expires=${Date.now() + expiresIn * 1000}`,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

export const videoRouter = router({
  create: protectedProcedure.input(createVideoClipSchema).mutation(async ({ ctx, input }) => {
    try {
      const clip = await ctx.prisma.videoClip.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
        },
        include: {
          site: true,
          device: true,
        },
      });

      logger.info("Video clip created", {
        clipId: clip.id,
        organizationId: ctx.organizationId,
        siteId: clip.siteId,
      });

      return clip;
    } catch (error) {
      logger.error("Error creating video clip", error, {
        organizationId: ctx.organizationId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create video clip",
      });
    }
  }),

  getSignedUrl: protectedProcedure
    .input(
      z.object({
        clipId: z.string(),
        expiresIn: z.number().min(60).max(86400).default(3600),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clip = await ctx.prisma.videoClip.findFirst({
          where: {
            id: input.clipId,
            organizationId: ctx.organizationId,
          },
        });

        if (!clip) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Video clip not found" });
        }

        const signedUrl = await generateSignedUrl(clip.filePath, input.expiresIn);

        return signedUrl;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error generating signed URL", error, {
          clipId: input.clipId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate signed URL",
        });
      }
    }),

  getThumbnailUrl: protectedProcedure
    .input(
      z.object({
        clipId: z.string(),
        expiresIn: z.number().min(60).max(86400).default(3600),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clip = await ctx.prisma.videoClip.findFirst({
          where: {
            id: input.clipId,
            organizationId: ctx.organizationId,
          },
        });

        if (!clip) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Video clip not found" });
        }

        if (!clip.thumbnailPath) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Thumbnail not available" });
        }

        const signedUrl = await generateSignedUrl(clip.thumbnailPath, input.expiresIn);

        return signedUrl;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("Error generating thumbnail URL", error, {
          clipId: input.clipId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate thumbnail URL",
        });
      }
    }),
});
