# Ngrok Setup for Canopy Sight

## 🌐 Public URLs

**Web App URL:** `https://procambial-maybell-direful.ngrok-free.dev`

**API Endpoints:**
- tRPC: `https://procambial-maybell-direful.ngrok-free.dev/api-proxy/trpc`
- WebSocket: `wss://procambial-maybell-direful.ngrok-free.dev/socket.io`
- Health Check: `https://procambial-maybell-direful.ngrok-free.dev/api-proxy/health`

## ✅ Configuration Complete

### What Was Configured:

1. **Ngrok Tunnel**: Running on port 3000 (web app)
2. **Next.js API Proxy**: Configured to proxy `/api-proxy/*` requests to local API server (port 3001)
3. **CORS**: Updated to allow ngrok domains dynamically
4. **WebSocket**: Configured to work with ngrok (wss://)
5. **tRPC Client**: Automatically detects ngrok and uses relative paths

### Files Modified:

- `apps/web/next.config.js` - Added API proxy rewrites
- `apps/web/src/app/providers.tsx` - Auto-detects ngrok and uses proxy
- `apps/web/src/hooks/use-websocket.ts` - WebSocket URL for ngrok
- `apps/api/src/server.ts` - CORS allows ngrok origins
- `apps/api/src/middleware/security.ts` - CORS middleware updated
- `apps/api/src/services/websocket-server.ts` - WebSocket CORS updated

## 📱 How to Use

1. **On Mobile/Web**: Open `https://procambial-maybell-direful.ngrok-free.dev` in your browser
2. **API Calls**: Automatically proxied through Next.js to local API server
3. **WebSocket**: Automatically connects via wss:// through ngrok

## ⚠️ Important Notes

1. **URL Changes**: ngrok free tier URLs change when you restart ngrok. You'll need to update the URL if you restart.
2. **ngrok Warning Page**: Free tier shows a warning page on first visit. Click "Visit Site" to proceed.
3. **Rate Limits**: Free tier has rate limits. For production, consider ngrok paid plan or static domain.
4. **HTTPS**: All traffic is encrypted via ngrok's HTTPS.
5. **ChunkLoadError /_next/undefined**: When you open the app via the ngrok URL, Next.js must load JS chunks from the same origin. Add this to **`apps/web/.env.local`** (use your current ngrok URL) and **restart the dev server**:
   ```bash
   NGROK_URL=https://procambial-maybell-direful.ngrok-free.dev
   ```
   Update `NGROK_URL` whenever you restart ngrok and get a new URL.
6. **HMR WebSocket 503**: Next.js Hot Module Reload (HMR) uses a WebSocket to `/_next/webpack-hmr`. ngrok free tier often returns 503 for that upgrade. You can ignore the console error; the app still works. For live code reload while developing, use **http://localhost:3000** instead of the ngrok URL.

## 🔧 Restarting Ngrok

If you need to restart ngrok:

```powershell
# Stop existing tunnels
Stop-Process -Name ngrok -Force

# Start new tunnel for web app
Start-Process ngrok -ArgumentList "http","3000" -WindowStyle Minimized

# Get new URL
Start-Sleep -Seconds 5
$response = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing
$tunnels = $response.Content | ConvertFrom-Json | Select-Object -ExpandProperty tunnels
$webUrl = ($tunnels | Where-Object { $_.config.addr -eq 'http://localhost:3000' } | Select-Object -First 1).public_url
Write-Host "New URL: $webUrl"
```

## ✅ Testing

The API proxy is working and accessible. You can test:
- Web app: `https://procambial-maybell-direful.ngrok-free.dev`
- API health: `https://procambial-maybell-direful.ngrok-free.dev/api-proxy/health`

---

## 🔌 Servers and APIs – Make Sure Everything Works

### 1. Start the API (port 3001)

The api-proxy forwards requests to the API. The API must be running on the same machine as Next.js.

```powershell
# From repo root (starts API + web + other packages)
npm run dev

# Or API only (in a separate terminal)
cd apps\api
npm run dev
```

- **Health check:** Open [http://localhost:3001/health](http://localhost:3001/health) — you should see `{"status":"ok", ...}`.
- **Env:** `apps/api/.env` must have `DATABASE_URL`. The API loads it via `dotenv/config`.

### 2. Start the Web App (port 3000)

If you didn’t run `npm run dev` from the root, start the web app:

```powershell
cd apps\web
npm run dev
```

- **Local:** Open [http://localhost:3000](http://localhost:3000).

### 3. Start ngrok (tunnel to port 3000)

```powershell
ngrok http 3000
```

- Use the HTTPS URL ngrok shows (e.g. `https://xxxx.ngrok-free.dev`).
- **Via ngrok:** All tRPC and health requests go to your app as `/api-proxy/trpc` and `/api-proxy/health`; Next.js proxies them to `http://localhost:3001`.

### 4. Environment variables

| Where        | Variable               | Purpose |
|-------------|------------------------|--------|
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001` | Used by the api-proxy to call the API (server-side). |
| `apps/api/.env`       | `DATABASE_URL=postgresql://...`             | Required for Prisma. |
| Optional    | `FRONTEND_URL`         | If you use a custom front-end URL, set it so API CORS allows it. |
| Optional    | `ALLOWED_ORIGINS`     | Comma-separated list of extra CORS origins. |
| **When using ngrok** | `NGROK_URL` (in `apps/web/.env.local`) | Your current ngrok URL (e.g. `https://xxx.ngrok-free.dev`). Required so Next.js chunk URLs resolve correctly and you don’t get ChunkLoadError `/_next/undefined`. Update when you restart ngrok. |

### 5. Quick verification

1. **API up:** [http://localhost:3001/health](http://localhost:3001/health) → `status: "ok"`.
2. **Web (local):** [http://localhost:3000](http://localhost:3000) → app loads; devices/sites work.
3. **Web (ngrok):** `https://your-url.ngrok-free.dev` → same app; tRPC and health go through api-proxy to the API.

If you see “fetch failed” or 500 when using ngrok, the api-proxy cannot reach the API — ensure the API is running on port 3001 and `NEXT_PUBLIC_API_URL` is `http://localhost:3001` (or the correct URL for your setup).
