# Codebase Audit and Fixes Applied

This document summarizes the exhaustive audit and all fixes applied to the Canopy Sight codebase.

## 1. Root & Configuration

### package.json
- **Clean script**: Replaced Unix-only `rm -rf node_modules` with cross-platform Node.js `require('fs').rmSync('node_modules', { recursive: true, force: true })` so `npm run clean` works on Windows.

### turbo.json
- No issues found; pipeline and outputs are correct.

## 2. API (apps/api)

### server.ts
- **CORS**: Replaced `callback(new Error("Not allowed by CORS"))` with `callback(null, false)` so Express CORS middleware does not throw; rejected origins are simply not allowed.
- **wsServer export**: Kept for backward compatibility; detection router now uses `getWsServer()` from ws-server-ref to avoid circular dependency.

### Circular dependency fix
- **detection.router → server**: Introduced `services/ws-server-ref.ts` with `setWsServerRef()` and `getWsServer()`. Server calls `setWsServerRef(wsServer)` after creating the WebSocket server; detection.router uses `getWsServer()?.broadcastDetection(...)` instead of importing from server. This removes the cycle server → router → detection.router → server.

### middleware/openapi.ts
- **Types**: Replaced `req: any, res: any` with `import("express").Request` and `import("express").Response` for type safety.

### middleware/validation.ts
- **createSanitizedSchema**: Function now returns the schema (added `return schema`) and is typed as `createSanitizedSchema<T>(schema: T): T`. Previously it did not return the schema.

### middleware/security.ts
- No changes; CORS and security setup are correct.

### services/websocket-server.ts
- **CORS**: Replaced `callback(new Error("Not allowed by CORS"))` with `callback(null, false)` for Socket.IO CORS.

### services/alert-dispatcher.ts
- **Webhook catch**: In the catch block, replaced `webhookUrl` (possibly undefined) with `config?.url` when logging to avoid referencing an undefined variable.

### services/event-aggregator.ts
- **scheduleDailyAggregation**: Fixed midnight calculation: use a copy of `now` for midnight, and if `msUntilMidnight` is negative (e.g. just after midnight), add 24 hours. Replaced `console.error` in daily aggregation with `logger.warn` for consistency.
- **setInterval**: Wrapped daily aggregation in `setInterval` so it runs every 24 hours after the first run.

### services/cache.ts
- **Redis client typing**: Introduced a minimal `RedisLikeClient` interface and typed `RedisCache.client` as `RedisLikeClient | null` to avoid `any` and satisfy type-check when ioredis is dynamically imported.
- **Redis connect**: Removed incorrect `await this.client.connect()` (ioredis connects on construction). Rely on constructor and event handlers.

### services/ws-server-ref.ts (new)
- New module to hold the WebSocket server reference and break the server ↔ detection.router circular dependency.

### router/alert.router.ts
- Removed unused import `alertSubscriptionSchema`.
- **Catch block**: In the update mutation catch, replaced `alertId: id` with `alertId: input.id` because `id` is declared inside the try block and is not in scope in the catch.

### router/detection.router.ts
- Replaced direct `wsServer` import from server with `getWsServer()` from `../services/ws-server-ref`.
- Added missing imports for `cacheMiddleware` and `cacheInvalidation` from `../middleware/cache-middleware`.

### router/device.router.ts
- **Update catch**: Replaced `deviceId: id` with `deviceId: input.id` in the catch block.
- **Delete mutation**: Fixed logic: assign result of `ctx.prisma.device.delete(...)` to `deleted`, log, then `return deleted`. Previously the code returned the delete result and had unreachable `logger.info` and `return deleted`.

### router/incident.router.ts
- **Catch block**: Replaced `incidentId: id` with `incidentId: input.id` in the update mutation catch.

### router/zone.router.ts
- **Catch block**: Replaced `zoneId: id` with `zoneId: input.id` in the update mutation catch.

### middleware/performance.ts
- **Logger context**: Pass a `LogContext`-compatible object to the logger by building `logContext = { ...metrics }` and passing `logContext` so `PerformanceMetrics` is not passed where an index signature is required.

### trpc/context.ts, trpc/trpc.ts
- No logic changes; remaining type strictness (e.g. middleware generics) may show up when type-checking from web and can be addressed with explicit types or casts if needed.

