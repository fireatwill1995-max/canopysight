import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

/**
 * Event aggregator for background jobs
 * Aggregates detection events, generates heatmaps, runs analytics
 */
class EventAggregator {
  private aggregationInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start background aggregation jobs
   */
  start(): Promise<void> {
    if (this.isRunning) return Promise.resolve();

    this.isRunning = true;
    logger.info("Event aggregator started");

    // Run hourly aggregation
    this.aggregationInterval = setInterval(() => {
      this.runHourlyAggregation().catch((error) => {
        logger.warn("Hourly aggregation error (non-critical)", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, 60 * 60 * 1000); // Every hour

    // Run daily aggregation at midnight
    this.scheduleDailyAggregation();

    // Run initial aggregation (non-blocking)
    this.runHourlyAggregation().catch((error) => {
      logger.warn("Initial aggregation error (non-critical)", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    
    return Promise.resolve();
  }

  /**
   * Stop aggregation jobs
   */
  stop(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
    this.isRunning = false;
    logger.info("Event aggregator stopped");
  }

  /**
   * Schedule daily aggregation at midnight
   */
  private scheduleDailyAggregation(): void {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    let msUntilMidnight = midnight.getTime() - now.getTime();
    if (msUntilMidnight < 0) msUntilMidnight += 24 * 60 * 60 * 1000;

    setTimeout(() => {
      this.runDailyAggregation().catch((err) => {
        logger.warn("Daily aggregation error (non-critical)", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
      setInterval(() => {
        this.runDailyAggregation().catch((err) => {
          logger.warn("Daily aggregation error (non-critical)", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Hourly aggregation: Update heatmaps, recent stats
   */
  private async runHourlyAggregation(): Promise<void> {
    try {
      logger.info("Running hourly event aggregation");

      // Check if database is available
      try {
        await prisma.$connect();
      } catch (dbError) {
        logger.warn("Database not available, skipping aggregation", {
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        return;
      }

      // Get all active organizations
      const organizations = await prisma.organization.findMany({
        select: { id: true },
      });

      for (const org of organizations) {
        // Update heatmaps for each site
        await this.updateHeatmaps(org.id);

        // Update system health metrics
        await this.updateSystemHealth(org.id);
      }

      logger.info("Hourly aggregation complete", { organizationCount: organizations.length });
    } catch (error) {
      logger.error("Error in hourly aggregation", error);
    }
  }

  /**
   * Daily aggregation: Generate reports, cleanup old data
   */
  private async runDailyAggregation(): Promise<void> {
    try {
      logger.info("Running daily event aggregation");

      // Check if database is available
      try {
        await prisma.$connect();
      } catch (dbError) {
        logger.warn("Database not available, skipping daily aggregation", {
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        return;
      }

      const organizations = await prisma.organization.findMany({
        select: { id: true },
      });

      for (const org of organizations) {
        // Generate daily reports
        await this.generateDailyReports(org.id);

        // Cleanup old data (based on retention policy)
        await this.cleanupOldData(org.id);
      }

      logger.info("Daily aggregation complete", { organizationCount: organizations.length });
    } catch (error) {
      logger.error("Error in daily aggregation", error);
    }
  }

  /**
   * Update heatmaps for all sites in organization
   */
  private async updateHeatmaps(organizationId: string): Promise<void> {
    try {
      const sites = await prisma.site.findMany({
        where: { organizationId },
        select: { id: true },
      });

      for (const site of sites) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

        // Get detection events
        const events = await prisma.detectionEvent.findMany({
          where: {
            siteId: site.id,
            organizationId,
            timestamp: { gte: startDate, lte: endDate },
          },
          select: {
            boundingBox: true,
            timestamp: true,
          },
        });

        // Generate heatmap data
        type HeatmapPoint = { x: number; y: number; intensity: number; timestamp: Date };
        const heatmapData = events
          .map((event: { boundingBox: unknown; timestamp: Date }) => {
            try {
              const bbox = event.boundingBox as { x: number; y: number; width: number; height: number };
              if (!bbox || typeof bbox.x !== "number") return null;
              return {
                x: bbox.x + (bbox.width || 0) / 2,
                y: bbox.y + (bbox.height || 0) / 2,
                intensity: 1,
                timestamp: event.timestamp,
              };
            } catch {
              return null;
            }
          })
          .filter((point: HeatmapPoint | null): point is HeatmapPoint => point !== null);

        // Upsert heatmap
        await prisma.heatmap.upsert({
          where: {
            id: `${site.id}-${startDate.toISOString().split("T")[0]}`,
          },
          create: {
            siteId: site.id,
            organizationId,
            startDate,
            endDate,
            data: heatmapData,
            resolution: 100,
          },
          update: {
            data: heatmapData,
            endDate,
          },
        });
      }
    } catch (error) {
      logger.error("Error updating heatmaps", error, { organizationId });
    }
  }

  /**
   * Update system health metrics
   */
  private async updateSystemHealth(organizationId: string): Promise<void> {
    try {
      const devices = await prisma.device.findMany({
        where: { organizationId },
        select: { id: true },
      });

      for (const device of devices) {
        // Calculate device health metrics
        const recentEvents = await prisma.detectionEvent.count({
          where: {
            deviceId: device.id,
            timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
          },
        });

        // Create or update system health record
        await prisma.systemHealth.create({
          data: {
            deviceId: device.id,
            organizationId,
            timestamp: new Date(),
            metadata: {
              eventsLastHour: recentEvents,
            },
          },
        });
      }
    } catch (error) {
      logger.error("Error updating system health", error, { organizationId });
    }
  }

  /**
   * Generate daily reports
   */
  private async generateDailyReports(organizationId: string): Promise<void> {
    // This would trigger AI report generation
    // For now, just log
    logger.debug("Generating daily reports (not implemented)", { organizationId });
  }

  /**
   * Cleanup old data based on retention policy
   */
  private async cleanupOldData(organizationId: string): Promise<void> {
    try {
      const retentionDays = 90; // Default 90 days
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Delete old detection events (keep metadata, delete video references)
      const deleted = await prisma.detectionEvent.deleteMany({
        where: {
          organizationId,
          timestamp: { lt: cutoffDate },
        },
      });

      logger.info("Cleaned up old detection events", {
        organizationId,
        deletedCount: deleted.count,
        retentionDays,
      });
    } catch (error) {
      logger.error("Error cleaning up old data", error, { organizationId });
    }
  }
}

export const eventAggregator = new EventAggregator();
