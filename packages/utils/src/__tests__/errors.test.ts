import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  RateLimitError,
  serializeError,
} from "../errors";

describe("AppError", () => {
  it("creates with default values", () => {
    const err = new AppError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("AppError");
  });

  it("creates with custom options", () => {
    const err = new AppError("Custom error", {
      code: "CUSTOM_CODE",
      statusCode: 418,
      isOperational: false,
    });
    expect(err.code).toBe("CUSTOM_CODE");
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(false);
  });

  it("has a stack trace", () => {
    const err = new AppError("trace me");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("trace me");
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found");
  });

  it("includes custom resource name in message", () => {
    const err = new NotFoundError("User");
    expect(err.message).toBe("User not found");
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Authentication required");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("has statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("Insufficient permissions");
  });
});

describe("ValidationError", () => {
  it("has statusCode 400", () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Validation failed");
  });

  it("stores validation details", () => {
    const details = { email: ["required", "invalid format"] };
    const err = new ValidationError("Invalid input", details);
    expect(err.details).toEqual(details);
  });

  it("defaults details to empty object", () => {
    const err = new ValidationError();
    expect(err.details).toEqual({});
  });
});

describe("RateLimitError", () => {
  it("has statusCode 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(err.message).toBe("Rate limit exceeded");
  });

  it("defaults retryAfterMs to 60000", () => {
    const err = new RateLimitError();
    expect(err.retryAfterMs).toBe(60_000);
  });

  it("accepts custom retryAfterMs", () => {
    const err = new RateLimitError(30_000);
    expect(err.retryAfterMs).toBe(30_000);
  });
});

describe("serializeError", () => {
  it("serializes AppError correctly", () => {
    const err = new AppError("Server error", { code: "SRV_ERR", statusCode: 503 });
    const result = serializeError(err);
    expect(result).toEqual({
      error: {
        code: "SRV_ERR",
        message: "Server error",
        statusCode: 503,
      },
    });
  });

  it("includes details for ValidationError", () => {
    const details = { name: ["too short"] };
    const err = new ValidationError("Bad input", details);
    const result = serializeError(err);
    expect(result.error.details).toEqual(details);
    expect(result.error.statusCode).toBe(400);
  });

  it("serializes NotFoundError", () => {
    const result = serializeError(new NotFoundError("Device"));
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.statusCode).toBe(404);
    expect(result.error.message).toBe("Device not found");
  });

  it("serializes plain Error as 500 INTERNAL_ERROR", () => {
    const result = serializeError(new Error("Oops"));
    expect(result).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Oops",
        statusCode: 500,
      },
    });
  });

  it("serializes non-Error values as generic 500", () => {
    const result = serializeError("string error");
    expect(result).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        statusCode: 500,
      },
    });
  });

  it("serializes null as generic 500", () => {
    const result = serializeError(null);
    expect(result.error.statusCode).toBe(500);
    expect(result.error.message).toBe("An unexpected error occurred");
  });
});
