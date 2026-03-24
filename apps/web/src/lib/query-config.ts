import type { DefaultOptions } from "@tanstack/react-query";

/**
 * Default TanStack Query options optimized for Canopy Sight.
 *
 * - staleTime: 30s -- data is fresh for 30 seconds before background refetch
 * - gcTime: 5min   -- unused cache entries are garbage collected after 5 minutes
 * - retry: 1 for queries (skip retries on connection errors), 0 for mutations
 * - refetchOnWindowFocus: true  -- refresh stale data when user returns to tab
 * - refetchOnReconnect: true    -- refresh after network reconnection
 */
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: unknown) => {
      // Don't retry on connection refused errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("ERR_CONNECTION_REFUSED")
      ) {
        return false;
      }
      return failureCount < 1;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: 0,
  },
};
