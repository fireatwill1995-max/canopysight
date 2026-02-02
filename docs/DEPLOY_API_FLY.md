# Deploy Canopy Sight API (backend) to Fly.io via GitHub

This guide gets the API ready to deploy to Fly.io and to deploy automatically from GitHub on push to `main`.

## What’s in place

- **`apps/api/Dockerfile`** — Multi-stage build for the API (monorepo-aware; build from repo root).
- **`apps/api/fly.toml`** — Fly.io app config (app name, port, VM size).
- **`.github/workflows/deploy-api-fly.yml`** — Deploys API to Fly.io on push to `main` when API or shared packages change.
- **`.dockerignore`** — Keeps Docker build context small.

## One-time setup

### 1. Install Fly CLI (local)

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Or: https://fly.io/docs/hands-on/install-flyctl/
```

### 2. Log in and create the app (once)

From the **repo root**:

```bash
fly auth login
fly launch --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --no-deploy
```

When prompted:

- **App name:** keep `canopy-sight-api` or choose another (then update `app` in `apps/api/fly.toml`).
- **Region:** pick one (e.g. `lhr`).
- **Postgres:** create a new Postgres cluster if you want Fly to host the DB, or choose “No” and set `DATABASE_URL` yourself later.

If you created Postgres with Fly, attach it and set the secret:

```bash
fly postgres attach <postgres-app-name>
# Or set DATABASE_URL manually:
fly secrets set DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

### 3. Set required secrets on Fly

From repo root:

```bash
# Required: database
fly secrets set DATABASE_URL="postgresql://..."   # if not set by attach

# Required for auth (Clerk)
fly secrets set CLERK_SECRET_KEY="sk_..."

# Optional: frontend URL for CORS (your web app URL)
fly secrets set FRONTEND_URL="https://your-web-app.vercel.app"
fly secrets set ALLOWED_ORIGINS="https://your-web-app.vercel.app"

# Optional: Sentry
fly secrets set SENTRY_DSN="https://...@sentry.io/..."
```

List secrets (values are hidden):

```bash
fly secrets list
```

### 4. Add GitHub secret for deploys

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**: name `FLY_API_TOKEN`, value = your Fly API token.
3. Get a token: [Fly.io dashboard](https://fly.io/user/tokens) → **Create token**, or run:

   ```bash
   fly tokens create deploy
   ```

## Deploy

### Deploy from GitHub (automatic)

- Push to `main` with changes under `apps/api/`, `packages/database/`, `packages/auth/`, `packages/validators/`, or `packages/config/`.
- The workflow **Deploy API to Fly.io** runs and runs `fly deploy` for the API app.

### Deploy from your machine (manual)

From the **repo root**:

```bash
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

## After first deploy

- **API URL:** `https://canopy-sight-api.fly.dev` (or your app name + `.fly.dev`).
- **Health:** `https://canopy-sight-api.fly.dev/health`
- **tRPC:** `https://canopy-sight-api.fly.dev/trpc`

## Environment variables (checklist)

| Variable           | Required | Notes |
|--------------------|----------|--------|
| `DATABASE_URL`     | Yes      | PostgreSQL URL; use `?sslmode=require` for Fly Postgres. |
| `CLERK_SECRET_KEY` | Yes      | From Clerk dashboard (backend). |
| `FRONTEND_URL`     | No       | Web app URL for CORS (e.g. Vercel). |
| `ALLOWED_ORIGINS`  | No       | Comma-separated origins for CORS. |
| `SENTRY_DSN`       | No       | Sentry project DSN. |
| `REDIS_URL`        | No       | If you add Redis later. |

Set via Fly:

```bash
fly secrets set NAME="value"
```

## Database migrations

Run migrations against the Fly Postgres DB (e.g. from your machine with `DATABASE_URL` pointing at Fly):

```bash
cd packages/database
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Or use Fly’s Postgres connection string from `fly secrets list` (or from the Fly Postgres app) and run the same command with that URL.

## Troubleshooting

- **Build fails (Docker):** Always run `fly deploy` from the **repo root** so the Docker build context is the whole repo.
- **App name in use:** Change `app = "canopy-sight-api"` in `apps/api/fly.toml` to a unique name, or run `fly launch` and pick a new name.
- **Health check / DB:** Ensure `DATABASE_URL` is set and migrations are applied (`prisma migrate deploy`). If site.list returns 500 but health shows database connected, apply schema: run `npx prisma db push` from `packages/database` with Fly `DATABASE_URL`.
- **CORS errors from web app:** Set `FRONTEND_URL` and/or `ALLOWED_ORIGINS` to your front-end URL.
