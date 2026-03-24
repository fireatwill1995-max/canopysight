/**
 * Centralized API and WebSocket URL configuration for the web app.
 * Used by tRPC client, API proxy routes, and WebSocket hook.
 */

export const DEFAULT_API_URL = "http://localhost:3001";

/** Base URL of the backend API (no trailing slash). Safe for server and client. */
export function getApiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return base.replace(/\/+$/, "");
}

/** Full tRPC endpoint URL. On client, uses proxy when hostname is ngrok. */
export function getTrpcUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
    return "/api-proxy/trpc";
  }
  const base = getApiBaseUrl();
  return base.endsWith("/trpc") ? base : `${base}/trpc`;
}

/** WebSocket URL. On client, when hostname is ngrok without NEXT_PUBLIC_WS_URL, use current origin. */
export function getWebSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;
  if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}`;
  }
  const base = getApiBaseUrl();
  return base.replace(/^http/, "ws");
}
