export { appRouter, type AppRouter } from "./router";
import type { AppRouter } from "./router";
import type { inferRouterOutputs } from "@trpc/server";

/** Inferred output types for all procedures; use in web app for type-safe tRPC data */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
