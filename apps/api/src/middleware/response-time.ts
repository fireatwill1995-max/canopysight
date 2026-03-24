import type { Request, Response, NextFunction } from "express";
import { logger } from "@canopy-sight/config";

const SLOW_REQUEST_THRESHOLD_MS = 1000;

/**
 * Tracks request duration and sets X-Response-Time header.
 * Logs a warning for requests slower than 1000ms.
 */
export function responseTimeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();

  // Set header before response is sent (overwritten with actual value on finish
  // via the writeHead hook below)
  const originalWriteHead = res.writeHead.bind(res);
  (res as any).writeHead = function (
    statusCode: number,
    ...args: any[]
  ) {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs / 1_000_000n);
    res.setHeader("X-Response-Time", `${durationMs}ms`);
    return originalWriteHead(statusCode, ...args);
  };

  res.on("finish", () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs / 1_000_000n);

    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn("Slow request", {
        method: req.method,
        path: req.originalUrl,
        duration: durationMs,
        statusCode: res.statusCode,
        requestId: (req as Request & { requestId?: string }).requestId,
      });
    }
  });

  next();
}
