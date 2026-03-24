"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateZoneSchema = exports.createZoneSchema = exports.zoneSchema = exports.pointSchema = exports.zoneTypeSchema = void 0;
const zod_1 = require("zod");
exports.zoneTypeSchema = zod_1.z.enum([
    "crossing",
    "approach",
    "exclusion",
    "custom",
]);
exports.pointSchema = zod_1.z.object({
    x: zod_1.z.number(),
    y: zod_1.z.number(),
});
exports.zoneSchema = zod_1.z.object({
    id: zod_1.z.string(),
    siteId: zod_1.z.string(),
    name: zod_1.z.string().min(1).max(255),
    type: exports.zoneTypeSchema,
    points: zod_1.z.array(exports.pointSchema).min(3),
    cameraId: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().default(true),
    sensitivity: zod_1.z.number().min(0).max(100).default(50),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    organizationId: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createZoneSchema = exports.zoneSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    organizationId: true,
});
exports.updateZoneSchema = exports.createZoneSchema.partial();
