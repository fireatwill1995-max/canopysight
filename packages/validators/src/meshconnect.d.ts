import { z } from "zod";
/**
 * MeshConnect network topology type
 */
export declare const meshTopologyNodeSchema: z.ZodObject<{
    nodeId: z.ZodString;
    deviceId: z.ZodString;
    ipAddress: z.ZodOptional<z.ZodString>;
    status: z.ZodString;
    neighbors: z.ZodArray<z.ZodString, "many">;
    signalStrength: z.ZodOptional<z.ZodNumber>;
    latency: z.ZodOptional<z.ZodNumber>;
    throughput: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: string;
    nodeId: string;
    deviceId: string;
    neighbors: string[];
    ipAddress?: string | undefined;
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
}, {
    status: string;
    nodeId: string;
    deviceId: string;
    neighbors: string[];
    ipAddress?: string | undefined;
    signalStrength?: number | undefined;
    latency?: number | undefined;
    throughput?: number | undefined;
}>;
export declare const meshTopologyEdgeSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    signalStrength: z.ZodOptional<z.ZodNumber>;
    latency: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    signalStrength?: number | undefined;
    latency?: number | undefined;
}, {
    from: string;
    to: string;
    signalStrength?: number | undefined;
    latency?: number | undefined;
}>;
export declare const meshTopologySchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        nodeId: z.ZodString;
        deviceId: z.ZodString;
        ipAddress: z.ZodOptional<z.ZodString>;
        status: z.ZodString;
        neighbors: z.ZodArray<z.ZodString, "many">;
        signalStrength: z.ZodOptional<z.ZodNumber>;
        latency: z.ZodOptional<z.ZodNumber>;
        throughput: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        nodeId: string;
        deviceId: string;
        neighbors: string[];
        ipAddress?: string | undefined;
        signalStrength?: number | undefined;
        latency?: number | undefined;
        throughput?: number | undefined;
    }, {
        status: string;
        nodeId: string;
        deviceId: string;
        neighbors: string[];
        ipAddress?: string | undefined;
        signalStrength?: number | undefined;
        latency?: number | undefined;
        throughput?: number | undefined;
    }>, "many">;
    edges: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        signalStrength: z.ZodOptional<z.ZodNumber>;
        latency: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        signalStrength?: number | undefined;
        latency?: number | undefined;
    }, {
        from: string;
        to: string;
        signalStrength?: number | undefined;
        latency?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
export type MeshTopologyNode = z.infer<typeof meshTopologyNodeSchema>;
export type MeshTopologyEdge = z.infer<typeof meshTopologyEdgeSchema>;
export type MeshTopology = z.infer<typeof meshTopologySchema>;
//# sourceMappingURL=meshconnect.d.ts.map