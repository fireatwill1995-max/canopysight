# Ngrok Setup - Complete Guide

## ⚠️ Authtoken Issue

The value `cr_34Q0BSx0bpNaFBMa1HycbP7RRg5` is **not a valid ngrok authtoken**. 

This appears to be:
- A Cloudflare token (starts with `cr_`)
- An API key for a different service
- An incomplete/incorrect authtoken

## ✅ Current Working Setup

I've configured the app to work with ngrok **without authentication** (free tier):

### Configuration Applied:
- ✅ Next.js API proxy (`/api-proxy/*` → `localhost:3001`)
- ✅ CORS updated to allow ngrok domains
- ✅ WebSocket configured for ngrok
- ✅ tRPC client auto-detects ngrok

### To Start Ngrok:

**Option 1: Manual Start**
```powershell
ngrok http 3000
```

**Option 2: Use the Script**
```powershell
.\start-ngrok.ps1
```

**Option 3: Background Process**
```powershell
Start-Process ngrok -ArgumentList "http","3000" -WindowStyle Minimized
```

### Get Your URL:

1. Open http://localhost:4040 in your browser (ngrok dashboard)
2. Copy the HTTPS URL shown (e.g., `https://xxxx-xx-xx-xx-xx.ngrok-free.dev`)
3. Use that URL to access your app from mobile/web

## 🔑 To Use a Valid Ngrok Authtoken:

1. **Get your authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
   - Sign up/login to ngrok
   - Copy the authtoken (long string, 50+ characters)

2. **Configure it**:
   ```powershell
   ngrok config add-authtoken YOUR_VALID_AUTHTOKEN
   ```

3. **Update ngrok-config.yml**:
   ```yaml
   version: "2"
   authtoken: YOUR_VALID_AUTHTOKEN
   tunnels:
     api:
       addr: 3001
       proto: http
     web:
       addr: 3000
       proto: http
   ```

4. **Start both tunnels**:
   ```powershell
   ngrok start --all --config=ngrok-config.yml
   ```

## 📱 Access Your App

Once ngrok is running:
- **Web URL**: Check http://localhost:4040 or the URL shown in ngrok
- **API**: Automatically proxied via `/api-proxy/trpc`
- **WebSocket**: Uses `wss://` through the same ngrok tunnel

## ✅ Everything is Configured

The app is ready - just start ngrok and you'll have a public URL!
