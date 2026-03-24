export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options: { code?: string; statusCode?: number; isOperational?: boolean } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, { code: "NOT_FOUND", statusCode: 404 });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, { code: "UNAUTHORIZED", statusCode: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, { code: "FORBIDDEN", statusCode: 403 });
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message = "Validation failed", details: Record<string, string[]> = {}) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 400 });
    this.details = details;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs = 60_000) {
    super("Rate limit exceeded", { code: "RATE_LIMIT_EXCEEDED", statusCode: 429 });
    this.retryAfterMs = retryAfterMs;
  }
}

/** Serialize an error into a consistent API response shape. */
export function serializeError(err: unknown): {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, string[]>;
  };
} {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        ...(err instanceof ValidationError ? { details: err.details } : {}),
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "An unexpected error occurred",
      statusCode: 500,
    },
  };
}
