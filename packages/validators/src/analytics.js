"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeOfDayPressureSchema = exports.occupancyByZoneSchema = exports.analyticsTimeRangeSchema = exports.heatmapQuerySchema = exports.heatmapDataPointSchema = void 0;
const zod_1 = require("zod");
exports.heatmapDataPointSchema = zod_1.z.object({
    x: zod_1.z.number(),
    y: zod_1.z.number(),
    intensity: zod_1.z.number().min(0).max(1),
    timestamp: zod_1.z.date(),
});
exports.heatmapQuerySchema = zod_1.z.object({
    siteId: zod_1.z.string(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    resolution: zod_1.z.number().min(10).max(1000).default(100),
}).refine((d) => d.endDate >= d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
});
exports.analyticsTimeRangeSchema = zod_1.z.object({
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    siteId: zod_1.z.string().optional(),
}).refine((d) => d.endDate >= d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
});
exports.occupancyByZoneSchema = zod_1.z.object({
    siteId: zod_1.z.string(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
}).refine((d) => d.endDate >= d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
});
exports.timeOfDayPressureSchema = zod_1.z.object({
    siteId: zod_1.z.string().optional(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
}).refine((d) => d.endDate >= d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
});
