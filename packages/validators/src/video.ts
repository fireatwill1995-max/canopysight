import { z } from "zod";

export const videoClipSchema = z.object({
  id: z.string(),
  detectionEventId: z.string().optional(),
  deviceId: z.string(),
  siteId: z.string(),
  filePath: z.string(),
  thumbnailPath: z.string().optional(),
  duration: z.number().positive(),
  startTime: z.date(),
  endTime: z.date(),
  fileSize: z.number().positive(),
  mimeType: z.string(),
  organizationId: z.string(),
  createdAt: z.date(),
});

export const createVideoClipSchema = videoClipSchema.omit({
  id: true,
  createdAt: true,
});

export const signedUrlSchema = z.object({
  url: z.string().url(),
  expiresAt: z.date(),
});

export type VideoClip = z.infer<typeof videoClipSchema>;
export type CreateVideoClipInput = z.infer<typeof createVideoClipSchema>;
export type SignedUrl = z.infer<typeof signedUrlSchema>;
