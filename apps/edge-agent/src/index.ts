import { config } from "./config";
import { Camera } from "./capture/camera";
import { YOLODetector } from "./inference/yolo";
import { SORTTracker } from "./tracking/sort";
import { ZoneAnalyzer } from "./zones/analyzer";
import { RiskScorer } from "./risk/scorer";
import { APIClient } from "./sync/api-client";
import { OfflineQueue } from "./storage/queue";
import { DetectionEvent } from "./types";
import { LoiteringDetector } from "./features/loitering-detector";
import { PPEDetector } from "./features/ppe-detector";
import { MeshConnectManager } from "./network/meshconnect";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

/**
 * Main Edge Agent orchestrator
 */
class EdgeAgent {
  private camera: Camera;
  private detector: YOLODetector;
  private tracker: SORTTracker;
  private zoneAnalyzer: ZoneAnalyzer;
  private riskScorer: RiskScorer;
  private apiClient: APIClient;
  private queue: OfflineQueue;
  private loiteringDetector: LoiteringDetector;
  private ppeDetector: PPEDetector;
  private meshConnect: MeshConnectManager | null = null;
  private isRunning: boolean = false;
  private processingFrame: boolean = false;
  private frameInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private queueProcessorInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.camera = new Camera();
    this.detector = new YOLODetector();
    this.tracker = new SORTTracker();
    this.zoneAnalyzer = new ZoneAnalyzer();
    this.riskScorer = new RiskScorer(this.tracker);
    this.apiClient = new APIClient(config.deviceId, process.env.SITE_ID || "");
    this.queue = new OfflineQueue();
    this.loiteringDetector = new LoiteringDetector();
    this.ppeDetector = new PPEDetector(process.env.ENABLE_PPE_DETECTION === "true");
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing Canopy Sight Edge Agent...");

    try {
      // Validate configuration
      if (!config.deviceId) {
        throw new Error("DEVICE_ID is required");
      }
      if (!process.env.SITE_ID) {
        throw new Error("SITE_ID is required");
      }

      // Initialize components (single sensing modality in v1)
      await this.camera.initialize();
      await this.detector.initialize();
      await this.queue.initialize();
      await this.ppeDetector.initialize();

      // Initialize MeshConnect if enabled
      if (process.env.ENABLE_MESHCONNECT === "true" && process.env.MESHCONNECT_DEVICE_ID) {
        try {
          this.meshConnect = new MeshConnectManager();
          // Fetch MeshConnect config from API
          const meshConfig = await this.apiClient.getMeshConnectConfig(
            process.env.MESHCONNECT_DEVICE_ID
          );
          if (meshConfig) {
            await this.meshConnect.initialize(meshConfig);
            console.log("✅ MeshConnect initialized and connected");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.warn(`⚠️ Failed to initialize MeshConnect, continuing without it: ${errorMessage}`);
          this.meshConnect = null;
        }
      }

      // Fetch zone configuration
      const zones = await this.apiClient.getZones();
      type ZoneType = "crossing" | "approach" | "exclusion" | "custom";
      this.zoneAnalyzer.setZones(
        zones.map((z) => ({
          ...z,
          type: (["crossing", "approach", "exclusion", "custom"].includes(z.type) 
            ? z.type 
            : "custom") as ZoneType,
        }))
      );

      console.log("✅ Edge Agent initialized");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`❌ Failed to initialize Edge Agent: ${errorMessage}`, errorStack);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("Edge Agent is already running");
      return;
    }

    this.isRunning = true;
    console.log("▶️ Starting Edge Agent...");

