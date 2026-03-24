import { PrismaClient } from "@prisma/client";
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
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export * from "@prisma/client";
/**
 * Health check for database connection
 */
export declare function checkDatabaseHealth(): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map