"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateIncidentSchema = exports.createIncidentSchema = exports.contributingConditionsSchema = void 0;
const zod_1 = require("zod");
/** Contributing conditions for incident reconstruction & learning */
exports.contributingConditionsSchema = zod_1.z.object({
    crowding: zod_1.z.boolean().optional(),
    crowdingLevel: zod_1.z.number().min(0).max(100).optional(),
    zoneIds: zod_1.z.array(zod_1.z.string()).optional(),
    layoutNotes: zod_1.z.string().optional(),
    timeOfDay: zod_1.z.string().optional(),
    hourOfDay: zod_1.z.number().min(0).max(23).optional(),
}).optional();
exports.createIncidentSchema = zod_1.z.object({
    siteId: zod_1.z.string().min(1, "Site ID is required"),
    title: zod_1.z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
    description: zod_1.z.string().min(1, "Description is required").max(5000, "Description must be less than 5000 characters"),
    severity: zod_1.z.enum(["low", "medium", "high", "critical"], {
        errorMap: () => ({ message: "Severity must be low, medium, high, or critical" }),
    }),
    reportedBy: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    contributingConditions: exports.contributingConditionsSchema,
});
exports.updateIncidentSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, "Incident ID is required"),
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().min(1).max(5000).optional(),
    severity: zod_1.z.enum(["low", "medium", "high", "critical"]).optional(),
    resolvedAt: zod_1.z.coerce.date().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    contributingConditions: exports.contributingConditionsSchema,
});
