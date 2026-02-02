import { z } from "zod";

export const detectionTypeSchema = z.enum(["person", "vehicle", "animal", "unknown"]);

export const detectionEventSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  siteId: z.string(),
  type: detectionTypeSchema,
  confidence: z.number().min(0).max(1),
  timestamp: z.date(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  zoneIds: z.array(z.string()).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  videoClipId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string(),
  createdAt: z.date(),
});

export const createDetectionEventSchema = detectionEventSchema.omit({
  id: true,
  createdAt: true,
  organizationId: true,
});

export const detectionListQuerySchema = z.object({
  siteId: z.string().optional(),
  deviceId: z.string().optional(),
  // Accept ISO date strings and coerce to Date objects (tRPC serializes dates as strings over HTTP)
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  types: z.array(detectionTypeSchema).optional(),
  minRiskScore: z.number().min(0).max(100).optional(),
  zones: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type DetectionEvent = z.infer<typeof detectionEventSchema>;
export type DetectionType = z.infer<typeof detectionTypeSchema>;
export type CreateDetectionEventInput = z.infer<typeof createDetectionEventSchema>;
export type DetectionListQuery = z.infer<typeof detectionListQuerySchema>;
