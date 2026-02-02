import { z } from "zod";

export const zoneTypeSchema = z.enum([
  "crossing",
  "approach",
  "exclusion",
  "custom",
]);

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const zoneSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string().min(1).max(255),
  type: zoneTypeSchema,
  points: z.array(pointSchema).min(3),
  cameraId: z.string().optional(),
  isActive: z.boolean().default(true),
  sensitivity: z.number().min(0).max(100).default(50),
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createZoneSchema = zoneSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
});

export const updateZoneSchema = createZoneSchema.partial();

export type Zone = z.infer<typeof zoneSchema>;
export type ZoneType = z.infer<typeof zoneTypeSchema>;
export type Point = z.infer<typeof pointSchema>;
export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
