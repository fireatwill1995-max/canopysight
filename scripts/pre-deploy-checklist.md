# Canopy Sight — Pre-Deploy Checklist

Use this checklist before every production deployment. All items marked **Required** must pass before deploying.

---

## Environment & Configuration

- [ ] **Required** — All environment variables set in Fly.io secrets (see `.env.production.example`)
- [ ] **Required** — `DATABASE_URL` points to production Neon/Supabase PostgreSQL instance
- [ ] **Required** — `CLERK_SECRET_KEY` is set (production key, not test key)
- [ ] **Required** — `FRONTEND_URL` and `ALLOWED_ORIGINS` match the production web URL
- [ ] **Required** — `NODE_ENV=production` in fly.toml env section
- [ ] `SENTRY_DSN` configured for error monitoring
- [ ] `BETTERSTACK_API_KEY` configured for uptime monitoring

## Database

- [ ] **Required** — Database is accessible from Fly.io region (`syd`)
- [ ] **Required** — Prisma migrations applied: `fly ssh console -a canopy-sight-api -C "cd ../../packages/database && npx prisma migrate deploy"`
- [ ] Database backups are enabled and tested
- [ ] Connection pooling configured (PgBouncer or Prisma Accelerate)

## Redis / Caching

- [ ] Upstash Redis instance created (if using caching features)
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set
- [ ] Redis connection verified from Fly region

## Storage

- [ ] Cloudflare R2 bucket created (`canopy-sight-media`)
- [ ] R2 access keys set: `CLOUDFLARE_R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] CORS policy configured on R2 bucket for production domain

## AI / LLM Services

- [ ] `ANTHROPIC_API_KEY` set (if using Claude-based features)
- [ ] `OPENAI_API_KEY` set (if using embeddings/vector search)
- [ ] API usage limits and billing alerts configured

## CI / Build

- [ ] **Required** — CI pipeline passing on `main` branch (type-check, lint, test)
- [ ] **Required** — `scripts/validate-build.sh` passes locally
- [ ] **Required** — Docker images build successfully (`fly deploy --remote-only`)
- [ ] No high/critical vulnerabilities in `npm audit`

## Networking & Security

- [ ] **Required** — SSL/TLS certificates valid (Fly.io handles automatically)
- [ ] **Required** — CORS origins configured correctly in `fly.api.toml`
- [ ] **Required** — `force_https = true` in fly.toml
- [ ] Rate limiting enabled (default 200 req/min per org)
- [ ] Security headers present (X-Frame-Options, X-Content-Type-Options, HSTS)
- [ ] Audit logging active in protectedProcedure middleware

## Health & Monitoring

- [ ] **Required** — `/health` endpoint responds with `{"status":"ok"}` after deploy
- [ ] **Required** — Web app loads and renders dashboard
- [ ] Sentry DSN configured and test error received
- [ ] BetterStack uptime monitor pointing at `/health`
- [ ] Alert notification channels configured (email, Slack)

## Post-Deploy Verification

- [ ] Run `scripts/health-check.sh https://canopy-sight-api.fly.dev https://canopy-sight-web.fly.dev`
- [ ] Verify WebSocket connection from web dashboard (live feed indicator)
- [ ] Verify tRPC calls succeed from web to API (open DevTools Network tab)
- [ ] Check Sentry for new errors in the first 15 minutes
- [ ] Verify Fly.io machine logs: `fly logs -a canopy-sight-api`

---

## Rollback Plan

If the deploy causes issues:

1. **Immediate rollback**: `fly releases -a canopy-sight-api` then `fly deploy -a canopy-sight-api --image <previous-image>`
2. **Database rollback**: Only if migration was destructive — restore from backup
3. **Notify team**: Post in #engineering channel with rollback details

---

*Last updated: 2026-03-24*
