"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSiteSchema = exports.createSiteSchema = exports.siteSchema = void 0;
const zod_1 = require("zod");
exports.siteSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    organizationId: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createSiteSchema = exports.siteSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    organizationId: true,
});
exports.updateSiteSchema = exports.createSiteSchema.partial();
