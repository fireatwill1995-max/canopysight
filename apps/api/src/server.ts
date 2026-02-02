import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router";
import { createContext } from "./trpc/context";
import { setupSecurityMiddleware } from "./middleware/security";
import { setupSentry } from "./monitoring/sentry";
import { WebSocketServer } from "./services/websocket-server";
import { eventAggregator } from "./services/event-aggregator";
import { logger } from "@canopy-sight/config";
import { serveOpenAPISpec, serveSwaggerUI } from "./middleware/openapi";

// Initialize Sentry before other middleware
setupSentry();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer);
import { setWsServerRef } from "./services/ws-server-ref";
setWsServerRef(wsServer);

// Initialize services with WebSocket server
import { alertDispatcher } from "./services/alert-dispatcher";
alertDispatcher.setWebSocketServer(wsServer);

// Start event aggregator (non-blocking, handles DB connection errors gracefully)
eventAggregator.start().catch((error) => {
  logger.warn("Event aggregator startup warning (non-critical)", {
    error: error instanceof Error ? error.message : String(error),
  });
});

// Security middleware
setupSecurityMiddleware(app);

// Allow localhost, ngrok, Fly web app, and ALLOWED_ORIGINS
const corsOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
const ngrokPattern = /^https:\/\/.*\.ngrok(-free)?\.(dev|io|app)$/;
const defaultAllowed = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://canopy-sight-web.fly.dev",
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      if (origin === corsOrigin || defaultAllowed.includes(origin)) {
        return callback(null, true);
      }
      if (ngrokPattern.test(origin)) {
        return callback(null, true);
      }
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-demo-mode",
      "x-demo-user-id",
      "x-demo-organization-id",
      "x-demo-user-role",
    ],
  })
);
// Ensure all responses are JSON by default
app.use((req, res, next) => {
  // Set JSON content type for all responses
  res.setHeader("Content-Type", "application/json");
  next();
});

app.use(express.json({ limit: "10mb" })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint - before tRPC to avoid context creation overhead
app.get("/health", async (req, res) => {
  // Always return JSON, even on errors
  res.setHeader("Content-Type", "application/json");
  
  try {
    type HealthStatus = "ok" | "degraded" | "error";
    const health: {
      status: HealthStatus;
      timestamp: string;
      uptime: number;
      memory: { used: number; total: number; rss: number };
      database: "connected" | "disconnected" | "unknown";
    } = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      database: "unknown",
    };

    // Check database connection with timeout
    try {
      const { prisma } = await import("@canopy-sight/database");
      
      // Use Promise.race to add timeout
      const dbCheck = Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Database check timeout")), 2000)
        ),
      ]);
      
      await dbCheck;
      health.database = "connected";
    } catch (dbError) {
      // Database check failed - mark as disconnected but don't fail health check
      health.database = "disconnected";
      health.status = "degraded";
      logger.debug("Database health check failed", {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    // Catch any unexpected errors
    logger.error("Health check failed", error);
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === "development" 
        ? (error instanceof Error ? error.message : String(error))
        : undefined,
    });
  }
});

// tRPC middleware with error handling
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path, type }) => {
      // Log tRPC errors
      logger.error("tRPC error", error, {
        path,
        type,
        code: error.code,
      });
    },
  })
);

/**
 * Health check endpoint with detailed system status
 */
// API Documentation endpoints
app.get("/api/openapi.json", serveOpenAPISpec);
app.get("/api/docs", serveSwaggerUI);
app.get("/docs", serveSwaggerUI); // Alias

// Error handling middleware - must be after all routes
// This catches errors that weren't handled by tRPC or other middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Always return JSON
  if (!res.headersSent) {
    res.setHeader("Content-Type", "application/json");
    
    logger.error("Unhandled error in Express middleware", err, {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    // Don't expose internal error details in production
    const message = process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message;
      
    res.status(500).json({ 
      error: message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  } else {
    next(err);
  }
});

// 404 handler - must be after all routes
app.use((req: express.Request, res: express.Response) => {
  if (!res.headersSent) {
    res.setHeader("Content-Type", "application/json");
    res.status(404).json({
      error: "Not found",
      path: req.path,
    });
  }
});

const HOST = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT) || 3001;
httpServer.listen(port, HOST, () => {
  logger.info("API server started", {
    host: HOST,
    port,
    environment: process.env.NODE_ENV || "development",
    websocket: true,
    healthCheck: `/health`,
  });
}).on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${port} is already in use`, error);
  } else {
    logger.error("Server startup error", error);
  }
  process.exit(1);
});
