import { getCache, cacheKeys } from "../services/cache";
import { logger } from "@canopy-sight/config";

type TRPCMiddleware = (opts: {
  ctx: { organizationId?: string };
  path: string;
  type: string;
  input: unknown;
  next: () => Promise<unknown>;
}) => Promise<unknown>;

export function cacheMiddleware(ttlSeconds: number = 300): TRPCMiddleware {
  return async (opts: {
    ctx: { organizationId?: string };
    path: string;
    type: string;
    input: unknown;
    next: () => Promise<unknown>;
  }) => {
    // Only cache queries, not mutations
    if (opts.type !== "query") {
      return opts.next();
    }

    const cache = getCache();
    const orgId = opts.ctx.organizationId || "unknown";
    
    // Generate cache key from path and input (input can be undefined in batch)
    const inputHash = JSON.stringify(opts.input ?? {});
    const cacheKey = `${opts.path}:${orgId}:${Buffer.from(inputHash, "utf8").toString("base64").substring(0, 50)}`;

    try {
      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        logger.debug("Cache hit", { key: cacheKey, path: opts.path });
        return cached;
      }

      // Execute query and cache result
      const result = await opts.next();
      
      // Only cache successful results
      if (result !== null && result !== undefined) {
        await cache.set(cacheKey, result, ttlSeconds);
        logger.debug("Cache set", { key: cacheKey, path: opts.path });
      }

      return result;
    } catch (error) {
      logger.debug("Cache error, bypassing cache", {
        key: cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/**
 * Invalidate cache for a specific pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const cache = getCache();
  
  // For Redis, we could use pattern matching
  // For memory cache, we need to track keys
  // This is a simplified version
  logger.info("Cache invalidation requested", { pattern });
  
  // In a full implementation, you'd track cache keys and invalidate matching ones
  // For now, we'll rely on TTL expiration
}

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  site: async (siteId: string) => {
    await invalidateCache(`site:${siteId}`);
  },
  device: async (deviceId: string) => {
    await invalidateCache(`device:${deviceId}`);
  },
  organization: async (orgId: string) => {
    await invalidateCache(`*:${orgId}:*`);
  },
};
