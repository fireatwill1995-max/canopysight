"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { isDemoMode } from "@/lib/demo-auth";

interface Alert {
  id: string;
  severity: "advisory" | "warning" | "critical";
  title: string;
  message: string;
  siteId: string;
  timestamp: Date;
}

interface Detection {
  id: string;
  type: string;
  confidence: number;
  siteId: string;
  timestamp: Date;
}

interface DeviceStatus {
  id: string;
  status: string;
  lastHeartbeat: Date;
}

interface UseWebSocketOptions {
  onAlert?: (alert: Alert) => void;
  onDetection?: (detection: Detection) => void;
  onDeviceStatus?: (device: DeviceStatus) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const failedAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);
  const maxReconnectDelay = 30000; // 30 seconds max delay

  optionsRef.current = options;

  useEffect(() => {
    const isNgrok =
      typeof window !== "undefined" && window.location.hostname.includes("ngrok");

    /**
     * Important: In our ngrok setup we expose the **web** app (Next.js) and proxy HTTP API calls
     * via `/api-proxy/*`. Next.js does not proxy WebSockets here, so Socket.IO won't work through
     * the same tunnel unless the API is separately exposed.
     *
     * If you want real-time WS over ngrok, set `NEXT_PUBLIC_WS_URL` to a public Socket.IO URL.
     */
    if (isNgrok && !process.env.NEXT_PUBLIC_WS_URL) {
      setConnected(false);
      setError(null);
      return;
    }

    // Socket.io client handles protocol conversion automatically
    // Use the API URL - Socket.io will use ws:// or wss:// as needed
    // If accessing via ngrok, we need to use the ngrok URL for WebSocket
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    if (isNgrok) {
      // For ngrok, WebSocket needs to go through the same ngrok tunnel
      // Use the current page's origin with wss protocol
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      apiUrl = `${wsProtocol}//${window.location.hostname}`;
    }
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || apiUrl;
    
    // Only connect if we have a valid URL
    if (!wsUrl) {
      setError("WebSocket URL not configured");
      return;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const getReconnectionDelay = (attempt: number): number => {
      const delay = Math.min(1000 * Math.pow(2, attempt), maxReconnectDelay);
      return delay;
    };

    const socket = io(wsUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000, // Initial delay
      reconnectionDelayMax: maxReconnectDelay,
      reconnectionAttempts: Infinity, // Keep trying indefinitely
      timeout: 10000,
      autoConnect: true,
      // Exponential backoff
      randomizationFactor: 0.5, // Add randomness to prevent thundering herd
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      setReconnecting(false);
      failedAttemptsRef.current = 0;

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Authenticate
      if (isDemoMode()) {
        socket.emit("authenticate", { demoMode: true });
      } else {
        // When re-adding auth, send real token here
        socket.emit("authenticate", { token: "placeholder" });
      }
    });

    socket.on("authenticated", (data: { success: boolean; error?: string }) => {
      if (data.success) {
        // Subscribe to events
        socket.emit("subscribe:alerts", {});
        socket.emit("subscribe:detections", {});
        socket.emit("subscribe:devices", {});
      } else {
        setError(data.error || "Authentication failed");
      }
    });

    socket.on("alert", (alert: Alert) => {
      optionsRef.current.onAlert?.(alert);
    });

    socket.on("detection", (detection: Detection) => {
      optionsRef.current.onDetection?.(detection);
    });

    socket.on("device:status", (device: DeviceStatus) => {
      optionsRef.current.onDeviceStatus?.(device);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (err: Error) => {
      failedAttemptsRef.current += 1;
      // Suppress noisy connection errors in development
      // Errors are handled via state (error, reconnecting) for UI feedback
      // No need to log to console - state management handles it
      setConnected(false);
      // Only set error after multiple failed attempts
      if (failedAttemptsRef.current >= 5) {
        setError("Unable to connect to server. Please check if the API server is running.");
      }
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    connected,
    reconnecting,
    error,
    socket: socketRef.current,
  };
}
