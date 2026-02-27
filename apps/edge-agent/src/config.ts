import dotenv from "dotenv";

dotenv.config();

function safeParseInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeParseFloat(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  cameraIndex: safeParseInt(process.env.CAMERA_INDEX, 0),
  frameRate: Math.max(1, Math.min(120, safeParseInt(process.env.FRAME_RATE, 30))),
  detectionThreshold: Math.max(0, Math.min(1, safeParseFloat(process.env.DETECTION_THRESHOLD, 0.5))),
  riskThreshold: Math.max(0, Math.min(100, safeParseFloat(process.env.RISK_THRESHOLD, 50))),
  enableTracking: process.env.ENABLE_TRACKING === "true",
  enableAnonymization: process.env.ENABLE_ANONYMIZATION === "true",
  storagePath: process.env.STORAGE_PATH || "./storage",
  maxOfflineQueueSize: Math.max(1, safeParseInt(process.env.MAX_OFFLINE_QUEUE_SIZE, 1000)),
  heartbeatInterval: Math.max(1000, safeParseInt(process.env.HEARTBEAT_INTERVAL, 30000)),
};
