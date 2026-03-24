"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.checkDatabaseHealth = checkDatabaseHealth;
const client_1 = require("@prisma/client");
const config_1 = require("@canopy-sight/config");
const globalForPrisma = globalThis;
// On Fly.io / serverless, add connection params to avoid timeouts and connection exhaustion
function getDatabaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url)
        return url;
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
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === "development"
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
    exports.prisma.$on("query", (e) => {
        if (e.duration > 1000) {
            config_1.logger.warn("Slow query detected", {
                duration: `${e.duration}ms`,
                query: e.query.substring(0, 200),
            });
        }
    });
}
// Graceful shutdown
process.on("beforeExit", async () => {
    config_1.logger.info("Disconnecting from database");
    await exports.prisma.$disconnect();
});
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
__exportStar(require("@prisma/client"), exports);
/**
 * Health check for database connection
 */
async function checkDatabaseHealth() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        config_1.logger.error("Database health check failed", error);
        return false;
    }
}
