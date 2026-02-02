# Deploy Canopy Sight Web (frontend) to Vercel

Deploy the Next.js web app to Vercel and connect it to your Fly.io API.

## Prerequisites

- API deployed (e.g. Fly.io): `https://canopy-sight-api.fly.dev`
- Clerk application (dashboard.clerk.com)
- GitHub repo connected to Vercel

## 1. Connect repo to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub).
2. **Add New Project** → Import your Canopy Sight repo.
3. **Root Directory:** leave as repo root (or set to `apps/web` if you prefer; then set build command accordingly).
4. **Framework Preset:** Next.js (auto-detected).
5. **Build and Output:**
   - **Root Directory:** `apps/web` (so Vercel builds the web app).
   - Or keep root and set:
     - **Build Command:** `cd apps/web && npm run build` (after `npm install` at root).
   - **Output Directory:** `.next` (default).
6. **Install Command:** `npm install` (run from repo root so workspaces install).

If you set **Root Directory** to `apps/web`, Vercel will run `npm install` and `npm run build` inside `apps/web`. In a monorepo you may need to use the root and override build:

- **Root Directory:** (empty = repo root)
- **Build Command:** `npm run build --workspace=@canopy-sight/web` or `npx turbo run build --filter=@canopy-sight/web`
- **Install Command:** `npm ci` or `npm install`

## 2. Environment variables (Vercel)

In the Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Value | Notes |
|----------|--------|--------|
| `NEXT_PUBLIC_API_URL` | `https://canopy-sight-api.fly.dev` | Your deployed API URL |
| `NEXT_PUBLIC_WS_URL` | `wss://canopy-sight-api.fly.dev/socket.io` | WebSocket URL (optional if same as API) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_...` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | `sk_...` | From Clerk dashboard (server-side) |

For Clerk, set **Allowed redirect URLs** in the Clerk dashboard to include your Vercel URL (e.g. `https://your-app.vercel.app`).

## 3. API CORS (Fly.io)

Ensure the Fly.io API allows your Vercel origin:

```bash
fly secrets set FRONTEND_URL="https://your-app.vercel.app"
fly secrets set ALLOWED_ORIGINS="https://your-app.vercel.app"
```

Redeploy the API after changing secrets.

## 4. Deploy

- **Automatic:** Push to `main` (or your production branch); Vercel will build and deploy.
- **Manual:** Vercel dashboard → **Deployments** → **Redeploy**.

## 5. Optional: monorepo build settings

If the build fails (e.g. missing workspace packages), use:

- **Install Command:** `npm ci`
- **Build Command:** `npx turbo run build --filter=@canopy-sight/web`
- **Output Directory:** `apps/web/.next` (or leave default if Vercel detects it)

Or set **Root Directory** to `apps/web` and in `apps/web/package.json` ensure dependencies and build work when installed from that directory (you may need to hoist or use a different install strategy).

## Troubleshooting

- **Module not found @canopy-sight/…:** Build from repo root with turbo so workspace packages are available.
- **CORS errors:** Update `FRONTEND_URL` and `ALLOWED_ORIGINS` on Fly.io to match your Vercel URL.
- **Clerk redirect:** Add your Vercel URL to Clerk’s allowed redirect/origin list.
