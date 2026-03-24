import { Queue, Worker, type Processor, type WorkerOptions, type QueueOptions } from "bullmq";

// ── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  AI_INFERENCE: "ai-inference",
  IMAGE_PROCESSING: "image-processing",
  REPORT_GENERATION: "report-generation",
  NOTIFICATIONS: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ── Job Payload Types ────────────────────────────────────────────────────────

export interface AiInferenceJob {
  frameId: string;
  cameraId: string;
  imageUrl: string;
  modelId?: string;
  timestamp: number;
}

export interface ImageProcessingJob {
  sourceUrl: string;
  operations: Array<"resize" | "thumbnail" | "annotate" | "compress">;
  outputPath: string;
  metadata?: Record<string, string>;
}

export interface ReportGenerationJob {
  reportType: "daily" | "weekly" | "monthly" | "incident" | "custom";
  siteId: string;
  dateRange: { start: string; end: string };
  requestedBy: string;
  format: "pdf" | "csv" | "json";
}

export interface NotificationJob {
  type: "alert" | "report-ready" | "system" | "digest";
  recipientIds: string[];
  title: string;
  body: string;
  channel: "email" | "push" | "in-app";
  metadata?: Record<string, unknown>;
}

export type JobPayloadMap = {
  [QUEUE_NAMES.AI_INFERENCE]: AiInferenceJob;
  [QUEUE_NAMES.IMAGE_PROCESSING]: ImageProcessingJob;
  [QUEUE_NAMES.REPORT_GENERATION]: ReportGenerationJob;
  [QUEUE_NAMES.NOTIFICATIONS]: NotificationJob;
};

// ── Connection Config ────────────────────────────────────────────────────────

function getConnectionConfig() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
  };
}

// ── Factory Functions ────────────────────────────────────────────────────────

export function createQueue<T extends QueueName>(
  name: T,
  opts?: Partial<QueueOptions>
): Queue<JobPayloadMap[T]> {
  return new Queue<JobPayloadMap[T]>(name, {
    connection: getConnectionConfig(),
    ...opts,
  });
}

export function createWorker<T extends QueueName>(
  name: T,
  processor: Processor<JobPayloadMap[T]>,
  opts?: Partial<WorkerOptions>
): Worker<JobPayloadMap[T]> {
  return new Worker<JobPayloadMap[T]>(name, processor, {
    connection: getConnectionConfig(),
    ...opts,
  });
}
