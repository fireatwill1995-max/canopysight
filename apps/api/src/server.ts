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
import { setWsServerRef } from "./services/ws-server-ref";
import { alertDispatcher } from "./services/alert-dispatcher";
import { createHealthRouter } from "./router/health.router";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@canopy-sight/database";

setupSentry();

const app = express();
const httpServer = createServer(app);

const wsServer = new WebSocketServer(httpServer);
setWsServerRef(wsServer);

alertDispatcher.setWebSocketServer(wsServer);

// Start event aggregator (non-blocking, handles DB connection errors gracefully)
eventAggregator.start().catch((error) => {
  logger.warn("Event aggregator startup warning (non-critical)", {
    error: error instanceof Error ? error.message : String(error),
  });
});

// CORS must be registered BEFORE Helmet / security middleware
const corsOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
const ngrokPattern = /^https:\/\/.*\.ngrok(-free)?\.(dev|io|app)$/;
const defaultAllowed = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://canopy-sight-web.fly.dev",
  "https://canopysight.app",
  "https://www.canopysight.app",
  "https://api.canopysight.app",
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

// Security middleware (after CORS so preflight responses include CORS headers)
setupSecurityMiddleware(app);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check routes - before tRPC to avoid context creation overhead
// GET /health         — basic liveness
// GET /health/ready   — readiness probe (DB + Redis)
// GET /health/detailed — full system status (requires x-health-key header)
app.use("/health", createHealthRouter());

// ── Canopy Copilot SSE streaming endpoint ─────────────────────────────────
// POST /ai/stream  { message, siteId?, organizationId? }
// Returns: text/event-stream  data: {"type":"delta","text":"..."}\n\n
//          terminated by      data: {"type":"done"}\n\n
//
// This uses the Anthropic streaming API directly because tRPC does not natively
// support long-lived SSE streams for per-token delivery.

const AI_STREAM_SYSTEM_PROMPT = `You are Canopy Copilot, the intelligence officer for Canopy Sight wildlife surveillance platform.
You have access to real-time detection data, alerts, and site intelligence.
You speak with authority about wildlife conservation and anti-poaching operations.
Always ground your responses in the actual data provided. Cite specific numbers.
Be actionable - every response should include at least one concrete recommendation.`;

app.post("/ai/stream", async (req: express.Request, res: express.Response) => {
  const { message, siteId, organizationId } = req.body as {
    message?: string;
    siteId?: string;
    organizationId?: string;
  };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Set SSE headers — must be done before any writing
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering on Fly.io
  res.flushHeaders();

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Keep-alive ping so the connection doesn't time out on Fly.io (30s limit)
  const keepAliveTimer = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 15_000);

  const cleanup = () => {
    clearInterval(keepAliveTimer);
  };

  req.on("close", cleanup);

  try {
    // Build live context snippet from DB
    let contextSnippet = "";
    try {
      const orgId = organizationId || "demo-org";
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [alertCount, detectionCount] = await Promise.all([
        prisma.alert.count({
          where: {
            ...(siteId ? { siteId } : {}),
            status: { in: ["active", "acknowledged"] },
            createdAt: { gte: last24h },
            // organizationId filter — use slug-based lookup only if real org lookup is available
          },
        }),
        prisma.detectionEvent.count({
          where: {
            ...(siteId ? { siteId } : {}),
            timestamp: { gte: last24h },
          },
        }),
      ]);

      contextSnippet = `\n\n[Live context: ${detectionCount} detection(s) and ${alertCount} active alert(s) in the last 24 hours${siteId ? ` at this site` : ``}.]`;
    } catch {
      // Non-fatal — continue without live context
    }

    const userContent = message + contextSnippet;

    if (!process.env.ANTHROPIC_API_KEY) {
      // Demo mode — simulate a streaming response
      const demoText = `[Canopy Copilot — Demo Mode]\n\nYou asked: "${message}"\n\nTo enable real AI streaming, set the ANTHROPIC_API_KEY environment variable on the server.`;
      for (const char of demoText) {
        sendEvent({ type: "delta", text: char });
      }
      sendEvent({ type: "done" });
      cleanup();
      res.end();
      return;
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: AI_STREAM_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    stream.on("text", (text) => {
      sendEvent({ type: "delta", text });
    });

    stream.on("error", (error) => {
      logger.error("AI stream error", error);
      sendEvent({ type: "error", message: error.message ?? "Stream error" });
      cleanup();
      res.end();
    });

    stream.on("finalMessage", (msg) => {
      sendEvent({
        type: "done",
        model: msg.model,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      });
      cleanup();
      res.end();
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    logger.error("AI stream endpoint error", error);
    sendEvent({ type: "error", message });
    cleanup();
    res.end();
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
