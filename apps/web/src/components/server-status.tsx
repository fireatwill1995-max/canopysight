"use client";

import { useEffect, useState } from "react";

export function ServerStatus() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline" | "degraded">("checking");

  useEffect(() => {
    const checkApi = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // Use env API URL in production (Fly); proxy for ngrok; localhost for local dev
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const healthUrl =
          typeof window !== "undefined" && window.location.hostname.includes("ngrok")
            ? "/api-proxy/health"
            : `${apiBase.replace(/\/$/, "")}/health`;

        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        clearTimeout(timeoutId);
        
        // 200 = online; 503 = degraded (e.g. DB down but API up)
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          setApiStatus(data.status === "ok" ? "online" : "degraded");
        } else if (response.status === 503) {
          const data = await response.json().catch(() => ({}));
          setApiStatus(data.status === "degraded" ? "degraded" : "offline");
        } else {
          setApiStatus("offline");
        }
      } catch (error) {
        // Network errors or timeouts
        setApiStatus("offline");
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, []);

  if (apiStatus === "online") {
    return null; // Don't show anything when online
  }

  const message =
    apiStatus === "checking"
      ? "Checking API server..."
      : apiStatus === "degraded"
        ? "API degraded (some features may be limited)"
        : "API server starting...";

  return (
    <div className="fixed top-20 right-4 z-40 bg-blue-50 dark:bg-blue-950/90 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-100 px-4 py-2 rounded-lg shadow-md text-sm">
      <div className="flex items-center gap-2">
        <span className="animate-pulse">⏳</span>
        <span>{message}</span>
      </div>
    </div>
  );
}
