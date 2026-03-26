import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "@canopy-sight/config";
import { prisma } from "@canopy-sight/database";

/**
 * WebSocket server for real-time updates
 * Provides live alerts, detection events, and device status
 */
export class WebSocketServer {
  private io: SocketIOServer;
  private connectedClients: Map<string, { userId: string; organizationId: string }> = new Map();

  constructor(httpServer: HTTPServer) {
    const ngrokPattern = /^https:\/\/.*\.ngrok(-free)?\.(dev|io|app)$/;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin
          if (!origin) {
            return callback(null, true);
          }

          // Allow localhost
          const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
          if (origin === frontendUrl || origin === "http://localhost:3000") {
            return callback(null, true);
          }

          // Allow ngrok domains
          if (ngrokPattern.test(origin)) {
            return callback(null, true);
          }

          // Allow from environment
          const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }

          callback(null, false);
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      path: "/socket.io",
    });

    this.setupEventHandlers();
  }

  // ---------------------------------------------------------------------------
  // Clerk JWT verification
  // ---------------------------------------------------------------------------

  /**
   * Verify a Clerk session token.
   *
   * Strategy (in order):
   *  1. If @clerk/clerk-sdk-node is available, use its verifyToken helper.
   *  2. Otherwise call the Clerk REST API to verify the session.
   *
   * Returns the Clerk userId (`sub` claim) on success, throws on failure.
   */
  private async verifyClerkToken(token: string): Promise<string> {
    const secretKey = process.env.CLERK_SECRET_KEY;

    // ---- Strategy 1: use @clerk/clerk-sdk-node if available ----
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const clerkSdk = require("@clerk/clerk-sdk-node") as {
        createClerkClient?: (opts: { secretKey: string }) => {
          verifyToken: (token: string) => Promise<{ sub: string }>;
        };
        clerkClient?: {
          verifyToken?: (token: string) => Promise<{ sub: string }>;
        };
      };

      if (secretKey) {
        if (typeof clerkSdk.createClerkClient === "function") {
          const client = clerkSdk.createClerkClient({ secretKey });
          const payload = await client.verifyToken(token);
          return payload.sub;
        }

        if (
          clerkSdk.clerkClient &&
          typeof clerkSdk.clerkClient.verifyToken === "function"
        ) {
          const payload = await clerkSdk.clerkClient.verifyToken(token);
          return payload.sub;
        }
      }
    } catch (requireErr) {
      logger.debug("@clerk/clerk-sdk-node unavailable or threw — falling back to REST API", {
        error: requireErr instanceof Error ? requireErr.message : String(requireErr),
      });
    }

    // ---- Strategy 2: Clerk REST API ----
    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY is not configured — cannot verify WebSocket token");
    }

    // Clerk session tokens are JWTs; their `sid` claim is the session ID.
    // We decode the payload to extract it (no signature verification here —
    // the Clerk API endpoint does that for us).
    let sessionId: string | undefined;
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        sessionId = typeof payload.sid === "string" ? payload.sid : undefined;
      }
    } catch {
      // ignore decode errors — the API will reject invalid tokens
    }

    if (!sessionId) {
      throw new Error("Unable to extract session ID from token");
    }

    const response = await fetch(
      `https://api.clerk.com/v1/sessions/${sessionId}/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`Clerk session verify failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      object?: string;
      user_id?: string;
    };

    if (!data.user_id) {
      throw new Error("Clerk API did not return a user_id");
    }

    return data.user_id;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      logger.info("WebSocket client connected", { socketId: socket.id });

      // Authenticate connection
      socket.on("authenticate", async (data: { token?: string; demoMode?: boolean }) => {
        try {
          // ---- Demo / development mode ----
          if (data.demoMode && process.env.NODE_ENV !== "production") {
            this.connectedClients.set(socket.id, {
              userId:         "demo-user",
              organizationId: "demo-org",
            });
            socket.emit("authenticated", { success: true });
            return;
          }

          // ---- Token-based auth ----
          if (!data.token || typeof data.token !== "string") {
            socket.emit("authenticated", { success: false, error: "No token provided" });
            return;
          }

          // Development mode: skip full verification but still set a dev identity
          if (process.env.NODE_ENV !== "production") {
            logger.warn("WebSocket: Token verification skipped in development mode", {
              socketId: socket.id,
            });
            this.connectedClients.set(socket.id, {
              userId:         "dev-user",
              organizationId: "dev-org",
            });
            socket.emit("authenticated", { success: true });
            return;
          }

          // Production: full Clerk JWT verification
          let clerkUserId: string;
          try {
            clerkUserId = await this.verifyClerkToken(data.token);
          } catch (verifyErr) {
            logger.warn("WebSocket token verification failed", {
              socketId: socket.id,
              error:    verifyErr instanceof Error ? verifyErr.message : "Unknown",
            });
            socket.emit("authenticated", { success: false, error: "Token verification failed" });
            socket.disconnect(true);
            return;
          }

          // Look up the user in the database to get our internal userId + org
          const user = await prisma.user.findUnique({
            where: { clerkId: clerkUserId },
          });

          if (!user) {
            logger.warn("WebSocket: Clerk user not found in DB", {
              socketId:    socket.id,
              clerkUserId,
            });
            socket.emit("authenticated", {
              success: false,
              error:   "User not found — please complete onboarding",
            });
            socket.disconnect(true);
            return;
          }

          this.connectedClients.set(socket.id, {
            userId:         user.id,
            organizationId: user.organizationId,
          });

          socket.emit("authenticated", { success: true });
          logger.info("WebSocket client authenticated", {
            socketId:       socket.id,
            userId:         user.id,
            organizationId: user.organizationId,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          logger.error("WebSocket authentication error", undefined, {
            socketId: socket.id,
            error:    process.env.NODE_ENV === "development" ? errorMessage : "Authentication failed",
          });
          socket.emit("authenticated", { success: false, error: "Authentication failed" });
        }
      });

      socket.on("subscribe:alerts", (filters: { siteIds?: string[]; minSeverity?: string }) => {
        if (!this.connectedClients.has(socket.id)) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        const orgId = this.getOrganizationId(socket.id);
        socket.join(`alerts:${orgId}`);
        logger.debug("Client subscribed to alerts", {
          socketId:       socket.id,
          organizationId: orgId,
          filters,
        });
      });

      socket.on("subscribe:detections", (filters: { siteIds?: string[] }) => {
        if (!this.connectedClients.has(socket.id)) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        const orgId = this.getOrganizationId(socket.id);
        socket.join(`detections:${orgId}`);
        logger.debug("Client subscribed to detections", {
          socketId:       socket.id,
          organizationId: orgId,
          filters,
        });
      });

      socket.on("subscribe:devices", () => {
        if (!this.connectedClients.has(socket.id)) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        const orgId = this.getOrganizationId(socket.id);
        socket.join(`devices:${orgId}`);
        logger.debug("Client subscribed to device status", {
          socketId:       socket.id,
          organizationId: orgId,
        });
      });

      socket.on("disconnect", () => {
        logger.info("WebSocket client disconnected", { socketId: socket.id });
        this.connectedClients.delete(socket.id);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast helpers
  // ---------------------------------------------------------------------------

  /**
   * Broadcast alert to organisation
   */
  broadcastAlert(organizationId: string, alert: {
    id:        string;
    severity:  string;
    title:     string;
    message:   string;
    siteId:    string;
    timestamp: Date;
  }): void {
    this.io.to(`alerts:${organizationId}`).emit("alert", alert);
  }

  /**
   * Broadcast detection event
   */
  broadcastDetection(organizationId: string, detection: {
    id:         string;
    type:       string;
    confidence: number;
    siteId:     string;
    timestamp:  Date;
  }): void {
    this.io.to(`detections:${organizationId}`).emit("detection", detection);
  }

  /**
   * Broadcast device status update
   */
  broadcastDeviceStatus(organizationId: string, device: {
    id:            string;
    status:        string;
    lastHeartbeat: Date;
  }): void {
    this.io.to(`devices:${organizationId}`).emit("device:status", device);
  }

  private getOrganizationId(socketId: string): string {
    return this.connectedClients.get(socketId)?.organizationId || "unknown";
  }

  /**
   * Get connected clients count
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
