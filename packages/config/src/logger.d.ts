/**
 * Centralized logging utility
 * Provides structured logging with different levels
 */
export interface LogContext {
    [key: string]: unknown;
}
declare class Logger {
    private isDevelopment;
    private isProduction;
    constructor();
    private formatMessage;
    debug(message: string, context?: LogContext | Record<string, unknown>): void;
    info(message: string, context?: LogContext | Record<string, unknown>): void;
    warn(message: string, context?: LogContext | Record<string, unknown>): void;
    error(message: string, error?: Error | unknown, context?: LogContext | Record<string, unknown>): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map