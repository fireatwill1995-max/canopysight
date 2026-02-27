import { logger } from "@canopy-sight/config";

/**
 * Cache interface for abstraction
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory cache implementation (fallback when Redis is not available)
 */
class MemoryCache implements Cache {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

/** Minimal Redis-like client interface for dynamic import */
interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  flushdb(): Promise<unknown>;
  on(event: string, fn: (...args: unknown[]) => void): void;
  once(event: string, fn: (...args: unknown[]) => void): void;
}

/**
 * Redis cache implementation
 */
class RedisCache implements Cache {
  private client: RedisLikeClient | null = null;
  private isConnected: boolean = false;

  constructor() {
    // Lazy load Redis client
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Dynamic import to avoid requiring Redis in all environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const redis = require("ioredis") as { default: new (opts: unknown) => RedisLikeClient };
      const client = new redis.default({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
      this.client = client;

      client.on("error", (...args: unknown[]) => {
        const err = args[0] instanceof Error ? args[0] : new Error(String(args[0]));
        logger.error("Redis connection error", err);
        this.isConnected = false;
      });

      client.on("connect", () => {
        logger.info("Redis connected");
        this.isConnected = true;
      });

      // ioredis connects automatically on construction; no connect() call needed
    } catch (error) {
      logger.warn("Redis not available, falling back to memory cache", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.client;
    if (!this.isConnected || !client) {
      return null;
    }

    try {
      const value = await client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error("Redis get error", error, { key });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    const client = this.client;
    if (!this.isConnected || !client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await client.setex(key, ttlSeconds, serialized);
    } catch (error) {
      logger.error("Redis set error", error, { key });
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.client;
    if (!this.isConnected || !client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error) {
      logger.error("Redis delete error", error, { key });
    }
  }

  async clear(): Promise<void> {
    const client = this.client;
    if (!this.isConnected || !client) {
      return;
    }

    try {
      await client.flushdb();
    } catch (error) {
      logger.error("Redis clear error", error);
    }
  }
}

/**
 * Cache factory - returns Redis if available, otherwise memory cache
 */
let cacheInstance: Cache | null = null;

export function getCache(): Cache {
  if (cacheInstance) {
    return cacheInstance;
  }

  // Try Redis first if configured
  if (process.env.REDIS_HOST || process.env.REDIS_URL) {
    try {
      cacheInstance = new RedisCache();
      return cacheInstance;
    } catch (error) {
      logger.warn("Failed to initialize Redis, using memory cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to memory cache
  cacheInstance = new MemoryCache();
  return cacheInstance;
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  site: (id: string) => `site:${id}`,
  device: (id: string) => `device:${id}`,
  detectionList: (orgId: string, filters: string) => `detections:${orgId}:${filters}`,
  alertList: (orgId: string, filters: string) => `alerts:${orgId}:${filters}`,
  systemHealth: (orgId: string) => `health:${orgId}`,
};

/**
 * Cache decorator for tRPC procedures
 */
export function cached<T extends (...args: unknown[]) => Promise<unknown>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttlSeconds: number = 300
) {
  return function (
    _target: unknown,
    _propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (this: unknown, ...args: Parameters<T>) {
      const cache = getCache();
      const cacheKey = keyGenerator(...args);

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        logger.debug("Cache hit", { key: cacheKey });
        return cached;
      }

      // Execute and cache result
      logger.debug("Cache miss", { key: cacheKey });
      const result = await method.apply(this as ThisParameterType<T>, args);
      await cache.set(cacheKey, result, ttlSeconds);

      return result;
    } as T;
  };
}
