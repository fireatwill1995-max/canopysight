import { z } from "zod";

/**
 * MeshConnect network topology type
 */
export const meshTopologyNodeSchema = z.object({
  nodeId: z.string(),
  deviceId: z.string(),
  ipAddress: z.string().ip().optional(),
  status: z.string(),
  neighbors: z.array(z.string()),
  signalStrength: z.number().optional(),
  latency: z.number().optional(),
  throughput: z.number().optional(),
});

export const meshTopologyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  signalStrength: z.number().optional(),
  latency: z.number().optional(),
});

export const meshTopologySchema = z.object({
  nodes: z.array(meshTopologyNodeSchema),
  edges: z.array(meshTopologyEdgeSchema),
});

export type MeshTopologyNode = z.infer<typeof meshTopologyNodeSchema>;
export type MeshTopologyEdge = z.infer<typeof meshTopologyEdgeSchema>;
export type MeshTopology = z.infer<typeof meshTopologySchema>;
