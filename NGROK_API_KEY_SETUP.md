# Ngrok API Key Integration

## ⚠️ Authtoken Issue

The provided authtoken `38sRXlCg6YQLYKTLg8wrujH3R89_5s9BJg3adf1tfxpdXTFPQ` was rejected by ngrok as invalid.

## 🔧 How to Fix

1. **Verify your authtoken** at: https://dashboard.ngrok.com/get-started/your-authtoken
2. **Get a valid authtoken** from your ngrok dashboard
3. **Configure it** using:
   ```powershell
   ngrok config add-authtoken YOUR_VALID_AUTHTOKEN
   ```

## 📝 Current Setup

Currently using ngrok **without authentication** (free tier):
- ✅ Web tunnel is active
- ✅ API is proxied through Next.js
- ⚠️ URLs change on restart (free tier limitation)

## 🚀 Once You Have a Valid Authtoken

1. Add it:
   ```powershell
   ngrok config add-authtoken YOUR_AUTHTOKEN
   ```

2. Update `ngrok-config.yml`:
   ```yaml
   version: "2"
   authtoken: YOUR_AUTHTOKEN
   tunnels:
     api:
       addr: 3001
       proto: http
     web:
       addr: 3000
       proto: http
   ```

3. Start both tunnels:
   ```powershell
   ngrok start --all --config=ngrok-config.yml
   ```

## 📋 Note About API Keys

The value you provided might be:
- An **ngrok API key** (for programmatic access via ngrok API)
- An **invalid/expired authtoken**
- A **team account token** that was revoked

**Authtokens** are used for tunnel authentication and are different from API keys.

## ✅ Current Working Setup

The app is currently accessible via the free tier ngrok URL. Check `ngrok-web-url.txt` for the current URL.
