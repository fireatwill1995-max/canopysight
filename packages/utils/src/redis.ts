import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables"
      );
    }

    redisInstance = new Redis({ url, token });
  }

  return redisInstance;
}

/** Get a cached value by key. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  return redis.get<T>(key);
}

/** Set a cached value with optional TTL in seconds. */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedis();
  if (ttlSeconds) {
    await redis.set(key, value, { ex: ttlSeconds });
  } else {
    await redis.set(key, value);
  }
}

/** Delete a cached value by key. */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

/** Invalidate all keys matching a glob pattern. */
export async function cacheInvalidate(pattern: string): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== 0);
}

/**
 * Sliding window rate limiter.
 * Returns { allowed: boolean; remaining: number; resetMs: number }
 */
export async function rateLimiter(
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const redis = getRedis();
  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  // Remove entries outside the window
  pipeline.zremrangebyscore(key, 0, windowStart);
  // Add the current request
  pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` });
  // Count requests in window
  pipeline.zcard(key);
  // Set expiry on the key
  pipeline.pexpire(key, windowMs);

  const results = await pipeline.exec();
  const count = results[2] as number;

  const allowed = count <= maxRequests;
  const remaining = Math.max(0, maxRequests - count);

  return { allowed, remaining, resetMs: windowMs };
}
