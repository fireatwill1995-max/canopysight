import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@canopy-sight/api";

// Create typed tRPC React client (explicit type for portable declarations)
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> =
  createTRPCReact<AppRouter>();
