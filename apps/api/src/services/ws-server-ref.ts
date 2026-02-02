import type { WebSocketServer } from "./websocket-server";

/**
 * Reference to the WebSocket server instance.
 * Set by server.ts after creating the server to avoid circular dependency
 * (router -> server -> router). Routers use getWsServer() instead of
 * importing from server.
 */
let wsServerInstance: WebSocketServer | null = null;

export function setWsServerRef(ws: WebSocketServer): void {
  wsServerInstance = ws;
}

export function getWsServer(): WebSocketServer | null {
  return wsServerInstance;
}
