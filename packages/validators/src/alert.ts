import { z } from "zod";

export const alertSeveritySchema = z.enum(["advisory", "warning", "critical"]);

export const alertStatusSchema = z.enum([
  "active",
  "acknowledged",
  "resolved",
  "dismissed",
]);

export const alertSchema = z.object({
  id: z.string(),
  detectionEventId: z.string().optional(),
  siteId: z.string(),
  deviceId: z.string().optional(),
  severity: alertSeveritySchema,
  status: alertStatusSchema,
  title: z.string(),
  message: z.string(),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createAlertSchema = alertSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acknowledgedBy: true,
  acknowledgedAt: true,
  resolvedAt: true,
  organizationId: true,
});

export const updateAlertSchema = createAlertSchema.partial().extend({
  status: alertStatusSchema.optional(),
});

export const alertSubscriptionSchema = z.object({
  siteIds: z.array(z.string()).optional(),
  minSeverity: alertSeveritySchema.optional(),
});

export type Alert = z.infer<typeof alertSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type AlertStatus = z.infer<typeof alertStatusSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
export type AlertSubscription = z.infer<typeof alertSubscriptionSchema>;
