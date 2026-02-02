# Canopy Sight™ - Deployment Guide

## On-the-fly deploy (GitHub Actions)

Pushes to `main` automatically deploy API and Web to Fly.io when relevant paths change.

| Workflow | Trigger | Paths |
|----------|---------|--------|
| **Deploy API to Fly.io** | Push to `main` | `apps/api/**`, `packages/**`, `fly.api.toml`, `package.json` |
| **Deploy Web to Fly.io** | Push to `main` | `apps/web/**`, `packages/ui/**`, `fly.web.toml`, `package.json` |

**Required GitHub repo secrets**

- `FLY_API_TOKEN` — From [Fly.io dashboard](https://fly.io/dashboard) → Account → Access Tokens. Required for both API and Web deploys.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (optional) — Clerk publishable key for the web app. If unset, the web build uses a placeholder (Demo Login still works).

**Auto-deploy from Cursor (or any editor)**

1. Make your code changes in Cursor.
2. Commit and push to `main`:
   - `git add .` → `git commit -m "your message"` → `git push origin main`
3. GitHub Actions runs automatically when you push (if changed paths match the table above). The live app updates after the workflow completes (usually a few minutes).
4. No manual deploy step needed — push to `main` is enough.

**One-time setup**

1. Create Fly apps (if not already): `flyctl launch --config fly.api.toml --no-deploy` and `flyctl launch --config fly.web.toml --no-deploy` from repo root.
2. Set `FLY_API_TOKEN` in GitHub: Settings → Secrets and variables → Actions.
3. Optionally set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for real Clerk auth on the deployed web app.
4. Push to `main`; the workflows run and deploy. Manual run: Actions → "Deploy API to Fly.io" or "Deploy Web to Fly.io" → Run workflow.

**Config files**

- API: `fly.api.toml` (repo root)
- Web: `fly.web.toml` (repo root)

See `docs/DEPLOY_API_FLY.md` and `docs/DEPLOY_WEB_FLY.md` for manual deploy and troubleshooting.

---

## Production Deployment

### Prerequisites

- PostgreSQL 16+ with pgvector extension
- Redis for caching and queues
- Node.js 18+
- Docker (optional, for containerized deployment)

### Environment Variables

#### API Service

```bash
DATABASE_URL=postgresql://user:password@host:5432/canopy_sight
REDIS_URL=redis://host:6379
CLERK_SECRET_KEY=sk_live_...
PORT=3001
FRONTEND_URL=https://your-domain.com
SENTRY_DSN=https://...@sentry.io/...
NODE_ENV=production
```

#### Web Service

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

#### Edge Agent

```bash
DEVICE_ID=your-device-id
SITE_ID=your-site-id
API_URL=https://api.your-domain.com
API_KEY=your-api-key
MODEL_PATH=./models/yolov8n.onnx
CAMERA_INDEX=0
FRAME_RATE=30
DETECTION_THRESHOLD=0.5
RISK_THRESHOLD=50
```

### Database Setup

1. **Create Database**

```sql
CREATE DATABASE canopy_sight;
CREATE EXTENSION IF NOT EXISTS vector;
```

2. **Run Migrations**

```bash
cd packages/database
npm run db:migrate
```

3. **Seed Initial Data** (optional)

```bash
npm run db:seed
```

### Docker Deployment

1. **Build Images**

```bash
docker-compose -f infrastructure/docker/docker-compose.yml build
```

2. **Start Services**

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Manual Deployment

#### API Service

```bash
cd apps/api
npm install --production
npm run build
npm start
```

#### Web Service

```bash
cd apps/web
npm install --production
npm run build
npm start
```

### Edge Agent Deployment

1. **On Raspberry Pi**

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y nodejs npm python3 python3-pip v4l-utils

# Clone and setup
git clone <repository>
cd canopy-sight/apps/edge-agent
npm install --legacy-peer-deps

# Download YOLO model
mkdir -p models
wget https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx -O models/yolov8n.onnx

# Configure and run
cp .env.example .env
# Edit .env with your settings
npm start
```

2. **Docker Deployment**

```bash
docker build -f infrastructure/docker/Dockerfile.edge-agent -t canopy-sight-edge-agent .
docker run -d --device=/dev/video0 -e DEVICE_ID=... canopy-sight-edge-agent
```

### Monitoring

#### Sentry Setup

1. Create Sentry project
2. Add DSN to environment variables
3. Errors will be automatically tracked

#### Health Checks

- API: `GET /health`
- Database: Check connection via Prisma
- Redis: Check connection via client

### Scaling

#### Horizontal Scaling

- API: Use load balancer (nginx, AWS ALB)
- Database: Use read replicas
- Redis: Use Redis Cluster

#### Edge Agent Scaling

- Deploy one agent per camera/site
- Use device grouping for management
- Monitor via health dashboard

### Security Checklist

- [ ] HTTPS/TLS enabled
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] API keys stored securely
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Security headers (Helmet) configured
- [ ] Audit logging enabled
- [ ] Regular security updates

### Backup Strategy

1. **Database Backups**

```bash
pg_dump canopy_sight > backup_$(date +%Y%m%d).sql
```

2. **Video Storage**

- Use S3 versioning
- Configure lifecycle policies
- Regular archival to cold storage

3. **Configuration Backups**

- Version control for zone configurations
- Export device settings regularly

### Troubleshooting

#### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Edge Agent Not Connecting**
   - Verify API_URL and API_KEY
   - Check network connectivity
   - Review device logs

3. **High Memory Usage**
   - Optimize YOLO model (use quantized version)
   - Reduce frame rate
   - Increase device memory

### Performance Tuning

1. **Database**
   - Add indexes for frequent queries
   - Use connection pooling
   - Enable query caching

2. **API**
   - Enable Redis caching
   - Use CDN for static assets
   - Optimize tRPC queries

3. **Edge Agent**
   - Use quantized models (INT8)
   - Adjust frame rate based on activity
   - Optimize image preprocessing
