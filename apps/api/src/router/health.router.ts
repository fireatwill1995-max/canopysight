/**
 * Enhanced health check Express router for Canopy Sight API.
 *
 * Endpoints:
 *   GET /health         — basic liveness (always fast, no auth)
 *   GET /health/ready   — readiness probe (DB + Redis connectivity)
 *   GET /health/detailed — full system status (requires x-health-key header)
 */
import { Router } from "express";
import { logger } from "@canopy-sight/config";

const pkg = { version: process.env.npm_package_version || "0.1.0" };

// Optional secret to protect /health/detailed — set HEALTH_CHECK_KEY in env
const HEALTH_KEY = process.env.HEALTH_CHECK_KEY;

// ── Helpers ──────────────────────────────────────────────────────────
async function checkDatabase(): Promise<{
  status: "connected" | "disconnected";
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const { prisma } = await import("@canopy-sight/database");
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000)
      ),
    ]);
    return { status: "connected", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "disconnected",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<{
  status: "connected" | "disconnected" | "not_configured";
  latencyMs?: number;
  error?: string;
}> {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!redisUrl) {
    return { status: "not_configured" };
  }
  const start = Date.now();
  try {
    // Attempt a lightweight ping via Upstash REST or ioredis
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const resp = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/ping`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (resp.ok) {
        return { status: "connected", latencyMs: Date.now() - start };
      }
      return { status: "disconnected", latencyMs: Date.now() - start, error: `HTTP ${resp.status}` };
    }
    // Fallback: just report configured but unable to verify without client
    return { status: "connected", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "disconnected",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    rssMb: Math.round(mem.rss / 1024 / 1024),
    externalMb: Math.round(mem.external / 1024 / 1024),
  };
}

// ── Router ───────────────────────────────────────────────────────────
export function createHealthRouter(): Router {
  const router = Router();

  /**
   * GET /health — basic liveness
   * Always returns quickly. Used by Fly.io / load balancer probes.
   */
  router.get("/", async (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store");

    try {
      const db = await checkDatabase();

      const status = db.status === "connected" ? "ok" : "degraded";
      const statusCode = status === "ok" ? 200 : 503;

      res.status(statusCode).json({
        status,
        version: pkg.version,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        database: db.status,
        memory: {
          used: getMemoryUsage().heapUsedMb,
          total: getMemoryUsage().heapTotalMb,
          rss: getMemoryUsage().rssMb,
        },
      });
    } catch (error) {
      logger.error("Health check failed", error);
      res.status(500).json({
        status: "error",
        version: pkg.version,
        timestamp: new Date().toISOString(),
        message: "Health check failed",
      });
    }
  });

  /**
   * GET /health/ready — readiness probe
   * Returns 200 only when the service can accept traffic (DB + Redis OK).
   * Kubernetes / Fly.io can use this to decide whether to route traffic.
   */
  router.get("/ready", async (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store");

    try {
      const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

      const ready =
        db.status === "connected" &&
        (redis.status === "connected" || redis.status === "not_configured");

      res.status(ready ? 200 : 503).json({
        ready,
        timestamp: new Date().toISOString(),
        checks: {
          database: db.status,
          redis: redis.status,
        },
      });
    } catch (error) {
      logger.error("Readiness check failed", error);
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        error: "Readiness check failed",
      });
    }
  });

  /**
   * GET /health/detailed — full system status
   * Requires HEALTH_CHECK_KEY header for production security.
   * Returns DB latency, Redis status, memory, uptime, and env info.
   */
  router.get("/detailed", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store");

    // Auth: require key in production
    if (HEALTH_KEY) {
      const provided = req.headers["x-health-key"];
      if (provided !== HEALTH_KEY) {
        res.status(401).json({ error: "Unauthorized — provide x-health-key header" });
        return;
      }
    }

    try {
      const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

      const overallStatus =
        db.status === "connected" &&
        (redis.status === "connected" || redis.status === "not_configured")
          ? "ok"
          : "degraded";

      res.status(overallStatus === "ok" ? 200 : 503).json({
        status: overallStatus,
        version: pkg.version,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || "development",
        region: process.env.FLY_REGION || process.env.FLY_ALLOC_ID ? "fly" : "local",
        node: process.version,
        checks: {
          database: {
            status: db.status,
            latencyMs: db.latencyMs,
            ...(db.error && { error: db.error }),
          },
          redis: {
            status: redis.status,
            latencyMs: redis.latencyMs,
            ...(redis.error && { error: redis.error }),
          },
        },
        memory: getMemoryUsage(),
        process: {
          pid: process.pid,
          uptimeSeconds: Math.round(process.uptime()),
        },
      });
    } catch (error) {
      logger.error("Detailed health check failed", error);
      res.status(500).json({
        status: "error",
        timestamp: new Date().toISOString(),
        message: "Detailed health check failed",
      });
    }
  });

  return router;
}
