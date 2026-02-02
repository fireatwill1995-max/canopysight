/**
 * Shared API types for tRPC router
 * This ensures type safety across the monorepo
 */

import type { AppRouter } from "@canopy-sight/api";

export type { AppRouter };

// Re-export router type for use in web app
export type RouterOutput = AppRouter;
