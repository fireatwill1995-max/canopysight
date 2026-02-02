# Ngrok Authtoken Setup Guide

## ⚠️ Current Status

The provided value `cr_34Q0BSx0bpNaFBMa1HycbP7RRg5` is not a valid ngrok authtoken format.

## 🔑 How to Get a Valid Ngrok Authtoken

1. **Sign up/Login** to ngrok: https://dashboard.ngrok.com/signup
2. **Get your authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Copy the authtoken** (it will look like: `2abc123def456ghi789jkl012mno345pq_6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F`)

## 📝 Valid Authtoken Format

Ngrok authtokens typically:
- Are long alphanumeric strings (50+ characters)
- May contain underscores and hyphens
- Start with numbers/letters (not `cr_` prefix)

## ✅ Once You Have a Valid Authtoken

Run this command:
```powershell
ngrok config add-authtoken YOUR_VALID_AUTHTOKEN
```

Then update `ngrok-config.yml`:
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

Start both tunnels:
```powershell
ngrok start --all --config=ngrok-config.yml
```

## 🌐 Current Setup (Free Tier)

The app is currently running on ngrok free tier without authentication:
- ✅ Web tunnel is active
- ✅ API is proxied through Next.js
- ⚠️ URLs change on restart

## 📱 Access Your App

Check `ngrok-web-url.txt` for the current web URL, or visit:
http://localhost:4040 (ngrok web interface)
