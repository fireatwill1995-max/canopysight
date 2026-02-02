import { PrismaClient } from "@prisma/client";
import { logger } from "@canopy-sight/config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// On Fly.io / serverless, add connection params to avoid timeouts and connection exhaustion
function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  if (url.includes("flycast") || url.includes("fly.dev")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}connect_timeout=15&connection_limit=5`;
  }
  return url;
}

/**
 * Prisma Client with optimized connection pooling
 * 
 * Connection pool settings:
 * - Pool size: Configured via DATABASE_POOL_SIZE (default: 10)
 * - Pool timeout: Configured via DATABASE_POOL_TIMEOUT (default: 10000ms)
 * 
 * These settings are applied via the DATABASE_URL connection string:
 * postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=10
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

// Log slow queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (e: { query: string; duration: number; params: string }) => {
    if (e.duration > 1000) {
      logger.warn("Slow query detected", {
        duration: `${e.duration}ms`,
        query: e.query.substring(0, 200),
      });
    }
  });
}

// Graceful shutdown
process.on("beforeExit", async () => {
  logger.info("Disconnecting from database");
  await prisma.$disconnect();
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Database health check failed", error);
    return false;
  }
}
