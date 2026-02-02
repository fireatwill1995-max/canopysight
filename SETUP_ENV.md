# Environment Variables Setup Guide

## ✅ Environment Variables Configured

All environment variables have been set up with your provided credentials.

## Files Created

1. **Root `.env`** - Shared environment variables
2. **`apps/web/.env.local`** - Next.js web app variables
3. **`apps/api/.env`** - API server variables
4. **`apps/edge-agent/.env`** - Edge agent variables
5. **`packages/database/.env`** - Database connection

## Configured Services

### ✅ Clerk Authentication
- Publishable Key: configure locally in `apps/web/.env.local`
- Secret Key: configure locally in `apps/api/.env` / server env

### ✅ Database
- Connection String: `postgresql://user:password@localhost:5432/meeting_intelligence`
- **Note**: Update `user` and `password` with your actual PostgreSQL credentials

### ✅ AI Services
- Anthropic (Claude) API Key: Configured
- OpenAI API Key: Placeholder (add if needed)

### ✅ Google Maps
- API Key: configure locally in `apps/web/.env.local`

## Next Steps

### 1. Update Database Credentials

Edit `apps/api/.env` and `packages/database/.env`:
```bash
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/meeting_intelligence
```

### 2. Set Up PostgreSQL with pgvector

```bash
# Install PostgreSQL (if not already installed)
# Then install pgvector extension:

psql -U postgres
CREATE DATABASE meeting_intelligence;
\c meeting_intelligence
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Run Database Migrations

```bash
cd packages/database
npm run db:push
# Or for migrations:
npm run db:migrate
```

### 4. Generate Prisma Client

```bash
cd packages/database
npm run db:generate
```

### 5. Configure Edge Agent (when deploying)

Edit `apps/edge-agent/.env`:
- Set `DEVICE_ID` - Unique identifier for your device
- Set `SITE_ID` - Site this device monitors
- Set `API_KEY` - API key for device authentication
- Download YOLO model to `./models/yolov8n.onnx`

### 6. Start Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start all services
npm run dev

# Or start individually:
cd apps/api && npm run dev    # API on port 3001
cd apps/web && npm run dev    # Web on port 3000
```

## Security Notes

⚠️ **Important**: 
- These `.env` files contain sensitive keys
- Never commit them to version control (they're in `.gitignore`)
- For production, use secure secret management (AWS Secrets Manager, Vault, etc.)
- Rotate keys regularly

## Testing the Setup

1. **Test Database Connection**:
   ```bash
   cd packages/database
   npm run db:studio  # Opens Prisma Studio
   ```

2. **Test API**:
   ```bash
   curl http://localhost:3001/health
   ```

3. **Test Web App**:
   - Open http://localhost:3000
   - Should redirect to Clerk sign-in

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env` files
- Ensure database exists: `psql -l | grep meeting_intelligence`

### Clerk Authentication Issues
- Verify keys are correct in `.env` files
- Check Clerk dashboard for allowed redirect URLs
- Ensure `http://localhost:3000` is in allowed origins

### API Connection Issues
- Verify API is running on port 3001
- Check `NEXT_PUBLIC_API_URL` in web app `.env`
- Verify CORS settings in API
