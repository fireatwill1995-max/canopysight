"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { httpBatchLink } from "@trpc/client";
import { isDemoMode, getDemoUser } from "@/lib/demo-auth";
import { ToastProvider } from "@canopy-sight/ui";

function getTrpcUrl() {
  // If we're accessing via ngrok, use relative path to proxy through Next.js
  // Otherwise use the configured API URL
  if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
    // Use relative path - Next.js will proxy to local API
    return "/api-proxy/trpc";
  }
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("/trpc") ? trimmed : `${trimmed}/trpc`;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error: unknown) => {
              // Don't retry on connection refused errors
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage.includes("Failed to fetch") || 
                  errorMessage.includes("ERR_CONNECTION_REFUSED")) {
                return false;
              }
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
            onError: (error: unknown) => {
              // Suppress console errors for connection issues in development
              if (process.env.NODE_ENV === "development") {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes("Failed to fetch") || 
                    errorMessage.includes("ERR_CONNECTION_REFUSED")) {
                  // Silently handle - API server may not be running
                  return;
                }
              }
            },
          },
          mutations: {
            retry: false,
            onError: (error: unknown) => {
              // Suppress console errors for connection issues in development
              if (process.env.NODE_ENV === "development") {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes("Failed to fetch") || 
                    errorMessage.includes("ERR_CONNECTION_REFUSED")) {
                  return;
                }
              }
            },
          },
        },
      })
  );
  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [
          httpBatchLink({
            url: getTrpcUrl(),
            fetch(url, options = {}) {
              return fetch(url, {
                ...options,
                credentials: "include",
              });
            },
            headers: async () => {
              const demoUser = typeof window !== "undefined" ? getDemoUser() : null;
              return {
                "x-demo-mode": "true",
                "x-demo-user-id": demoUser?.userId ?? "demo-user-123",
                "x-demo-organization-id": demoUser?.organizationId ?? "demo-org-123",
                "x-demo-user-role": demoUser?.userRole ?? "admin",
              };
            },
          }),
        ],
      }),
    []
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
