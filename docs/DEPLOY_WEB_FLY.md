# Deploy Canopy Sight Web (frontend) to Fly.io

Deploy the Next.js web app to Fly.io from the same repo as the API.

**On-the-fly deploy:** Pushing to `main` (when `apps/web/**` or related paths change) runs the GitHub Action **Deploy Web to Fly.io** and deploys automatically. See repo root `DEPLOYMENT.md` → "On-the-fly deploy".

## Prerequisites

- API already deployed: `https://canopy-sight-api.fly.dev`
- Fly CLI: `fly auth login`

## One-time: create the web app

From **repo root**:

```powershell
fly launch --config fly.web.toml --dockerfile apps/web/Dockerfile --no-deploy --copy-config --yes
```

If the app name `canopy-sight-web` is taken, choose another and update `app` in `fly.web.toml`.

## Set secrets (runtime)

```powershell
fly secrets set CLERK_SECRET_KEY="sk_test_..." -a canopy-sight-web
```

## Deploy (build-time env for client bundle)

`NEXT_PUBLIC_*` vars are baked at build time. Pass them as build args:

```powershell
fly deploy --config fly.web.toml -a canopy-sight-web --build-arg NEXT_PUBLIC_API_URL=https://canopy-sight-api.fly.dev --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Or set in `fly.web.toml` under `[build.args]` and run:

```powershell
fly deploy --config fly.web.toml -a canopy-sight-web
```

## CORS on the API

So the browser can call the API from your web URL, set on the **API** app:

```powershell
fly secrets set FRONTEND_URL="https://canopy-sight-web.fly.dev" ALLOWED_ORIGINS="https://canopy-sight-web.fly.dev" -a canopy-sight-api
```

## URLs after deploy

- **Web:** https://canopy-sight-web.fly.dev
- **API:** https://canopy-sight-api.fly.dev

## Working directory and config

- **Always run from repo root** (so Docker build context is the monorepo).
- **Config:** `fly.web.toml` (at repo root).

## If you see 502 or "not loading"

1. **Ensure web app secrets:** `fly secrets list -a canopy-sight-web` should include `CLERK_SECRET_KEY` (required for Clerk server-side).
2. **Rebuild with correct API URL:** Build args in `fly.web.toml` already set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Redeploy: `fly deploy --config fly.web.toml -a canopy-sight-web`.
3. **Keep one instance warm:** `fly.web.toml` has `min_machines_running = 1` to avoid cold-start 502s.

## If API returns 500 for site.list / device.list

- **Health shows "database: connected" but tRPC returns 500:** The schema may not be applied on Fly Postgres. Apply it from your machine: get `DATABASE_URL` from the Fly Postgres app (or API secrets), then from repo root run `cd packages/database` and `npx prisma db push` with that `DATABASE_URL`. See `docs/DEPLOY_API_FLY.md` (Database migrations and schema).
- Keeping one API machine warm reduces DB timeouts: `fly.api.toml` has `min_machines_running = 1`.
- Redeploy API after code changes: `fly deploy --config fly.api.toml -a canopy-sight-api`.

## Clerk "development keys" warning

The console message *"Clerk has been loaded with development keys"* appears when using **test** keys (`pk_test_...` / `sk_test_...`). To remove it and use production auth:

1. In the [Clerk Dashboard](https://dashboard.clerk.com), create or switch to a **Production** instance.
2. Copy the **Publishable key** (`pk_live_...`) and **Secret key** (`sk_live_...`).
3. Update `fly.web.toml` `[build.args]`: set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to your `pk_live_...` value.
4. Set the secret: `fly secrets set CLERK_SECRET_KEY="sk_live_..." -a canopy-sight-web`
5. Redeploy: `fly deploy --config fly.web.toml -a canopy-sight-web`

After switching to production keys, the development-keys warning will stop appearing.
