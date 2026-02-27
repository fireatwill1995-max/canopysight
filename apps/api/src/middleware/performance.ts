import { logger, type LogContext } from "@canopy-sight/config";

/**
 * Performance monitoring middleware
 * Tracks request duration and logs slow queries
 */
export interface PerformanceMetrics {
  duration: number;
  procedure: string;
  organizationId?: string;
  userId?: string;
}

const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second
const VERY_SLOW_QUERY_THRESHOLD_MS = 5000; // 5 seconds

type TRPCMiddleware = (opts: {
  ctx: { organizationId?: string; userId?: string };
  path: string;
  type: string;
  next: () => Promise<unknown>;
}) => Promise<unknown>;

export function performanceMiddleware(): TRPCMiddleware {
  return async (opts) => {
    const startTime = Date.now();
    const procedure = `${opts.type}.${opts.path}`;

    try {
      const result = await opts.next();
      const duration = Date.now() - startTime;

      const metrics: PerformanceMetrics = {
        duration,
        procedure,
        organizationId: opts.ctx.organizationId,
        userId: opts.ctx.userId,
      };

      // Log slow queries
      const logContext: LogContext = { ...metrics };
      if (duration > VERY_SLOW_QUERY_THRESHOLD_MS) {
        logger.error("Very slow query detected", undefined, logContext);
      } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn("Slow query detected", logContext);
      } else if (process.env.NODE_ENV === "development") {
        logger.debug("Query performance", logContext);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Query failed", error, {
        procedure,
        duration,
        organizationId: opts.ctx.organizationId,
      });
      throw error;
    }
  };
}

/**
 * Track custom performance metrics
 */
export class PerformanceTracker {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * Record a metric
   */
  static record(metricName: string, value: number): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    this.metrics.get(metricName)!.push(value);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(metricName)!;
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  /**
   * Get statistics for a metric
   */
  static getStats(metricName: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const measurements = this.metrics.get(metricName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] ?? 0;

    return {
      count: sorted.length,
      avg: Math.round(avg * 100) / 100,
      min,
      max,
      p95: Math.round(p95 * 100) / 100,
    };
  }

  /**
   * Get all metrics
   */
  static getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const stats: Record<string, ReturnType<typeof this.getStats>> = {};
    for (const metricName of this.metrics.keys()) {
      stats[metricName] = this.getStats(metricName);
    }
    return stats;
  }

  /**
   * Clear all metrics
   */
  static clear(): void {
    this.metrics.clear();
  }
}
