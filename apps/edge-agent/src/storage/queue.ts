import * as fs from "fs/promises";
import * as path from "path";
import { config } from "../config";
import { DetectionEvent } from "../types";

/**
 * Offline queue for events when API is unavailable
 */
export class OfflineQueue {
  private queuePath: string;
  private maxSize: number;

  constructor() {
    this.queuePath = path.join(config.storagePath, "queue");
    this.maxSize = config.maxOfflineQueueSize;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.queuePath, { recursive: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to initialize queue directory at ${this.queuePath}:`, errorMessage);
      throw new Error(`Queue initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Add event to queue
   */
  async enqueue(event: DetectionEvent): Promise<void> {
    // Validate event before queuing
    if (!event || !event.id || !event.timestamp) {
      throw new Error("Invalid event: missing required fields (id, timestamp)");
    }
    
    try {
      const files = await this.listQueueFiles();
      
      if (files.length >= this.maxSize) {
        // Remove oldest file
        const sorted = files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        const oldest = sorted[0];
        if (oldest) {
          await fs.unlink(oldest.path).catch((err) => {
            console.warn(`Failed to remove oldest queue file: ${err}`);
          });
        }
      }

      const filename = `${Date.now()}-${event.id}.json`;
      const filepath = path.join(this.queuePath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(event, null, 2), "utf-8");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to enqueue event ${event.id}:`, errorMessage);
      throw new Error(`Queue enqueue failed: ${errorMessage}`);
    }
  }

  /**
   * Get next event from queue
   */
  async dequeue(): Promise<DetectionEvent | null> {
    const files = await this.listQueueFiles();
    
    if (files.length === 0) return null;

    // Get oldest file
    const oldest = files.sort((a, b) => 
      a.mtime.getTime() - b.mtime.getTime()
    )[0];

    try {
      const content = await fs.readFile(oldest.path, "utf-8");
      // Validate JSON before parsing
      if (!content || content.trim().length === 0) {
        await fs.unlink(oldest.path).catch(() => {});
        return null;
      }
      const parsed = JSON.parse(content);
      // Basic validation
      if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.timestamp) {
        console.warn("Invalid event format in queue file:", oldest.path);
        await fs.unlink(oldest.path).catch(() => {});
        return null;
      }
      // Validate event structure
      if (!parsed.id || !parsed.timestamp || !parsed.type) {
        console.warn("Invalid event format in queue file:", oldest.path);
        await fs.unlink(oldest.path).catch(() => {});
        return null;
      }
      
      const event = parsed as DetectionEvent;
      // Validate timestamp is a valid date
      if (typeof event.timestamp === "string") {
        event.timestamp = new Date(event.timestamp);
      }
      if (isNaN(event.timestamp.getTime())) {
        console.warn("Invalid timestamp in queued event:", oldest.path);
        await fs.unlink(oldest.path).catch(() => {});
        return null;
      }
      
      await fs.unlink(oldest.path);
      return event;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to dequeue event from ${oldest.path}:`, errorMessage);
      // Remove corrupted file
      await fs.unlink(oldest.path).catch(() => {});
      return null;
    }
  }

  /**
   * Get all queued events
   */
  async getAll(): Promise<DetectionEvent[]> {
    const files = await this.listQueueFiles();
    const events: DetectionEvent[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file.path, "utf-8");
        if (!content || content.trim().length === 0) {
          continue;
        }
        const parsed = JSON.parse(content);
        // Basic validation
        if (parsed && typeof parsed === "object" && parsed.id && parsed.timestamp) {
          events.push(parsed as DetectionEvent);
        } else {
          console.warn(`Invalid event format in queue file: ${file.path}`);
        }
      } catch (error) {
        console.error(`Failed to read queue file ${file.path}:`, error);
        // Optionally remove corrupted file
      }
    }

    return events.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    const files = await this.listQueueFiles();
    return files.length;
  }

  private async listQueueFiles(): Promise<Array<{ path: string; mtime: Date }>> {
    try {
      const files = await fs.readdir(this.queuePath);
      const fileStats = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map(async (f) => {
            const filepath = path.join(this.queuePath, f);
            const stats = await fs.stat(filepath);
            return {
              path: filepath,
              mtime: stats.mtime,
            };
          })
      );
      return fileStats;
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    const files = await this.listQueueFiles();
    await Promise.all(files.map((f) => fs.unlink(f.path)));
  }
}
