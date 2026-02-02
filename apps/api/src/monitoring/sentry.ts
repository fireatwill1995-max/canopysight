import * as Sentry from "@sentry/node";

/**
 * Sentry error tracking setup
 */
export function setupSentry(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
      ],
    });
  }
}
