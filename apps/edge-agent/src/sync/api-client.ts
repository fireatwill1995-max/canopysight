import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { DetectionEvent } from "../types";

/**
 * API client for communicating with the backend
 */
export class APIClient {
  private client: AxiosInstance;
  private deviceId: string;
  private siteId: string;

  constructor(deviceId: string, siteId: string) {
    this.deviceId = deviceId;
    this.siteId = siteId;

    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }

  /**
   * Send heartbeat to API
   */
  async sendHeartbeat(status: "online" | "offline" | "maintenance" | "error" = "online"): Promise<void> {
    try {
      // tRPC endpoint format: /trpc/{procedure}?input={json}
      const response = await this.client.post(
        `/trpc/device.heartbeat`,
        {
          deviceId: this.deviceId,
          status,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.status !== 200) {
        throw new Error(`Heartbeat failed with status ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Heartbeat failed:", error.message, error.response?.status);
      } else {
        console.error("Heartbeat failed:", error);
      }
      // Don't throw - heartbeat failures shouldn't crash the agent
    }
  }

  /**
   * Upload detection event
   */
  async uploadDetectionEvent(event: DetectionEvent): Promise<void> {
    try {
      await this.client.post(`/trpc/detection.create`, {
        ...event,
        deviceId: this.deviceId,
        siteId: this.siteId,
      });
    } catch (error) {
      console.error("Failed to upload detection event:", error);
      throw error;
    }
  }

  /**
   * Get zone configuration for this site
   */
  async getZones(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    points: Array<{ x: number; y: number }>;
    isActive: boolean;
  }>> {
    try {
      const response = await this.client.get(`/trpc/zone.list`, {
        params: { input: JSON.stringify({ siteId: this.siteId }) },
      });
      // tRPC response format: { result: { data: [...] } }
      const result = response.data?.result?.data;
      if (Array.isArray(result)) {
        return result;
      }
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Failed to fetch zones:", error.message, error.response?.status);
      } else {
        console.error("Failed to fetch zones:", error);
      }
      return []; // Return empty array on error - agent can still run
    }
  }

  /**
   * Upload video clip metadata
   */
  async uploadVideoClip(clip: {
    detectionEventId?: string;
    filePath: string;
    thumbnailPath?: string;
    duration: number;
    startTime: Date;
    endTime: Date;
    fileSize: number;
    mimeType: string;
  }): Promise<void> {
    try {
      const response = await this.client.post(
        `/trpc/video.create`,
        {
          ...clip,
          deviceId: this.deviceId,
          siteId: this.siteId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.status !== 200) {
        throw new Error(`Video upload failed with status ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Failed to upload video clip:", error.message, error.response?.status);
      } else {
        console.error("Failed to upload video clip:", error);
      }
      throw error;
    }
  }

  /**
   * Get MeshConnect configuration
   */
  async getMeshConnectConfig(deviceId: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.get(`/trpc/meshconnect.getConfig`, {
        params: { input: JSON.stringify({ deviceId }) },
      });
      const result = response.data?.result?.data;
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Failed to fetch MeshConnect config:", error.message, error.response?.status);
      } else {
        console.error("Failed to fetch MeshConnect config:", error);
      }
      return null;
    }
  }
}
