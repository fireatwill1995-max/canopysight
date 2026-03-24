import { z } from "zod";
export declare const deviceStatusSchema: z.ZodEnum<["online", "offline", "maintenance", "error"]>;
export declare const deviceTypeSchema: z.ZodEnum<["camera", "meshconnect"]>;
export declare const deviceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    siteId: z.ZodString;
    serialNumber: z.ZodOptional<z.ZodString>;
    firmwareVersion: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["online", "offline", "maintenance", "error"]>;
    lastHeartbeat: z.ZodOptional<z.ZodDate>;
    ipAddress: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>, string | undefined, string | undefined>;
    macAddress: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodEnum<["camera", "meshconnect"]>;
    streamUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "online" | "offline" | "maintenance";
    siteId: string;
    deviceType: "camera" | "meshconnect";
    ipAddress?: string | undefined;
    serialNumber?: string | undefined;
    firmwareVersion?: string | undefined;
    lastHeartbeat?: Date | undefined;
    macAddress?: string | undefined;
    streamUrl?: string | undefined;
}, {
    organizationId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "online" | "offline" | "maintenance";
    siteId: string;
    deviceType: "camera" | "meshconnect";
    ipAddress?: string | undefined;
    serialNumber?: string | undefined;
    firmwareVersion?: string | undefined;
    lastHeartbeat?: Date | undefined;
    macAddress?: string | undefined;
    streamUrl?: string | undefined;
}>;
export declare const createDeviceSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    siteId: z.ZodString;
    serialNumber: z.ZodOptional<z.ZodString>;
    firmwareVersion: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["online", "offline", "maintenance", "error"]>;
    lastHeartbeat: z.ZodOptional<z.ZodDate>;
    ipAddress: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>, string | undefined, string | undefined>;
    macAddress: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodEnum<["camera", "meshconnect"]>;
    streamUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    organizationId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "organizationId" | "id" | "createdAt" | "updatedAt" | "lastHeartbeat">, "strip", z.ZodTypeAny, {
    name: string;
    status: "error" | "online" | "offline" | "maintenance";
    siteId: string;
    deviceType: "camera" | "meshconnect";
    ipAddress?: string | undefined;
    serialNumber?: string | undefined;
    firmwareVersion?: string | undefined;
    macAddress?: string | undefined;
    streamUrl?: string | undefined;
}, {
    name: string;
    status: "error" | "online" | "offline" | "maintenance";
    siteId: string;
    deviceType: "camera" | "meshconnect";
    ipAddress?: string | undefined;
    serialNumber?: string | undefined;
    firmwareVersion?: string | undefined;
    macAddress?: string | undefined;
    streamUrl?: string | undefined;
}>;
export declare const updateDeviceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["online", "offline", "maintenance", "error"]>>;
    ipAddress: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>, string | undefined, string | undefined>>;
    siteId: z.ZodOptional<z.ZodString>;
    serialNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    firmwareVersion: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    macAddress: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    deviceType: z.ZodOptional<z.ZodEnum<["camera", "meshconnect"]>>;
    streamUrl: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: "error" | "online" | "offline" | "maintenance" | undefined;
    ipAddress?: string | undefined;
    siteId?: string | undefined;
    serialNumber?: string | undefined;
    firmwareVersion?: string | undefined;
    macAddress?: string | undefined;
    deviceType?: "camera" | "meshconnect" | undefined;
    streamUrl?: string | undefined;
}, {
    name?: string | undefined;
    status?: "error" | "online" | "offline" | "maintenance" | undefined;
    ipAddress?: string | undefined;
    siteId?: string | undefined;
    serialNumber?: string | undefined;
    firmwareVersion?: string | undefined;
    macAddress?: string | undefined;
    deviceType?: "camera" | "meshconnect" | undefined;
    streamUrl?: string | undefined;
}>;
export declare const cameraConfigSchema: z.ZodObject<{
    id: z.ZodString;
    deviceId: z.ZodString;
    cameraIndex: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    resolution: z.ZodOptional<z.ZodString>;
    fps: z.ZodOptional<z.ZodNumber>;
    fov: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is360: z.ZodBoolean;
    isActive: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deviceId: string;
    cameraIndex: number;
    is360: boolean;
    isActive: boolean;
    name?: string | undefined;
    resolution?: string | undefined;
    fps?: number | undefined;
    fov?: Record<string, unknown> | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deviceId: string;
    cameraIndex: number;
    is360: boolean;
    isActive: boolean;
    name?: string | undefined;
    resolution?: string | undefined;
    fps?: number | undefined;
    fov?: Record<string, unknown> | undefined;
}>;
export declare const createCameraConfigSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    deviceId: z.ZodString;
    cameraIndex: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    resolution: z.ZodOptional<z.ZodString>;
    fps: z.ZodOptional<z.ZodNumber>;
    fov: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is360: z.ZodBoolean;
    isActive: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    deviceId: string;
    cameraIndex: number;
    is360: boolean;
    isActive: boolean;
    name?: string | undefined;
    resolution?: string | undefined;
    fps?: number | undefined;
    fov?: Record<string, unknown> | undefined;
}, {
    deviceId: string;
    cameraIndex: number;
    is360: boolean;
    isActive: boolean;
    name?: string | undefined;
    resolution?: string | undefined;
    fps?: number | undefined;
    fov?: Record<string, unknown> | undefined;
}>;
export declare const updateCameraConfigSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    deviceId: z.ZodOptional<z.ZodString>;
    cameraIndex: z.ZodOptional<z.ZodNumber>;
    resolution: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fps: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    fov: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    is360: z.ZodOptional<z.ZodBoolean>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    deviceId?: string | undefined;
    cameraIndex?: number | undefined;
    resolution?: string | undefined;
    fps?: number | undefined;
    fov?: Record<string, unknown> | undefined;
    is360?: boolean | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    deviceId?: string | undefined;
    cameraIndex?: number | undefined;
    resolution?: string | undefined;
    fps?: number | undefined;
    fov?: Record<string, unknown> | undefined;
    is360?: boolean | undefined;
    isActive?: boolean | undefined;
}>;
export declare const meshConnectFrequencyBandSchema: z.ZodEnum<["1.35-1.44", "2.20-2.50", "dual"]>;
export declare const meshConnectNodeStatusSchema: z.ZodEnum<["connected", "disconnected", "syncing", "error"]>;
export declare const meshConnectConfigSchema: z.ZodObject<{
    id: z.ZodString;
    deviceId: z.ZodString;
    frequencyBand: z.ZodEnum<["1.35-1.44", "2.20-2.50", "dual"]>;
    throughput: z.ZodOptional<z.ZodNumber>;
    latency: z.ZodOptional<z.ZodNumber>;
    encryptionEnabled: z.ZodBoolean;
    encryptionKey: z.ZodOptional<z.ZodString>;
    meshNodeId: z.ZodOptional<z.ZodString>;
    parentNodeId: z.ZodOptional<z.ZodString>;
    networkTopology: z.ZodOptional<z.ZodType<{
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    }, z.ZodTypeDef, {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    }>>;
    wifiEnabled: z.ZodBoolean;
    wifiSSID: z.ZodOptional<z.ZodString>;
    wifiPassword: z.ZodOptional<z.ZodString>;
    ethernetPorts: z.ZodOptional<z.ZodNumber>;
    isGateway: z.ZodBoolean;
    gatewayAddress: z.ZodOptional<z.ZodString>;
    nodeStatus: z.ZodEnum<["connected", "disconnected", "syncing", "error"]>;
    lastSyncTime: z.ZodOptional<z.ZodDate>;
    signalStrength: z.ZodOptional<z.ZodNumber>;
    neighborNodes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deviceId: string;
    frequencyBand: "1.35-1.44" | "2.20-2.50" | "dual";
    encryptionEnabled: boolean;
    wifiEnabled: boolean;
    isGateway: boolean;
    nodeStatus: "error" | "connected" | "disconnected" | "syncing";
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
    encryptionKey?: string | undefined;
    meshNodeId?: string | undefined;
    parentNodeId?: string | undefined;
    networkTopology?: {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    } | undefined;
    wifiSSID?: string | undefined;
    wifiPassword?: string | undefined;
    ethernetPorts?: number | undefined;
    gatewayAddress?: string | undefined;
    lastSyncTime?: Date | undefined;
    neighborNodes?: string[] | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deviceId: string;
    frequencyBand: "1.35-1.44" | "2.20-2.50" | "dual";
    encryptionEnabled: boolean;
    wifiEnabled: boolean;
    isGateway: boolean;
    nodeStatus: "error" | "connected" | "disconnected" | "syncing";
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
    encryptionKey?: string | undefined;
    meshNodeId?: string | undefined;
    parentNodeId?: string | undefined;
    networkTopology?: {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    } | undefined;
    wifiSSID?: string | undefined;
    wifiPassword?: string | undefined;
    ethernetPorts?: number | undefined;
    gatewayAddress?: string | undefined;
    lastSyncTime?: Date | undefined;
    neighborNodes?: string[] | undefined;
}>;
export declare const createMeshConnectConfigSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    deviceId: z.ZodString;
    frequencyBand: z.ZodEnum<["1.35-1.44", "2.20-2.50", "dual"]>;
    throughput: z.ZodOptional<z.ZodNumber>;
    latency: z.ZodOptional<z.ZodNumber>;
    encryptionEnabled: z.ZodBoolean;
    encryptionKey: z.ZodOptional<z.ZodString>;
    meshNodeId: z.ZodOptional<z.ZodString>;
    parentNodeId: z.ZodOptional<z.ZodString>;
    networkTopology: z.ZodOptional<z.ZodType<{
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    }, z.ZodTypeDef, {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    }>>;
    wifiEnabled: z.ZodBoolean;
    wifiSSID: z.ZodOptional<z.ZodString>;
    wifiPassword: z.ZodOptional<z.ZodString>;
    ethernetPorts: z.ZodOptional<z.ZodNumber>;
    isGateway: z.ZodBoolean;
    gatewayAddress: z.ZodOptional<z.ZodString>;
    nodeStatus: z.ZodEnum<["connected", "disconnected", "syncing", "error"]>;
    lastSyncTime: z.ZodOptional<z.ZodDate>;
    signalStrength: z.ZodOptional<z.ZodNumber>;
    neighborNodes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    deviceId: string;
    frequencyBand: "1.35-1.44" | "2.20-2.50" | "dual";
    encryptionEnabled: boolean;
    wifiEnabled: boolean;
    isGateway: boolean;
    nodeStatus: "error" | "connected" | "disconnected" | "syncing";
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
    encryptionKey?: string | undefined;
    meshNodeId?: string | undefined;
    parentNodeId?: string | undefined;
    networkTopology?: {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    } | undefined;
    wifiSSID?: string | undefined;
    wifiPassword?: string | undefined;
    ethernetPorts?: number | undefined;
    gatewayAddress?: string | undefined;
    lastSyncTime?: Date | undefined;
    neighborNodes?: string[] | undefined;
}, {
    deviceId: string;
    frequencyBand: "1.35-1.44" | "2.20-2.50" | "dual";
    encryptionEnabled: boolean;
    wifiEnabled: boolean;
    isGateway: boolean;
    nodeStatus: "error" | "connected" | "disconnected" | "syncing";
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
    encryptionKey?: string | undefined;
    meshNodeId?: string | undefined;
    parentNodeId?: string | undefined;
    networkTopology?: {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    } | undefined;
    wifiSSID?: string | undefined;
    wifiPassword?: string | undefined;
    ethernetPorts?: number | undefined;
    gatewayAddress?: string | undefined;
    lastSyncTime?: Date | undefined;
    neighborNodes?: string[] | undefined;
}>;
export declare const updateMeshConnectConfigSchema: z.ZodObject<{
    deviceId: z.ZodOptional<z.ZodString>;
    signalStrength: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    latency: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    throughput: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    frequencyBand: z.ZodOptional<z.ZodEnum<["1.35-1.44", "2.20-2.50", "dual"]>>;
    encryptionEnabled: z.ZodOptional<z.ZodBoolean>;
    encryptionKey: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    meshNodeId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    parentNodeId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    networkTopology: z.ZodOptional<z.ZodOptional<z.ZodType<{
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    }, z.ZodTypeDef, {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    }>>>;
    wifiEnabled: z.ZodOptional<z.ZodBoolean>;
    wifiSSID: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    wifiPassword: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    ethernetPorts: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    isGateway: z.ZodOptional<z.ZodBoolean>;
    gatewayAddress: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    nodeStatus: z.ZodOptional<z.ZodEnum<["connected", "disconnected", "syncing", "error"]>>;
    lastSyncTime: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    neighborNodes: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    deviceId?: string | undefined;
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
    frequencyBand?: "1.35-1.44" | "2.20-2.50" | "dual" | undefined;
    encryptionEnabled?: boolean | undefined;
    encryptionKey?: string | undefined;
    meshNodeId?: string | undefined;
    parentNodeId?: string | undefined;
    networkTopology?: {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    } | undefined;
    wifiEnabled?: boolean | undefined;
    wifiSSID?: string | undefined;
    wifiPassword?: string | undefined;
    ethernetPorts?: number | undefined;
    isGateway?: boolean | undefined;
    gatewayAddress?: string | undefined;
    nodeStatus?: "error" | "connected" | "disconnected" | "syncing" | undefined;
    lastSyncTime?: Date | undefined;
    neighborNodes?: string[] | undefined;
}, {
    deviceId?: string | undefined;
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
    frequencyBand?: "1.35-1.44" | "2.20-2.50" | "dual" | undefined;
    encryptionEnabled?: boolean | undefined;
    encryptionKey?: string | undefined;
    meshNodeId?: string | undefined;
    parentNodeId?: string | undefined;
    networkTopology?: {
        nodes: {
            status: string;
            nodeId: string;
            deviceId: string;
            neighbors: string[];
            ipAddress?: string | undefined;
            signalStrength?: number | undefined;
            latency?: number | undefined;
            throughput?: number | undefined;
        }[];
        edges: {
            from: string;
            to: string;
            signalStrength?: number | undefined;
            latency?: number | undefined;
        }[];
    } | undefined;
    wifiEnabled?: boolean | undefined;
    wifiSSID?: string | undefined;
    wifiPassword?: string | undefined;
    ethernetPorts?: number | undefined;
    isGateway?: boolean | undefined;
    gatewayAddress?: string | undefined;
    nodeStatus?: "error" | "connected" | "disconnected" | "syncing" | undefined;
    lastSyncTime?: Date | undefined;
    neighborNodes?: string[] | undefined;
}>;
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
//# sourceMappingURL=device.d.ts.map