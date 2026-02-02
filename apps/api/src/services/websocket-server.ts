import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "@canopy-sight/config";

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

  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      logger.info("WebSocket client connected", { socketId: socket.id });

      // Authenticate connection
      socket.on("authenticate", async (data: { token?: string; demoMode?: boolean }) => {
        try {
          // Handle demo mode
          if (data.demoMode && process.env.NODE_ENV !== "production") {
            this.connectedClients.set(socket.id, {
              userId: "demo-user",
              organizationId: "demo-org",
            });
            socket.emit("authenticated", { success: true });
            return;
          }

          // Verify Clerk token
          if (data.token && typeof data.token === "string") {
            try {
              // In production, verify token with Clerk
              // For now, in dev mode, we accept demo mode tokens
              if (process.env.NODE_ENV === "production") {
                // TODO: Implement proper Clerk token verification
                // const { clerkClient } = await import("@clerk/clerk-sdk-node");
                // const session = await clerkClient.verifyToken(data.token);
                // if (!session) {
                //   throw new Error("Invalid token");
                // }
                // const user = await prisma.user.findUnique({ where: { clerkId: session.sub } });
                // if (!user) {
                //   throw new Error("User not found");
                // }
                // this.connectedClients.set(socket.id, {
                //   userId: user.id,
                //   organizationId: user.organizationId,
                // });
                socket.emit("authenticated", { success: false, error: "Token verification not implemented" });
                return;
              } else {
                // Dev mode: accept token but log warning
                logger.warn("WebSocket: Token verification skipped in development mode", {
                  socketId: socket.id,
                });
                this.connectedClients.set(socket.id, {
                  userId: "dev-user",
                  organizationId: "dev-org",
                });
                socket.emit("authenticated", { success: true });
              }
            } catch (verifyError) {
              const errorMessage = verifyError instanceof Error ? verifyError.message : "Token verification failed";
              socket.emit("authenticated", { success: false, error: errorMessage });
              return;
            }
          } else {
            socket.emit("authenticated", { success: false, error: "No token provided" });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          // Don't log full error in production to avoid exposing sensitive info
          logger.error("WebSocket authentication error", undefined, {
            socketId: socket.id,
            error: process.env.NODE_ENV === "development" ? errorMessage : "Authentication failed",
          });
          socket.emit("authenticated", { success: false, error: "Authentication failed" });
        }
      });

      // Subscribe to alerts
      socket.on("subscribe:alerts", (filters: { siteIds?: string[]; minSeverity?: string }) => {
        const orgId = this.getOrganizationId(socket.id);
        socket.join(`alerts:${orgId}`);
        logger.debug("Client subscribed to alerts", { socketId: socket.id, organizationId: orgId, filters });
      });

      // Subscribe to detections
      socket.on("subscribe:detections", (filters: { siteIds?: string[] }) => {
        const orgId = this.getOrganizationId(socket.id);
        socket.join(`detections:${orgId}`);
        logger.debug("Client subscribed to detections", { socketId: socket.id, organizationId: orgId, filters });
      });

      // Subscribe to device status
      socket.on("subscribe:devices", () => {
        const orgId = this.getOrganizationId(socket.id);
        socket.join(`devices:${orgId}`);
        logger.debug("Client subscribed to device status", { socketId: socket.id, organizationId: orgId });
      });

      socket.on("disconnect", () => {
        logger.info("WebSocket client disconnected", { socketId: socket.id });
        this.connectedClients.delete(socket.id);
      });
    });
  }

  /**
   * Broadcast alert to organization
   */
  broadcastAlert(organizationId: string, alert: {
    id: string;
    severity: string;
    title: string;
    message: string;
    siteId: string;
    timestamp: Date;
  }): void {
    this.io.to(`alerts:${organizationId}`).emit("alert", alert);
  }

  /**
   * Broadcast detection event
   */
  broadcastDetection(organizationId: string, detection: {
    id: string;
    type: string;
    confidence: number;
    siteId: string;
    timestamp: Date;
  }): void {
    this.io.to(`detections:${organizationId}`).emit("detection", detection);
  }

  /**
   * Broadcast device status update
   */
  broadcastDeviceStatus(organizationId: string, device: {
    id: string;
    status: string;
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
