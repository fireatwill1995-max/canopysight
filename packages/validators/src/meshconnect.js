"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meshTopologySchema = exports.meshTopologyEdgeSchema = exports.meshTopologyNodeSchema = void 0;
const zod_1 = require("zod");
/**
 * MeshConnect network topology type
 */
exports.meshTopologyNodeSchema = zod_1.z.object({
    nodeId: zod_1.z.string(),
    deviceId: zod_1.z.string(),
    ipAddress: zod_1.z.string().ip().optional(),
    status: zod_1.z.string(),
    neighbors: zod_1.z.array(zod_1.z.string()),
    signalStrength: zod_1.z.number().optional(),
    latency: zod_1.z.number().optional(),
    throughput: zod_1.z.number().optional(),
});
exports.meshTopologyEdgeSchema = zod_1.z.object({
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    signalStrength: zod_1.z.number().optional(),
    latency: zod_1.z.number().optional(),
});
exports.meshTopologySchema = zod_1.z.object({
    nodes: zod_1.z.array(exports.meshTopologyNodeSchema),
    edges: zod_1.z.array(exports.meshTopologyEdgeSchema),
});
