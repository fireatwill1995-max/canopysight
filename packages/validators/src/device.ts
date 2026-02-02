import { z } from "zod";
import type { MeshTopology } from "./meshconnect";

export const deviceStatusSchema = z.enum([
  "online",
  "offline",
  "maintenance",
  "error",
]);

export const deviceTypeSchema = z.enum(["camera", "meshconnect"]);

export const deviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  siteId: z.string(),
  serialNumber: z.string().optional(),
  firmwareVersion: z.string().optional(),
  status: deviceStatusSchema,
  lastHeartbeat: z.date().optional(),
  ipAddress: z
    .union([z.string().ip(), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  macAddress: z.string().optional(),
  deviceType: deviceTypeSchema,
  // Accept any non-empty string (YouTube, RTSP, HLS, etc.) so stream URLs are always picked up
  streamUrl: z
    .string()
    .optional()
    .transform((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : (typeof v === "string" ? v.trim() : v))),
  organizationId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createDeviceSchema = deviceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastHeartbeat: true,
  organizationId: true,
});

export const updateDeviceSchema = createDeviceSchema.partial();

// Camera configuration schemas
export const cameraConfigSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  cameraIndex: z.number().int().min(0),
  name: z.string().max(255).optional(),
  resolution: z.string().max(64).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  fov: z.record(z.unknown()).optional(),
  is360: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createCameraConfigSchema = cameraConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCameraConfigSchema = createCameraConfigSchema.partial();

// MeshConnect configuration schemas
export const meshConnectFrequencyBandSchema = z.enum([
  "1.35-1.44",
  "2.20-2.50",
  "dual",
]);

export const meshConnectNodeStatusSchema = z.enum([
  "connected",
  "disconnected",
  "syncing",
  "error",
]);

export const meshConnectConfigSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  frequencyBand: meshConnectFrequencyBandSchema,
  throughput: z.number().int().positive().max(100).optional(),
  latency: z.number().positive().optional(),
  encryptionEnabled: z.boolean(),
  encryptionKey: z.string().optional(),
  meshNodeId: z.string().optional(),
  parentNodeId: z.string().optional(),
  networkTopology: z.custom<MeshTopology>().optional(),
  wifiEnabled: z.boolean(),
  wifiSSID: z.string().optional(),
  wifiPassword: z.string().optional(),
  ethernetPorts: z.number().int().positive().optional(),
  isGateway: z.boolean(),
  gatewayAddress: z.string().ip().optional(),
  nodeStatus: meshConnectNodeStatusSchema,
  lastSyncTime: z.date().optional(),
  signalStrength: z.number().optional(),
  neighborNodes: z.array(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createMeshConnectConfigSchema = meshConnectConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMeshConnectConfigSchema = createMeshConnectConfigSchema.partial();

export type Device = z.infer<typeof deviceSchema>;
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;
export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type CameraConfig = z.infer<typeof cameraConfigSchema>;
export type CreateCameraConfigInput = z.infer<typeof createCameraConfigSchema>;
export type UpdateCameraConfigInput = z.infer<typeof updateCameraConfigSchema>;
export type MeshConnectConfig = z.infer<typeof meshConnectConfigSchema>;
export type CreateMeshConnectConfigInput = z.infer<typeof createMeshConnectConfigSchema>;
export type UpdateMeshConnectConfigInput = z.infer<typeof updateMeshConnectConfigSchema>;
