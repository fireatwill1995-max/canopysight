import { PrismaClient } from "@prisma/client";

/**
 * Database connection pool configuration
 * Optimizes connection management for better performance
 */
export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connection pool configuration
// These settings optimize for concurrent requests
const connectionPoolConfig = {
  // Maximum number of connections in the pool
  connection_limit: parseInt(process.env.DATABASE_POOL_SIZE || "10", 10),
  // Maximum time to wait for a connection (ms)
  pool_timeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || "10000", 10),
};

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}
