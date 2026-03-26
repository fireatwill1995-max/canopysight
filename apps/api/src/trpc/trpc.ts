import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { performanceMiddleware } from "../middleware/performance";
import { auditMiddleware } from "../middleware/audit-middleware";
import { RateLimiter } from "../middleware/rate-limiter";
import { logger } from "@canopy-sight/config";

const rateLimiter = new RateLimiter(
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 600
);

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // Log errors with context
    if (error.code === "INTERNAL_SERVER_ERROR") {
      const path = "path" in error ? (error as { path?: string }).path : undefined;
      logger.error("tRPC internal server error", error.cause || error, {
        code: error.code,
        path,
      });
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        // Don't expose stack traces in production
        stack:
          process.env.NODE_ENV === "development" && error.stack
            ? error.stack
            : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure.use(performanceMiddleware());

// Protected procedure - requires authentication + rate limit + audit
export const protectedProcedure = t.procedure
  .use(performanceMiddleware())
  .use(auditMiddleware())
  .use(async (opts) => {
    const key = opts.ctx.organizationId || opts.ctx.userId || "anonymous";
    if (!rateLimiter.check(key)) {
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
    return opts.next({ ctx: opts.ctx });
  })
  .use(async ({ ctx, next }) => {
    // Check if context was created successfully
    if (!ctx.organizationId) {
      // If database connection failed, provide helpful error
      throw new TRPCError({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed. Please check if the database is running and accessible.",
      });
    }
    
    if (!ctx.userId || !ctx.organizationId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        userRole: ctx.userRole,
      },
    });
  });

// Admin procedure - requires admin role
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.userRole !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});
