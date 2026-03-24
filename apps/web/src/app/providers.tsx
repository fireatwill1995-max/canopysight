"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { httpBatchLink } from "@trpc/client";
import { getDemoUser } from "@/lib/demo-auth";
import { ToastProvider } from "@canopy-sight/ui";
import { getTrpcUrl } from "@/lib/api-config";
import { defaultQueryOptions } from "@/lib/query-config";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: defaultQueryOptions,
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
