import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Assigns a unique request ID to each incoming request.
 * Preserves existing X-Request-ID from the client if present.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) || randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
}
