import { z } from "zod";

export const heatmapDataPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  intensity: z.number().min(0).max(1),
  timestamp: z.date(),
});

export const heatmapQuerySchema = z.object({
  siteId: z.string(),
  // Accept ISO date strings and coerce to Date objects (tRPC serializes dates as strings over HTTP)
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  resolution: z.number().min(10).max(1000).default(100),
});

export const analyticsTimeRangeSchema = z.object({
  // Accept ISO date strings and coerce to Date objects (tRPC serializes dates as strings over HTTP)
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  siteId: z.string().optional(),
});

export type HeatmapDataPoint = z.infer<typeof heatmapDataPointSchema>;
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
export type AnalyticsTimeRange = z.infer<typeof analyticsTimeRangeSchema>;
