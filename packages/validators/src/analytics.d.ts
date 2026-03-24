import { z } from "zod";
export declare const heatmapDataPointSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    intensity: z.ZodNumber;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    x: number;
    y: number;
    intensity: number;
}, {
    timestamp: Date;
    x: number;
    y: number;
    intensity: number;
}>;
export declare const heatmapQuerySchema: z.ZodEffects<z.ZodObject<{
    siteId: z.ZodString;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    resolution: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    siteId: string;
    resolution: number;
    startDate: Date;
    endDate: Date;
}, {
    siteId: string;
    startDate: Date;
    endDate: Date;
    resolution?: number | undefined;
}>, {
    siteId: string;
    resolution: number;
    startDate: Date;
    endDate: Date;
}, {
    siteId: string;
    startDate: Date;
    endDate: Date;
    resolution?: number | undefined;
}>;
export declare const analyticsTimeRangeSchema: z.ZodEffects<z.ZodObject<{
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    siteId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}>, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}>;
export declare const occupancyByZoneSchema: z.ZodEffects<z.ZodObject<{
    siteId: z.ZodString;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    siteId: string;
    startDate: Date;
    endDate: Date;
}, {
    siteId: string;
    startDate: Date;
    endDate: Date;
}>, {
    siteId: string;
    startDate: Date;
    endDate: Date;
}, {
    siteId: string;
    startDate: Date;
    endDate: Date;
}>;
export declare const timeOfDayPressureSchema: z.ZodEffects<z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}>, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    siteId?: string | undefined;
}>;
export type HeatmapDataPoint = z.infer<typeof heatmapDataPointSchema>;
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
export type AnalyticsTimeRange = z.infer<typeof analyticsTimeRangeSchema>;
export type OccupancyByZoneInput = z.infer<typeof occupancyByZoneSchema>;
export type TimeOfDayPressureInput = z.infer<typeof timeOfDayPressureSchema>;
//# sourceMappingURL=analytics.d.ts.map