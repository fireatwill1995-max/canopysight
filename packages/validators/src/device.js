"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMeshConnectConfigSchema = exports.createMeshConnectConfigSchema = exports.meshConnectConfigSchema = exports.meshConnectNodeStatusSchema = exports.meshConnectFrequencyBandSchema = exports.updateCameraConfigSchema = exports.createCameraConfigSchema = exports.cameraConfigSchema = exports.updateDeviceSchema = exports.createDeviceSchema = exports.deviceSchema = exports.deviceTypeSchema = exports.deviceStatusSchema = void 0;
const zod_1 = require("zod");
exports.deviceStatusSchema = zod_1.z.enum([
    "online",
    "offline",
    "maintenance",
    "error",
]);
exports.deviceTypeSchema = zod_1.z.enum(["camera", "meshconnect"]);
exports.deviceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().min(1).max(255),
    siteId: zod_1.z.string(),
    serialNumber: zod_1.z.string().optional(),
    firmwareVersion: zod_1.z.string().optional(),
    status: exports.deviceStatusSchema,
    lastHeartbeat: zod_1.z.date().optional(),
    ipAddress: zod_1.z
        .union([zod_1.z.string().ip(), zod_1.z.literal("")])
        .optional()
        .transform((v) => (v === "" ? undefined : v)),
    macAddress: zod_1.z.string().optional(),
    deviceType: exports.deviceTypeSchema,
    // Accept any non-empty string (YouTube, RTSP, HLS, etc.) so stream URLs are always picked up
    streamUrl: zod_1.z
        .string()
        .optional()
        .transform((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : (typeof v === "string" ? v.trim() : v))),
    organizationId: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createDeviceSchema = exports.deviceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastHeartbeat: true,
    organizationId: true,
});
exports.updateDeviceSchema = exports.createDeviceSchema.partial();
// Camera configuration schemas
exports.cameraConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    deviceId: zod_1.z.string(),
    cameraIndex: zod_1.z.number().int().min(0),
    name: zod_1.z.string().max(255).optional(),
    resolution: zod_1.z.string().max(64).optional(),
    fps: zod_1.z.number().int().min(1).max(120).optional(),
    fov: zod_1.z.record(zod_1.z.unknown()).optional(),
    is360: zod_1.z.boolean(),
    isActive: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createCameraConfigSchema = exports.cameraConfigSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.updateCameraConfigSchema = exports.createCameraConfigSchema.partial();
// MeshConnect configuration schemas
exports.meshConnectFrequencyBandSchema = zod_1.z.enum([
    "1.35-1.44",
    "2.20-2.50",
    "dual",
]);
exports.meshConnectNodeStatusSchema = zod_1.z.enum([
    "connected",
    "disconnected",
    "syncing",
    "error",
]);
exports.meshConnectConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    deviceId: zod_1.z.string(),
    frequencyBand: exports.meshConnectFrequencyBandSchema,
    throughput: zod_1.z.number().int().positive().max(100).optional(),
    latency: zod_1.z.number().positive().optional(),
    encryptionEnabled: zod_1.z.boolean(),
    encryptionKey: zod_1.z.string().optional(),
    meshNodeId: zod_1.z.string().optional(),
    parentNodeId: zod_1.z.string().optional(),
    networkTopology: zod_1.z.custom().optional(),
    wifiEnabled: zod_1.z.boolean(),
    wifiSSID: zod_1.z.string().optional(),
    wifiPassword: zod_1.z.string().optional(),
    ethernetPorts: zod_1.z.number().int().positive().optional(),
    isGateway: zod_1.z.boolean(),
    gatewayAddress: zod_1.z.string().ip().optional(),
    nodeStatus: exports.meshConnectNodeStatusSchema,
    lastSyncTime: zod_1.z.date().optional(),
    signalStrength: zod_1.z.number().optional(),
    neighborNodes: zod_1.z.array(zod_1.z.string()).optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createMeshConnectConfigSchema = exports.meshConnectConfigSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.updateMeshConnectConfigSchema = exports.createMeshConnectConfigSchema.partial();