## 3. Edge Agent (apps/edge-agent)

### index.ts
- **Shutdown**: Replaced duplicate SIGINT/SIGTERM handlers with a single `shutdown(signal)` async function and `process.on("SIGINT", () => void shutdown("SIGINT"))` (and same for SIGTERM) so shutdown is awaited and exit happens in a `finally` block.

### network/meshconnect.ts
- **initialize(meshConfig)**: Normalized API/config input by treating `meshConfig` as `Record<string, unknown>` and building a typed `MeshConnectConfig` with safe defaults and type checks (e.g. `String()`, enum checks for frequencyBand, typeof for numbers/booleans/strings). Avoids assigning raw/unknown shapes to `this.config`.
- **getTopology**: Stored `this.status` in a local `status` and used it in the return object and in the `edges` map to satisfy “object possibly null” checks.
- **startTopologyUpdates**: Used a local `nodeId = this.status.nodeId` and checked `this.status` before mutating `neighborNodes` to satisfy null checks.
- **connectToMesh**: Derived `meshNodeId` from config with a fallback before creating `this.status` to avoid non-null assertion.

## 4. Web (apps/web)

### hooks/use-websocket.ts
- **Stale closure**: Used a ref `optionsRef` and set `optionsRef.current = options` on each render. Socket event handlers call `optionsRef.current.onAlert?.(alert)` (and similarly for onDetection, onDeviceStatus) so the latest callbacks are always used.
- Removed unused `getDemoUser` import.

## 5. Packages

### packages/config
- **package.json exports**: Added subpath exports for TypeScript configs: `./typescript/base.json`, `./typescript/node.json`, `./typescript/nextjs.json` so other packages can extend them (e.g. `@canopy-sight/config/typescript/base.json`).
- **logger.ts**: Exported `LogContext`. Widened context parameter types to `LogContext | Record<string, unknown>` in `formatMessage`, `debug`, `info`, `warn`, and `error` so objects like `PerformanceMetrics` can be passed in after spreading into a `LogContext` in callers.

### packages/ui
- **tsconfig.json**: Set `moduleResolution: "bundler"`, `noEmit: true`, and `exclude: ["node_modules"]` so type-check resolves modules and React types correctly and avoids node_modules type errors when extending base config.

## 6. Remaining Considerations (not fixed in this pass)

- **Prisma `metadata` / Json**: Some routers pass `Record<string, unknown>` for `metadata` where Prisma expects `InputJsonValue`. These can be cast (e.g. `as Prisma.InputJsonValue`) or validated with a small helper where stricter typing is required.
- **tRPC middleware types**: When the web app type-checks and pulls in API source, tRPC middleware and procedure types can be strict. Aligning middleware signatures with tRPC’s `MiddlewareBuilder`/`MiddlewareResult` (or using type assertions) would clear those errors.
- **cache.ts and ioredis**: The API uses a dynamic `import("ioredis")` and a `RedisLikeClient` interface. If the web (or another consumer) type-checks the API and does not have `ioredis` installed, `find module 'ioredis'` may appear; adding `ioredis` as an optional dependency or keeping the dynamic import behind a try/catch and typing with an interface (as done) keeps runtime behavior correct.
- **Web-specific types**: Some web pages/components (e.g. playback boundingBox, sites LiveAlert deviceId, mesh-topology-view neighborNodes, meshconnect-config nodeStatus) may need local type definitions or backend type alignment for full type-check cleanliness.

## 7. Summary

- **Security / robustness**: CORS handling corrected; no Error thrown in CORS callbacks. Webhook error logging uses safe references. Context and catch blocks use the correct variables.
- **Correctness**: Device delete mutation fixed (assign result, log, return). Event aggregator daily schedule and midnight calculation fixed. Validation helper returns the schema. Detection router no longer creates a circular dependency.
- **Types**: Logger context and config exports fixed; edge-agent MeshConnect and null checks fixed; UI tsconfig fixed; router catch blocks and device delete fixed; API cache and OpenAPI handlers typed properly.
- **Cross-platform**: Root `clean` script works on Windows.
- **Maintainability**: Centralized WebSocket ref, consistent logging, and clearer types improve readability and future changes.

All changes were made to align with the existing architecture and to move the codebase toward production-ready, type-safe, and cross-platform behavior without introducing new breaking changes.
