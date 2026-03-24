"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertSubscriptionSchema = exports.updateAlertSchema = exports.createAlertSchema = exports.alertSchema = exports.alertStatusSchema = exports.alertSeveritySchema = void 0;
const zod_1 = require("zod");
exports.alertSeveritySchema = zod_1.z.enum(["advisory", "warning", "critical"]);
exports.alertStatusSchema = zod_1.z.enum([
    "active",
    "acknowledged",
    "resolved",
    "dismissed",
]);
exports.alertSchema = zod_1.z.object({
    id: zod_1.z.string(),
    detectionEventId: zod_1.z.string().optional(),
    siteId: zod_1.z.string(),
    deviceId: zod_1.z.string().optional(),
    severity: exports.alertSeveritySchema,
    status: exports.alertStatusSchema,
    title: zod_1.z.string(),
    message: zod_1.z.string(),
    acknowledgedBy: zod_1.z.string().optional(),
    acknowledgedAt: zod_1.z.date().optional(),
    resolvedAt: zod_1.z.date().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    organizationId: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createAlertSchema = exports.alertSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    acknowledgedBy: true,
    acknowledgedAt: true,
    resolvedAt: true,
    organizationId: true,
});
exports.updateAlertSchema = exports.createAlertSchema.partial().extend({
    status: exports.alertStatusSchema.optional(),
});
exports.alertSubscriptionSchema = zod_1.z.object({
    siteIds: zod_1.z.array(zod_1.z.string()).optional(),
    minSeverity: exports.alertSeveritySchema.optional(),
});
