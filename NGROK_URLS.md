# Ngrok URLs for Canopy Sight

## 🌐 Access Your App

### Current Setup:
- **Web App**: Accessible via ngrok tunnel
- **API**: Proxied through Next.js at `/api-proxy/trpc`
- **WebSocket**: Uses `wss://` through ngrok

### To Get Your URL:

1. **Start ngrok** (if not running):
   ```powershell
   ngrok http 3000
   ```

2. **Check the ngrok dashboard**:
   - Open: http://localhost:4040
   - Copy the HTTPS URL shown (e.g., `https://xxxx-xx-xx-xx-xx.ngrok-free.dev`)

3. **Use that URL** to access your app from:
   - Mobile devices
   - Other computers
   - Any device with internet

### API Endpoints (via proxy):
- **tRPC**: `{ngrok-url}/api-proxy/trpc/*`
- **Health**: `{ngrok-url}/api-proxy/health`
- **WebSocket**: `wss://{ngrok-hostname}/socket.io`

## ✅ Configuration Complete

All code is configured to work with ngrok:
- ✅ CORS allows ngrok domains
- ✅ Next.js proxies API requests
- ✅ WebSocket configured for ngrok
- ✅ tRPC auto-detects ngrok

## 🔑 About the Authtoken

The value `cr_34Q0BSx0bpNaFBMa1HycbP7RRg5` is not a valid ngrok authtoken.

**To get a valid authtoken:**
1. Sign up/login: https://dashboard.ngrok.com/signup
2. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure: `ngrok config add-authtoken YOUR_AUTHTOKEN`

**Benefits of authenticated ngrok:**
- Stable URLs (don't change on restart)
- Custom domains
- More concurrent tunnels
- Better performance

## 📱 Ready to Use

Just start ngrok and you'll have a public URL! The app is fully configured.
