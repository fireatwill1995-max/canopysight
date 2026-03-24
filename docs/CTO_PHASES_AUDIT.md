# CTO Phases Audit — Canopy Sight

**Date:** 2025-03-17  
**Context:** Post Phase 1 (API URL centralization), lint/build fixed. Phases 2–15 executed as audit; actionable items listed.

---

## Phase 1 — Architecture & Centralization ✅ DONE

- **API URL centralization:** `apps/web/src/lib/api-config.ts` provides `getApiBaseUrl()`, `getTrpcUrl()`, `getWebSocketUrl()`.
- **Consumers updated:** `providers.tsx`, api-proxy trpc route, api-proxy health route, `use-websocket.ts`.
- **Lint:** All 11 packages pass (warnings only: no-explicit-any, react-hooks/exhaustive-deps).
- **Build:** Full turbo build succeeds (web, api, edge-agent, alert-engine, video-processor).

---

## Phase 2 — Dependency & Supply Chain

**Actions taken:** Repository intelligence already documents dependency graph; no circular deps.

**Recommendations:**
- Run `npm audit` and `npm audit fix` (or review) regularly; address high/critical.
- Pin major versions in package.json where possible; use `npm ci` in CI.
- Lockfile: keep `package-lock.json` committed; consider Dependabot or Renovate for updates.
- **Noted:** `packages/ai` uses `@anthropic-ai/sdk`, `openai`, `@langchain/*`; ensure API keys are never in client bundle.

---

## Phase 3 — Static Code Analysis

**Status:** ESLint runs in all packages; shared base in `packages/config/eslint/base.js`; Next.js app uses `nextjs.js` (next/core-web-vitals).

**Remaining (non-blocking):**
- Reduce `@typescript-eslint/no-explicit-any` warnings (ai, api tests, web) by typing `any` as `unknown` or specific types.
- Consider enabling `react-hooks/exhaustive-deps` as error in CI or fixing deps in `live-video-feed.tsx` and `zone-editor.tsx`.

---

## Phase 4 — Type Safety

- **Strictness:** TS configs use strict or near-strict; workspace packages type-check.
- **Gaps:** LangChain/Claude wrappers use `any` in chains; tRPC middleware uses `any` (documented). Validators (Zod) used at API boundary.
- **Recommendation:** Gradually replace `any` in `packages/ai/src/langchain/chains.ts` with generics or `unknown` where safe.

---

## Phase 5 — Execution Path Simulation

- **Entry points:** Documented in REPOSITORY_INTELLIGENCE (Web → Next, API → Express + tRPC + WS, Edge → index).
- **Critical paths:** Auth context (demo headers) → tRPC context → procedures → Prisma/AI. WebSocket: demoMode or token → subscribe events.
- **Recommendation:** Add a small number of E2E or integration tests for sign-in → dashboard and one tRPC flow to guard regressions.

---

## Phase 6 — Runtime Safety

- **Validation:** Zod schemas at tRPC input; sanitization in `validation.ts` (string length, control chars).
- **Env:** API keys and secrets via env; no hardcoded credentials found.
- **Recommendation:** Ensure all tRPC procedures that mutate data use Zod (or shared validators); add rate limiting on public/ingestion endpoints if exposed.

---

## Phase 7 — Error Handling

- **API:** TRPCError with codes; Sentry in API when DSN set; catch in api-proxy and health route.
- **Web:** Toasts for user-facing errors; some catch blocks ignore error (intentional).
- **Recommendation:** Standardize error codes and messages for client handling; ensure sensitive details are not leaked in API responses.

---

## Phase 8 — State Management

- **Web:** React Query + tRPC; local state (useState) for UI; WebSocket state in `use-websocket.ts`.
- **API:** Stateless; context per request; optional Redis cache.
- **Recommendation:** Document expected cache invalidation when mutations occur (e.g. alert resolve invalidating list).

---

## Phase 9 — API & Networking

- **REST:** Health, OpenAPI docs.
- **tRPC:** All app routes under one router; batching via httpBatchLink.
- **WebSocket:** Socket.IO; demo or token auth; subscribe channels.
- **Centralization:** Phase 1 completed; API/WS URLs from `api-config.ts`.
- **Recommendation:** Keep OpenAPI in sync with tRPC if consumed by external clients; consider request timeouts and retries where appropriate.

