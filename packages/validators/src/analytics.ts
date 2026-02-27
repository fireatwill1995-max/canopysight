import { z } from "zod";

export const heatmapDataPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  intensity: z.number().min(0).max(1),
  timestamp: z.date(),
});

export const heatmapQuerySchema = z.object({
  siteId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  resolution: z.number().min(10).max(1000).default(100),
}).refine((d) => d.endDate >= d.startDate, {
  message: "endDate must be after startDate",
  path: ["endDate"],
});

export const analyticsTimeRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  siteId: z.string().optional(),
}).refine((d) => d.endDate >= d.startDate, {
  message: "endDate must be after startDate",
  path: ["endDate"],
});

export const occupancyByZoneSchema = z.object({
  siteId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine((d) => d.endDate >= d.startDate, {
  message: "endDate must be after startDate",
  path: ["endDate"],
});

export const timeOfDayPressureSchema = z.object({
  siteId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine((d) => d.endDate >= d.startDate, {
  message: "endDate must be after startDate",
  path: ["endDate"],
});

export type HeatmapDataPoint = z.infer<typeof heatmapDataPointSchema>;
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
export type AnalyticsTimeRange = z.infer<typeof analyticsTimeRangeSchema>;
export type OccupancyByZoneInput = z.infer<typeof occupancyByZoneSchema>;
export type TimeOfDayPressureInput = z.infer<typeof timeOfDayPressureSchema>;
