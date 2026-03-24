import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { logger } from "@canopy-sight/config";

// Connection configuration from environment
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

const connection = getRedisConnection();

// Typed job payloads
export interface AiInferenceJobPayload {
  fileId: string;
  modelId: string;
  organizationId: string;
  options?: Record<string, unknown>;
}

export interface ImageProcessingJobPayload {
  fileId: string;
  organizationId: string;
  operations: Array<{
    type: "resize" | "crop" | "thumbnail" | "annotate";
    params: Record<string, unknown>;
  }>;
}

export interface ReportGenerationJobPayload {
  reportType: string;
  organizationId: string;
  userId: string;
  filters: Record<string, unknown>;
  format: "pdf" | "csv" | "json";
}

export interface NotificationJobPayload {
  type: "email" | "webhook" | "push";
  recipientId: string;
  organizationId: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export type QueueName = "ai-inference" | "image-processing" | "report-generation" | "notifications";

type PayloadMap = {
  "ai-inference": AiInferenceJobPayload;
  "image-processing": ImageProcessingJobPayload;
  "report-generation": ReportGenerationJobPayload;
  "notifications": NotificationJobPayload;
};

// Create queues
const queues = new Map<QueueName, Queue>();

function getOrCreateQueue<T extends QueueName>(name: T): Queue<PayloadMap[T]> {
  if (!queues.has(name)) {
    const queue = new Queue<PayloadMap[T]>(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    queues.set(name, queue as Queue);
    logger.info("Queue created", { queue: name });
  }
  return queues.get(name) as Queue<PayloadMap[T]>;
}

// Public queue accessors
export const aiInferenceQueue = () => getOrCreateQueue("ai-inference");
export const imageProcessingQueue = () => getOrCreateQueue("image-processing");
export const reportGenerationQueue = () => getOrCreateQueue("report-generation");
export const notificationsQueue = () => getOrCreateQueue("notifications");

// Worker factory
export function createWorker<T extends QueueName>(
  queueName: T,
  processor: (job: Job<PayloadMap[T]>) => Promise<unknown>,
  concurrency = 5,
): Worker<PayloadMap[T]> {
  const worker = new Worker<PayloadMap[T]>(
    queueName,
    async (job) => {
      logger.info("Processing job", {
        queue: queueName,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await processor(job);
        logger.info("Job completed", {
          queue: queueName,
          jobId: job.id,
        });
        return result;
      } catch (error) {
        logger.error("Job failed", error, {
          queue: queueName,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts,
        });
        throw error;
      }
    },
    {
      connection,
      concurrency,
    },
  );

  worker.on("error", (error) => {
    logger.error("Worker error", error, { queue: queueName });
  });

  return worker;
}

// Job status helpers
export async function getJobStatus(queueName: QueueName, jobId: string) {
  const queue = getOrCreateQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  return {
    id: job.id,
    name: job.name,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

export async function addJob<T extends QueueName>(
  queueName: T,
  data: PayloadMap[T],
  options?: { priority?: number; delay?: number; jobId?: string },
) {
  const queue = getOrCreateQueue(queueName);
  const job = await queue.add(queueName, data, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId,
  });

  logger.info("Job added", {
    queue: queueName,
    jobId: job.id,
  });

  return { jobId: job.id!, queueName };
}

export async function cancelJob(queueName: QueueName, jobId: string): Promise<boolean> {
  const queue = getOrCreateQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === "active" || state === "waiting" || state === "delayed") {
    await job.remove();
    logger.info("Job cancelled", { queue: queueName, jobId });
    return true;
  }
  return false;
}

export async function retryJob(queueName: QueueName, jobId: string): Promise<boolean> {
  const queue = getOrCreateQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === "failed") {
    await job.retry();
    logger.info("Job retried", { queue: queueName, jobId });
    return true;
  }
  return false;
}

// Cleanup on shutdown
export async function closeAllQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    logger.info("Queue closed", { queue: name });
  }
  queues.clear();
}
