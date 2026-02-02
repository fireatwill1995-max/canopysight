# Canopy Sight™ - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Step 2: Set Up Database

**Option A: Using Setup Script (Recommended)**

**Windows (PowerShell):**
```powershell
.\scripts\setup-database.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

**Option B: Manual Setup**

1. Create PostgreSQL database:
```sql
CREATE DATABASE meeting_intelligence;
\c meeting_intelligence
CREATE EXTENSION IF NOT EXISTS vector;
```

2. Update database credentials in:
   - `apps/api/.env`
   - `packages/database/.env`

   Replace `user:password` with your actual PostgreSQL credentials:
   ```
   DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/meeting_intelligence
   ```

### Step 3: Run Database Migrations

```bash
cd packages/database
npm run db:push
npm run db:generate
```

### Step 4: Create Environment Files

The environment variables are already configured! Just copy the example files:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps\api\.env
Copy-Item .env.example apps\web\.env.local
```

**Linux/Mac:**
```bash
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

**Update Database Credentials:**
Edit `apps/api/.env` and replace `user:password` with your actual PostgreSQL credentials.

### Step 5: Start Development Servers

```bash
# Start all services
npm run dev

# Or start individually:
# Terminal 1: API Server
cd apps/api
npm run dev  # Runs on http://localhost:3001

# Terminal 2: Web App
cd apps/web
npm run dev  # Runs on http://localhost:3000
```

### Step 6: Access the Application

1. **Web Dashboard**: http://localhost:3000
   - Will redirect to Clerk sign-in
   - Sign up or sign in with your email

2. **API Health Check**: http://localhost:3001/health
   - Should return: `{"status":"ok","timestamp":"..."}`

## ✅ Environment Variables Already Configured

All your credentials have been set up:

- ✅ **Clerk Authentication**: Configured with your keys
- ✅ **Database**: Set to `meeting_intelligence` (update credentials)
- ✅ **Claude API**: Configured with your API key
- ✅ **Google Maps**: Configured with your API key

## 📋 Next Steps

### For Edge Agent (Raspberry Pi)

1. **Download YOLO Model**:

**Windows (PowerShell):**
```powershell
.\scripts\download-yolo-model.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/download-yolo-model.sh
./scripts/download-yolo-model.sh
```

2. **Configure Edge Agent**:
   - Edit `apps/edge-agent/.env`
   - Set `DEVICE_ID` and `SITE_ID`
   - Set `API_KEY` (generate from API)

3. **Run Edge Agent**:
```bash
cd apps/edge-agent
npm run dev
```

## 🔧 Troubleshooting

### Database Connection Failed

1. Verify PostgreSQL is running:
   ```bash
   # Windows
   Get-Service postgresql*
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. Test connection:
   ```bash
   psql -U postgres -d meeting_intelligence
   ```

3. Check credentials in `.env` files

### Clerk Authentication Issues

1. Verify keys in `.env` files match your Clerk dashboard
2. Add `http://localhost:3000` to allowed redirect URLs in Clerk
3. Check browser console for errors

### API Not Starting

1. Check if port 3001 is available:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # Linux/Mac
   lsof -i :3001
   ```

2. Verify environment variables in `apps/api/.env`
3. Check database connection

## 📚 Additional Resources

- **Full Setup Guide**: See `SETUP.md`
- **Environment Variables**: See `SETUP_ENV.md`
- **Deployment Guide**: See `DEPLOYMENT.md`
- **Testing Guide**: See `TESTING.md`

## 🎯 What's Next?

1. ✅ Database is set up
2. ✅ Environment variables configured
3. ✅ Development servers running
4. ⏭️ Create your first site in the dashboard
5. ⏭️ Configure zones for monitoring
6. ⏭️ Set up edge devices

Happy coding! 🚀