---

## Phase 10 — Security Hardening

- **Auth:** Demo via headers; Clerk for root redirect only; WebSocket accepts demoMode.
- **CORS:** Configured (localhost, ngrok, Fly, ALLOWED_ORIGINS).
- **Helmet:** Used in API.
- **Secrets:** Env-based; no secrets in repo.
- **Recommendation:** Before production: enforce real auth (Clerk or other); rate limit and validate all inputs; audit WebSocket auth and channel access.

---

## Phase 11 — Performance

- **Web:** Next.js 14; static/dynamic routes; dynamic imports for heavy components (e.g. LiveVideoFeed).
- **API:** Optional Redis cache for tRPC queries; Prisma for DB.
- **Recommendation:** Monitor slow procedures; consider caching for heatmap/analytics if needed; ensure DB indexes match query patterns (Prisma schema).

---

## Phase 12 — Test Generation

- **Current:** Vitest; tests in `apps/api/src/__tests__` (alert, detection, device routers).
- **Recommendation:** Add tests for critical paths (e.g. site list, device create, alert resolve); add one E2E for web dashboard load; consider coverage gates in CI.

---

## Phase 13 — Accessibility & UI

- **Stack:** React, Tailwind, ShadCN-style in packages/ui.
- **Recommendation:** Run axe or Lighthouse a11y on key pages (dashboard, alerts, sign-in); ensure focus management and ARIA where needed; touch targets and contrast for mobile.

---

## Phase 14 — Build & Infrastructure

- **Status:** Turbo build and lint pass; API build runs `tsc -p apps/api` from root; web uses Next.js with workspace packages.
- **ESLint:** All packages have config (root or local .eslintrc) extending shared base; web uses Next.js ESLint.
- **Recommendation:** CI should run `npm ci && npm run lint && npm run build`; deploy pipeline (e.g. Fly) should use same build artifacts.

---

## Phase 15 — Observability & Operations

- **Sentry:** Wired in API when SENTRY_DSN set.
- **Logging:** `@canopy-sight/config` logger; used in API and some packages.
- **Health:** `/health` and api-proxy health; system.ping for dashboard.
- **Recommendation:** Add structured logging (e.g. request id, userId); consider metrics (e.g. request duration, error rate) for API; document runbooks for degraded/error states.

---

## Summary

| Phase | Focus | Status |
|-------|--------|--------|
| 1 | Architecture / centralization | ✅ Done (api-config, lint, build) |
| 2 | Dependencies | ✅ Audited; run npm audit regularly |
| 3 | Static analysis | ✅ Lint passing; optional warning cleanup |
| 4–15 | Type safety → observability | ✅ Documented; recommendations above |

**Implemented (post-audit):**
- **Rate limiting:** Protected tRPC procedures use in-memory rate limiter (configurable via `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`).
- **CI:** Lint job enabled in `.github/workflows/ci.yml` (runs `npm run lint` after `npm ci` and Prisma generate).
- **E2E:** Playwright added; `e2e/smoke.spec.ts` (home redirect, sign-in page); run with `npm run e2e` (optional `npm run e2e:headed`). Use `PLAYWRIGHT_BASE_URL` or let config start web dev server when not in CI.
- **Dependabot:** `.github/dependabot.yml` for weekly npm and github-actions updates; minor/patch grouped.
- **Scripts:** `npm run audit` and `npm run audit:fix` in root package.json.
- **A11y:** Main content wrapped in `<main id="main-content" role="main" aria-label="Main content" tabIndex={-1}>` in layout.
- **Typing:** Alerts page select handlers use union types instead of `any`; eslint-disable for intentional exhaustive-deps in live-video-feed and zone-editor.

**Next steps (optional):**
1. Run `npm audit` and `npm audit fix`; review remaining vulnerabilities (e.g. 34 reported after install).
2. Replace remaining `any` in ai, web analytics/devices, and API tests.
3. Before production: enforce real auth, review rate limits, and run full a11y audit (e.g. axe).
