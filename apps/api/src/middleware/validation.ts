import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logger } from "@canopy-sight/config";

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize string input - remove dangerous characters
   */
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== "string") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid input type",
      });
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, "");

    // Trim and limit length
    sanitized = sanitized.trim().slice(0, maxLength);

    return sanitized;
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(input: unknown, min?: number, max?: number): number {
    const num = typeof input === "number" ? input : Number(input);

    if (isNaN(num) || !isFinite(num)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid number",
      });
    }

    if (min !== undefined && num < min) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Number must be at least ${min}`,
      });
    }

    if (max !== undefined && num > max) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Number must be at most ${max}`,
      });
    }

    return num;
  }

  /**
   * Validate and sanitize date input
   */
  static sanitizeDate(input: unknown): Date {
    if (input instanceof Date) {
      if (isNaN(input.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid date",
        });
      }
      return input;
    }

    if (typeof input === "string") {
      const date = new Date(input);
      if (isNaN(date.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid date string",
        });
      }
      return date;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid date input",
    });
  }

  /**
   * Validate array input
   */
  static sanitizeArray<T>(
    input: unknown,
    itemValidator: (item: unknown) => T,
    maxLength: number = 100
  ): T[] {
    if (!Array.isArray(input)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Input must be an array",
      });
    }

    if (input.length > maxLength) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Array length exceeds maximum of ${maxLength}`,
      });
    }

    return input.map((item, index) => {
      try {
        return itemValidator(item);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid array item at index ${index}`,
        });
      }
    });
  }
}

/**
 * Enhanced Zod schema validation with sanitization
 */
export function createSanitizedSchema<T extends z.ZodTypeAny>(schema: T): T {
  schema.superRefine((_data, ctx) => {
    try {
      // Additional validation can be added here
      // For now, just pass through
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Validation failed",
      });
    }
  });
  return schema;
}

/**
 * Middleware to log validation errors
 */
export function logValidationError(
  error: unknown,
  input: unknown,
  procedure: string
): void {
  logger.warn("Validation error", {
    procedure,
    error: error instanceof Error ? error.message : String(error),
    inputType: typeof input,
    // Don't log full input in production to avoid exposing sensitive data
    inputPreview:
      process.env.NODE_ENV === "development"
        ? JSON.stringify(input).substring(0, 200)
        : "[redacted]",
  });
}
