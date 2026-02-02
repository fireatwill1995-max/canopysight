import dotenv from "dotenv";

dotenv.config();

export interface EdgeAgentConfig {
  deviceId: string;
  apiUrl: string;
  apiKey: string;
  modelPath: string;
  cameraIndex: number;
  frameRate: number;
  detectionThreshold: number;
  riskThreshold: number;
  enableTracking: boolean;
  enableAnonymization: boolean;
  storagePath: string;
  maxOfflineQueueSize: number;
  heartbeatInterval: number;
}

export const config: EdgeAgentConfig = {
  deviceId: process.env.DEVICE_ID || "",
  apiUrl: process.env.API_URL || "http://localhost:3001",
  apiKey: process.env.API_KEY || "",
  modelPath: process.env.MODEL_PATH || "./models/yolov8n.onnx",
  cameraIndex: parseInt(process.env.CAMERA_INDEX || "0"),
  frameRate: parseInt(process.env.FRAME_RATE || "30"),
  detectionThreshold: parseFloat(process.env.DETECTION_THRESHOLD || "0.5"),
  riskThreshold: parseFloat(process.env.RISK_THRESHOLD || "50"),
  enableTracking: process.env.ENABLE_TRACKING === "true",
  enableAnonymization: process.env.ENABLE_ANONYMIZATION === "true",
  storagePath: process.env.STORAGE_PATH || "./storage",
  maxOfflineQueueSize: parseInt(process.env.MAX_OFFLINE_QUEUE_SIZE || "1000"),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || "30000"),
};