    // Start frame processing loop
    const frameDelay = 1000 / config.frameRate;
    this.frameInterval = setInterval(() => {
      this.processFrame().catch(console.error);
    }, frameDelay);

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.apiClient.sendHeartbeat("online").catch(console.error);
    }, config.heartbeatInterval);

    // Start queue processor
    this.queueProcessorInterval = setInterval(() => {
      this.processQueue().catch(console.error);
    }, 5000); // Process queue every 5 seconds

    console.log("✅ Edge Agent started");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log("⏹️ Stopping Edge Agent...");
    this.isRunning = false;

    if (this.frameInterval) clearInterval(this.frameInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.queueProcessorInterval) clearInterval(this.queueProcessorInterval);

    await this.camera.close();
    await this.detector.close();
    if (this.meshConnect) {
      await this.meshConnect.close();
    }

    console.log("✅ Edge Agent stopped");
  }

  private async processFrame(): Promise<void> {
    if (!this.isRunning || this.processingFrame) return;
    this.processingFrame = true;

    try {
      const image: sharp.Sharp = await this.camera.captureFrameAsImage();

      // Run detection
      let detections = await this.detector.detect(image);

      // Track objects
      if (config.enableTracking) {
        detections = this.tracker.update(detections);
      }

      // Analyze zones
      const zoneAnalysis = this.zoneAnalyzer.analyzeDetections(detections);
      const occupancyByZone = this.zoneAnalyzer.getOccupancyByZone(detections);

      // Detect loitering in zones
      const trackedObjects = this.tracker.getTracks();
      interface LoiteringEvent {
        trackId: number;
        duration: number;
        severity: "low" | "medium" | "high" | "critical";
      }
      const loiteringEvents: Array<{ zoneId: string; events: LoiteringEvent[] }> = [];
      for (const zoneId of zoneAnalysis.zoneIds) {
        const loitering = this.loiteringDetector.detectLoitering(trackedObjects, zoneId);
        if (loitering.length > 0) {
          loiteringEvents.push({ zoneId, events: loitering });
        }
      }

      // Detect PPE compliance for person detections
      const personDetections = detections.filter((d) => d.type === "person");
      const ppeDetections = await this.ppeDetector.detectPPE(personDetections, image);

      // Calculate risk scores and create events
      for (const detection of detections) {
        try {
          const trackedObject = config.enableTracking && detection.trackId
            ? this.tracker.getTracks().find((t) => t.id === detection.trackId)
            : undefined;

          const riskScore = this.riskScorer.calculateRisk(
            detection,
            trackedObject,
            zoneAnalysis.zoneIds,
            new Date().getHours()
          );

          // Check for loitering
          const loiteringEvent = loiteringEvents
            .flatMap((le) => le.events)
            .find((le) => le.trackId === detection.trackId);

          // Check for PPE compliance
          const ppeDetection = ppeDetections.find((p) => p.personId === detection.id);
          const ppeCompliance = ppeDetection
            ? this.ppeDetector.checkPPECompliance(ppeDetection)
            : undefined;

          // Only create event if risk threshold is met OR loitering detected OR PPE violation
          const shouldCreateEvent =
            riskScore.overall >= config.riskThreshold ||
            (loiteringEvent && loiteringEvent.severity !== "low") ||
            (ppeCompliance && !ppeCompliance.compliant);

          if (shouldCreateEvent) {
            const zonesForDetection = zoneAnalysis.breaches
              .filter((b) => b.objectId === detection.trackId)
              .map((b) => b.zoneId);
            const occupancyInZone =
              zonesForDetection.length > 0
                ? Math.max(
                    ...zonesForDetection.map((zid) => occupancyByZone.get(zid) ?? 0)
                  )
                : 0;
            const behaviouralIndicator: "clustering" | "congestion" | "abnormal_dwell" | undefined =
              loiteringEvent && loiteringEvent.severity !== "low"
                ? "abnormal_dwell"
                : occupancyInZone >= 5
                  ? "congestion"
                  : occupancyInZone >= 3
                    ? "clustering"
                    : undefined;

            const event: DetectionEvent = {
              id: uuidv4(),
              deviceId: config.deviceId,
              siteId: process.env.SITE_ID || "",
              type: detection.type,
              confidence: detection.confidence,
              timestamp: detection.timestamp,
              boundingBox: detection.boundingBox,
              zoneIds: zoneAnalysis.zoneIds,
              riskScore,
              metadata: {
                trackId: detection.trackId,
                breaches: zoneAnalysis.breaches.filter(
                  (b) => b.objectId === detection.trackId
                ),
                ...(occupancyInZone > 0 && { occupancyInZone }),
                ...(behaviouralIndicator && { behaviouralIndicator }),
              },
              ...(loiteringEvent && {
                loiteringEvent: {
                  duration: loiteringEvent.duration,
                  severity: loiteringEvent.severity,
                },
              }),
              ...(ppeCompliance && { ppeCompliance }),
            };

            // Try to upload, fallback to queue
            try {
              await this.apiClient.uploadDetectionEvent(event);
            } catch (error) {
              console.warn("Failed to upload event, queuing:", error);
              try {
                await this.queue.enqueue(event);
              } catch (queueError) {
                console.error("Failed to queue event:", queueError);
              }
            }
          }
        } catch (detectionError) {
          const errorMessage = detectionError instanceof Error ? detectionError.message : "Unknown error";
          console.error(`Error processing detection ${detection.id || "unknown"}:`, errorMessage);
          // Continue with next detection to prevent one bad detection from stopping all processing
        }
      }
    } catch (error) {
      console.error("Error processing frame:", error);
    } finally {
      this.processingFrame = false;
    }
  }

  private async processQueue(): Promise<void> {
    try {
      const event = await this.queue.dequeue();
      if (!event) return;

      try {
        await this.apiClient.uploadDetectionEvent(event);
        console.log(`✅ Processed queued event: ${event.id}`);
      } catch (error) {
        // Re-queue if still failing, but limit retries to prevent infinite loops
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const retryCount = (event.metadata?.retryCount as number) || 0;
        
        if (retryCount < 5) {
          console.warn(`Failed to process queued event ${event.id} (attempt ${retryCount + 1}), re-queuing:`, errorMessage);
          event.metadata = {
            ...event.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
          };
          await this.queue.enqueue(event);
        } else {
          console.error(`Event ${event.id} exceeded max retries (5), dropping from queue`);
          // Don't re-queue to prevent infinite loops
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error processing queue: ${errorMessage}`);
      // Don't throw - queue processing should continue
    }
  }
}

// Main entry point
async function main() {
  const agent = new EdgeAgent();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down...`);
    try {
      await agent.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await agent.initialize();
    await agent.start();
  } catch (error) {
    console.error("Failed to start Edge Agent:", error);
    process.exit(1);
  }
}

main().catch(console.error);
