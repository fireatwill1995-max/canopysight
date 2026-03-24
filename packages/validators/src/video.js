"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signedUrlSchema = exports.createVideoClipSchema = exports.videoClipSchema = void 0;
const zod_1 = require("zod");
exports.videoClipSchema = zod_1.z.object({
    id: zod_1.z.string(),
    detectionEventId: zod_1.z.string().optional(),
    deviceId: zod_1.z.string(),
    siteId: zod_1.z.string(),
    filePath: zod_1.z.string(),
    thumbnailPath: zod_1.z.string().optional(),
    duration: zod_1.z.number().positive(),
    startTime: zod_1.z.date(),
    endTime: zod_1.z.date(),
    fileSize: zod_1.z.number().positive(),
    mimeType: zod_1.z.string(),
    organizationId: zod_1.z.string(),
    createdAt: zod_1.z.date(),
});
exports.createVideoClipSchema = exports.videoClipSchema.omit({
    id: true,
    createdAt: true,
    organizationId: true,
});
exports.signedUrlSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    expiresAt: zod_1.z.date(),
});
