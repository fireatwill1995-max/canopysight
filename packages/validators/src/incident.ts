import { z } from "zod";

/** Contributing conditions for incident reconstruction & learning */
export const contributingConditionsSchema = z.object({
  crowding: z.boolean().optional(),
  crowdingLevel: z.number().min(0).max(100).optional(),
  zoneIds: z.array(z.string()).optional(),
  layoutNotes: z.string().optional(),
  timeOfDay: z.string().optional(),
  hourOfDay: z.number().min(0).max(23).optional(),
}).optional();

export const createIncidentSchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().min(1, "Description is required").max(5000, "Description must be less than 5000 characters"),
  severity: z.enum(["low", "medium", "high", "critical"], {
    errorMap: () => ({ message: "Severity must be low, medium, high, or critical" }),
  }),
  reportedBy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  contributingConditions: contributingConditionsSchema,
});

export const updateIncidentSchema = z.object({
  id: z.string().min(1, "Incident ID is required"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  resolvedAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  contributingConditions: contributingConditionsSchema,
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
