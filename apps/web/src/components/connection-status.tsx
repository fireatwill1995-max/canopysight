"use client";

import { trpc } from "@/lib/trpc/client";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const { connected: wsConnected } = useWebSocket();

  // Check API connection - only check once, don't spam
  const { isError, isSuccess, isLoading } = trpc.system.ping.useQuery(undefined, {
    retry: false,
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on focus
    enabled: typeof window !== "undefined", // Only run on client
  });

  useEffect(() => {
    if (isSuccess) {
      setApiConnected(true);
      setShowWarning(false);
    } else if (isError && !isLoading) {
      setApiConnected(false);
      // Only show warning after a delay to avoid flashing
      const timer = setTimeout(() => setShowWarning(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isError, isLoading]);

  // Only show if there's a connection issue and we've waited a bit
  if (showWarning && apiConnected === false) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-in slide-in-from-bottom-5">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">API Server Not Connected</p>
            <p className="text-xs mt-1">
              Make sure the API server is running. Run <code className="bg-yellow-200 px-1 rounded text-xs">npm run dev</code> in the root directory.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
