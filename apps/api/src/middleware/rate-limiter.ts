import { TRPCError } from "@trpc/server";
import type { Context } from "../trpc/context";
import { logger } from "@canopy-sight/config";

/**
 * Rate limiter middleware
 * In production, use Redis for distributed rate limiting
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.cleanupInterval = setInterval(() => this.cleanup(), windowMs * 2);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const active = timestamps.filter((t) => now - t < this.windowMs);
      if (active.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, active);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }

  /**
   * Check if request should be rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = requests.filter((time: number) => now - time < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      return false; // Rate limited
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true; // Allowed
  }

  /**
   * Middleware for tRPC procedures
   */
  middleware() {
    return async (opts: { ctx: Context; next: () => Promise<unknown> }) => {
      const key = opts.ctx.organizationId || opts.ctx.userId || "anonymous";
      
      if (!this.check(key)) {
        logger.warn("Rate limit exceeded", {
          key,
          organizationId: opts.ctx.organizationId,
          userId: opts.ctx.userId,
        });
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please try again later.",
        });
      }

      return opts.next();
    };
  }
}
