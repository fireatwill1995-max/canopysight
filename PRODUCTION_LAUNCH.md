# Canopy Sight — Production Launch Guide

## Overview

Canopy Sight is deployed as two Fly.io apps:

| Service | App name              | Region | Internal port |
|---------|-----------------------|--------|---------------|
| API     | `canopy-sight-api`    | `syd`  | 8080          |
| Web     | `canopy-sight-web`    | `syd`  | 3000          |

---

## 1. Prerequisites

### External Services

| Service          | Purpose                  | Required |
|------------------|--------------------------|----------|
| PostgreSQL       | Primary database         | Yes      |
| Clerk            | Authentication           | Yes      |
| Fly.io           | Hosting (API + Web)      | Yes      |
| Cloudflare R2    | Media / video storage    | Yes      |
| Upstash Redis    | Caching, rate-limit state| Recommended |
| Sentry           | Error monitoring         | Recommended |
| BetterStack      | Uptime monitoring        | Recommended |
| Anthropic API    | AI analysis features     | Optional |
| OpenAI API       | Embeddings / vector search| Optional |

### Environment Variables

All secrets must be set on Fly.io before deployment.

```bash
# Set a secret on the API app
fly secrets set DATABASE_URL="postgresql://..." -a canopy-sight-api
fly secrets set CLERK_SECRET_KEY="sk_live_..." -a canopy-sight-api

# Set a secret on the Web app (if needed)
fly secrets set NEXT_PUBLIC_API_URL="https://canopy-sight-api.fly.dev" -a canopy-sight-web
```

See `.env.production.example` for the full list with descriptions.

### Tooling

- Node.js >= 18
- Fly CLI (`flyctl`) installed and authenticated
- GitHub repo secrets: `FLY_API_TOKEN`

---

## 2. Deployment Steps

### 2a. Database Migration

Run migrations before deploying new code that changes the schema:

```bash
# From local machine (requires DATABASE_URL in env or .env)
cd packages/database
npx prisma migrate deploy

# Or via Fly SSH
fly ssh console -a canopy-sight-api -C \
  "cd ../../packages/database && npx prisma migrate deploy"
```

### 2b. Deploy API

```bash
# Option 1: Automatic (push to main with changes in apps/api/**)
git push origin main

# Option 2: Manual
fly deploy --config fly.api.toml --remote-only
```

### 2c. Deploy Web

```bash
# Option 1: Automatic (push to main with changes in apps/web/**)
git push origin main

# Option 2: Manual
fly deploy . --config fly.web.toml \
  --dockerfile apps/web/Dockerfile \
  --remote-only \
  --build-arg NEXT_PUBLIC_API_URL=https://canopy-sight-api.fly.dev
```

### 2d. Verify (automated)

```bash
./scripts/health-check.sh \
  https://canopy-sight-api.fly.dev \
  https://canopy-sight-web.fly.dev
```

---

## 3. Post-Deploy Verification

Run through these checks after every production deploy:

1. **Health endpoints**
   - `curl https://canopy-sight-api.fly.dev/health` returns `{"status":"ok"}`
   - `curl https://canopy-sight-api.fly.dev/health/ready` returns `{"ready":true}`
   - `curl https://canopy-sight-web.fly.dev/health` returns `{"status":"healthy"}`

2. **Functional smoke test**
   - Open `https://canopy-sight-web.fly.dev` in a browser
   - Sign in and verify the dashboard loads
   - Confirm the live-feed WebSocket connection indicator is green
   - Check DevTools Network tab for successful tRPC calls

3. **Logs** — watch for errors in the first 15 minutes:
   ```bash
   fly logs -a canopy-sight-api
   fly logs -a canopy-sight-web
   ```

4. **Sentry** — check for new unresolved issues after deploy

---

## 4. Rollback Procedure

### Quick rollback (previous image)

```bash
# List recent releases
fly releases -a canopy-sight-api

# Redeploy a previous release image
fly deploy -a canopy-sight-api --image registry.fly.io/canopy-sight-api:deployment-<ID>
```

### Database rollback

Only needed if a migration was destructive. Restore from the most recent backup provided by your database host (Neon / Supabase snapshot).

### Rollback checklist

1. Identify the failing release in `fly releases`
2. Redeploy the last known-good image
3. Verify with `./scripts/health-check.sh`
4. If a DB migration must be reverted, restore from backup first
5. Document the incident in the engineering channel

---

## 5. Monitoring Setup

### Sentry (error tracking)

1. Create a Sentry project for `canopy-sight-api`
2. Set `SENTRY_DSN` as a Fly secret
3. Errors are captured automatically via `setupSentry()` in `server.ts`

### BetterStack (uptime monitoring)

1. Create a monitor pointing at `https://canopy-sight-api.fly.dev/health`
2. Set check interval to 60 seconds
3. Alert on 2 consecutive failures
4. Configure notification channels (email, Slack, PagerDuty)

### Fly.io Metrics

- CPU/memory: `fly dashboard -a canopy-sight-api`
- Autoscale config: `min_machines_running = 1` in `fly.api.toml`

### Log Aggregation

Fly.io logs can be shipped to external providers:

```bash
# Ship logs to a Datadog or Logtail endpoint
fly logs -a canopy-sight-api --json | your-log-shipper
```

---

## 6. Emergency Contacts / Escalation

| Level    | Action                                 | Contact         |
|----------|----------------------------------------|-----------------|
| L1       | Check health endpoint, review logs     | On-call engineer|
| L2       | Rollback deploy, restart machines      | Tech lead       |
| L3       | Database restore, infrastructure issue | CTO / DevOps    |

### Useful commands during incidents

```bash
# Restart all machines
fly machines restart -a canopy-sight-api

# Scale up during traffic spike
fly scale count 2 -a canopy-sight-api

# SSH into running machine
fly ssh console -a canopy-sight-api

# Check machine status
fly status -a canopy-sight-api
```

---

## 7. Infrastructure Topology

```
User Browser
    |
    v
[Fly.io Edge — canopy-sight-web]  (Next.js, port 3000)
    |
    v  (tRPC over HTTPS + WebSocket)
[Fly.io — canopy-sight-api]       (Express, port 8080)
    |          |           |
    v          v           v
 PostgreSQL  Upstash    Cloudflare R2
  (Neon)     Redis       (Media)
```

---

*Last updated: 2026-03-24*
