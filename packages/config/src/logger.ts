/**
 * Centralized logging utility
 * Provides structured logging with different levels
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.isProduction = process.env.NODE_ENV === "production";
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext | Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext | Record<string, unknown>): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext | Record<string, unknown>): void {
    if (this.isDevelopment || this.isProduction) {
      console.info(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext | Record<string, unknown>): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext | Record<string, unknown>): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
      } : error,
    };
    console.error(this.formatMessage("error", message, errorContext));
  }
}

export const logger = new Logger();
