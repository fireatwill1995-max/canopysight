import axios, { AxiosInstance } from "axios";
import { config } from "../config";

/**
 * MeshConnect network manager
 * Handles mesh network connectivity, topology, and routing
 */
export interface MeshConnectConfig {
  deviceId: string;
  frequencyBand: "1.35-1.44" | "2.20-2.50" | "dual";
  throughput?: number;
  latency?: number;
  encryptionEnabled: boolean;
  encryptionKey?: string;
  meshNodeId?: string;
  parentNodeId?: string;
  wifiEnabled: boolean;
  wifiSSID?: string;
  wifiPassword?: string;
  ethernetPorts?: number;
  isGateway: boolean;
  gatewayAddress?: string;
}

export interface MeshNodeStatus {
  nodeId: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  signalStrength?: number; // dBm
  neighborNodes: string[];
  latency?: number;
  throughput?: number;
  lastSyncTime?: Date;
}

export interface MeshTopology {
  nodes: Array<{
    nodeId: string;
    deviceId: string;
    ipAddress?: string;
    status: string;
    neighbors: string[];
    signalStrength?: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    signalStrength?: number;
    latency?: number;
  }>;
}

export class MeshConnectManager {
  private config: MeshConnectConfig | null = null;
  private status: MeshNodeStatus | null = null;
  private apiClient: AxiosInstance;
  private isInitialized: boolean = false;
  private topologyUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.apiClient = axios.create({
      baseURL: config.apiUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });
  }

  /**
   * Initialize MeshConnect with configuration
   */
  async initialize(meshConfig: MeshConnectConfig | Record<string, unknown>): Promise<void> {
    try {
      const raw = meshConfig as Record<string, unknown>;
      const deviceId = String(raw.deviceId ?? "");
      const freqStr = String(raw.frequencyBand ?? "");
      const frequencyBand: "1.35-1.44" | "2.20-2.50" | "dual" =
        freqStr === "1.35-1.44" || freqStr === "2.20-2.50" || freqStr === "dual"
          ? (freqStr as "1.35-1.44" | "2.20-2.50" | "dual")
          : "dual";

      this.config = {
        deviceId,
        frequencyBand,
        throughput: typeof raw.throughput === "number" ? raw.throughput : undefined,
        latency: typeof raw.latency === "number" ? raw.latency : undefined,
        encryptionEnabled: raw.encryptionEnabled === true || raw.encryptionEnabled === undefined,
        encryptionKey: typeof raw.encryptionKey === "string" ? raw.encryptionKey : undefined,
        meshNodeId: typeof raw.meshNodeId === "string" ? raw.meshNodeId : `node-${deviceId.substring(0, 8)}`,
        parentNodeId: typeof raw.parentNodeId === "string" ? raw.parentNodeId : undefined,
        wifiEnabled: raw.wifiEnabled === true,
        wifiSSID: typeof raw.wifiSSID === "string" ? raw.wifiSSID : undefined,
        wifiPassword: typeof raw.wifiPassword === "string" ? raw.wifiPassword : undefined,
        ethernetPorts: typeof raw.ethernetPorts === "number" ? raw.ethernetPorts : 4,
        isGateway: raw.isGateway === true,
        gatewayAddress: typeof raw.gatewayAddress === "string" ? raw.gatewayAddress : undefined,
      };

      // TODO: Initialize actual MeshConnect hardware via:
      // - HTTP API to MeshConnect device (typically on port 80/443)
      // - Configure frequency band, encryption, etc.
      // - Join mesh network
      
      console.log(`🔗 Initializing MeshConnect node: ${this.config.meshNodeId}`);
      
      // Simulate mesh connection
      await this.connectToMesh();
      
      this.isInitialized = true;
      
      if (this.topologyUpdateInterval) {
        clearInterval(this.topologyUpdateInterval);
        this.topologyUpdateInterval = null;
      }
      this.startTopologyUpdates();
      
      console.log(`✅ MeshConnect initialized: ${this.config.meshNodeId}`);
    } catch (error) {
      console.error("Failed to initialize MeshConnect:", error);
      throw error;
    }
  }

  /**
   * Connect to mesh network
   */
  private async connectToMesh(): Promise<void> {
    if (!this.config) throw new Error("MeshConnect not configured");

    // TODO: Actual MeshConnect API call
    // Example: POST http://meshconnect-device-ip/api/mesh/join
    // {
    //   "nodeId": this.config.meshNodeId,
    //   "frequencyBand": this.config.frequencyBand,
    //   "encryptionKey": this.config.encryptionKey,
    //   "parentNodeId": this.config.parentNodeId
    // }

    const meshNodeId = this.config.meshNodeId ?? `node-${this.config.deviceId.substring(0, 8)}`;
    // Simulate connection
    this.status = {
      nodeId: meshNodeId,
      status: "connected",
      signalStrength: -65, // Good signal
      neighborNodes: [],
      latency: 7, // ~7ms as per MeshConnect specs
      throughput: 100, // Up to 100 Mbps
      lastSyncTime: new Date(),
    };

    // Update status in database
    await this.updateStatus();
  }

  /**
   * Get current mesh network topology
   */
  async getTopology(): Promise<MeshTopology> {
    try {
      // TODO: Query MeshConnect API for topology
      // GET http://meshconnect-device-ip/api/mesh/topology
      
      // For now, return current node status
      const status = this.status;
      if (!status) {
        return { nodes: [], edges: [] };
      }

      return {
        nodes: [
          {
            nodeId: status.nodeId,
            deviceId: this.config?.deviceId || "",
            status: status.status,
            neighbors: status.neighborNodes,
            signalStrength: status.signalStrength,
          },
        ],
        edges: status.neighborNodes.map((neighbor) => ({
          from: status.nodeId,
          to: neighbor,
          signalStrength: status.signalStrength,
          latency: status.latency,
        })),
      };
    } catch (error) {
      console.error("Failed to get mesh topology:", error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Update mesh node status
   */
  private async updateStatus(): Promise<void> {
    if (!this.config || !this.status) return;

    try {
      await this.apiClient.post("/trpc/meshconnect.updateStatus", {
        deviceId: this.config.deviceId,
        nodeStatus: this.status.status,
        signalStrength: this.status.signalStrength,
        neighborNodes: this.status.neighborNodes,
        latency: this.status.latency,
        throughput: this.status.throughput,
        lastSyncTime: this.status.lastSyncTime,
      });
    } catch (error) {
      console.error("Failed to update MeshConnect status:", error);
      // Don't throw - status updates shouldn't crash the agent
    }
  }

  /**
   * Start periodic topology updates
   */
  private startTopologyUpdates(): void {
    this.topologyUpdateInterval = setInterval(() => {
      if (this.isInitialized) {
        void (async () => {
          try {
            await this.updateStatus();
            const topology = await this.getTopology();
            if (topology.nodes.length > 0 && this.status) {
              const nodeId = this.status.nodeId;
              this.status.neighborNodes = topology.nodes
                .filter((n) => n.nodeId !== nodeId)
                .map((n) => n.nodeId);
            }
          } catch (error) {
            console.error("Topology update failed:", error instanceof Error ? error.message : error);
          }
        })();
      }
    }, 30000);
  }

  /**
   * Get current node status
   */
  getStatus(): MeshNodeStatus | null {
    return this.status;
  }

  /**
   * Check if mesh network is connected
   */
  isConnected(): boolean {
    return this.status?.status === "connected";
  }

  /**
   * Get network latency
   */
  getLatency(): number | undefined {
    return this.status?.latency;
  }

  /**
   * Get network throughput
   */
  getThroughput(): number | undefined {
    return this.status?.throughput;
  }

  /**
   * Disconnect from mesh network
   */
  async disconnect(): Promise<void> {
    if (this.topologyUpdateInterval) {
      clearInterval(this.topologyUpdateInterval);
      this.topologyUpdateInterval = null;
    }

    if (this.config) {
      // TODO: Disconnect from MeshConnect API
      // POST http://meshconnect-device-ip/api/mesh/disconnect
      
      if (this.status) {
        this.status.status = "disconnected";
        await this.updateStatus();
      }
    }

    this.isInitialized = false;
    console.log("🔌 MeshConnect disconnected");
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.disconnect();
  }
}
