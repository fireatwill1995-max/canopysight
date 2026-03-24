"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectionListQuerySchema = exports.createDetectionEventSchema = exports.detectionEventSchema = exports.detectionTypeSchema = void 0;
const zod_1 = require("zod");
exports.detectionTypeSchema = zod_1.z.enum(["person", "vehicle", "animal", "unknown"]);
exports.detectionEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    deviceId: zod_1.z.string(),
    siteId: zod_1.z.string(),
    type: exports.detectionTypeSchema,
    confidence: zod_1.z.number().min(0).max(1),
    timestamp: zod_1.z.date(),
    boundingBox: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        width: zod_1.z.number(),
        height: zod_1.z.number(),
    }),
    zoneIds: zod_1.z.array(zod_1.z.string()).optional(),
    riskScore: zod_1.z.number().min(0).max(100).optional(),
    videoClipId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    organizationId: zod_1.z.string(),
    createdAt: zod_1.z.date(),
});
exports.createDetectionEventSchema = exports.detectionEventSchema.omit({
    id: true,
    createdAt: true,
    organizationId: true,
});
exports.detectionListQuerySchema = zod_1.z.object({
    siteId: zod_1.z.string().optional(),
    deviceId: zod_1.z.string().optional(),
    // Accept ISO date strings and coerce to Date objects (tRPC serializes dates as strings over HTTP)
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
    types: zod_1.z.array(exports.detectionTypeSchema).optional(),
    minRiskScore: zod_1.z.number().min(0).max(100).optional(),
    zones: zod_1.z.array(zod_1.z.string()).optional(),
    limit: zod_1.z.number().min(1).max(100).default(50),
    cursor: zod_1.z.string().optional(),
});
