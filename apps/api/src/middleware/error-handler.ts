import { TRPCError } from "@trpc/server";
import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

/**
 * Global error handler for tRPC procedures
 */
export function handleTRPCError(error: unknown): TRPCError {
  // Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; meta?: unknown };
    
    if (prismaError.code === "P2002") {
      return new TRPCError({
        code: "CONFLICT",
        message: "A record with this value already exists",
      });
    }
    
    if (prismaError.code === "P2025") {
      return new TRPCError({
        code: "NOT_FOUND",
        message: "Record not found",
      });
    }
  }

  // TRPC errors - pass through
  if (error instanceof TRPCError) {
    return error;
  }

  // Unknown errors
  logger.error("Unhandled error in tRPC procedure", error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
}

/**
 * Wrapper for database operations with error handling
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Database operation failed"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(errorMessage, error);
    throw handleTRPCError(error);
  }
}
