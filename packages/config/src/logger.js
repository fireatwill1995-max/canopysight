"use strict";
/**
 * Centralized logging utility
 * Provides structured logging with different levels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    isDevelopment;
    isProduction;
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === "development";
        this.isProduction = process.env.NODE_ENV === "production";
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : "";
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }
    debug(message, context) {
        if (this.isDevelopment) {
            console.debug(this.formatMessage("debug", message, context));
        }
    }
    info(message, context) {
        if (this.isDevelopment || this.isProduction) {
            console.info(this.formatMessage("info", message, context));
        }
    }
    warn(message, context) {
        console.warn(this.formatMessage("warn", message, context));
    }
    error(message, error, context) {
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
exports.logger = new Logger();
