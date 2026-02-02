import { z } from "zod";

export const siteSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  organizationId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createSiteSchema = siteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
});

export const updateSiteSchema = createSiteSchema.partial();

export type Site = z.infer<typeof siteSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
