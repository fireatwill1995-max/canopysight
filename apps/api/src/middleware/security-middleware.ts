import type { Request, Response, NextFunction } from "express";
import { requestIdMiddleware } from "./request-id";
import { responseTimeMiddleware } from "./response-time";

// Strip HTML tags from string values recursively
function sanitizeInput(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(/<[^>]*>/g, "");
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return obj;
}

// Input sanitization middleware - strips HTML from request body strings
export function inputSanitizationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeInput(req.body);
  }
  next();
}

// Content-Type validation for POST/PUT/PATCH
export function contentTypeValidation(req: Request, res: Response, next: NextFunction): void {
  const methodsRequiringBody = ["POST", "PUT", "PATCH"];

  if (methodsRequiringBody.includes(req.method) && req.headers["content-length"] !== "0") {
    const contentType = req.headers["content-type"];
    if (contentType && !contentType.includes("application/json") && !contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      res.status(415).json({
        error: "Unsupported Media Type",
        message: "Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded",
      });
      return;
    }
  }

  next();
}

// Combined setup function - delegates to canonical middleware implementations
export function setupEnhancedSecurityMiddleware(app: {
  use: (handler: (req: Request, res: Response, next: NextFunction) => void) => void;
}): void {
  app.use(requestIdMiddleware);
  app.use(responseTimeMiddleware);
  app.use(contentTypeValidation);
  app.use(inputSanitizationMiddleware);
}
