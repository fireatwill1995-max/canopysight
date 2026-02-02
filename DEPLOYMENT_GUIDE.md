# Deployment Guide - Canopy Sight

Complete guide for deploying Canopy Sight to production with all performance improvements.

## Pre-Deployment Checklist

### 1. Environment Variables

Create `.env.production` with all required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/canopy_sight?connection_limit=20&pool_timeout=10

# Redis (Optional but recommended)
REDIS_URL=redis://:password@host:6379
# Or
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# API Configuration
PORT=3001
NODE_ENV=production
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Monitoring
SENTRY_DSN=your-sentry-dsn

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 2. Database Setup

#### Run Migrations

```bash
cd packages/database
npm run db:push
npm run db:generate
```

#### Verify Indexes

Check that composite indexes were created:

```sql
-- Check DetectionEvent indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'DetectionEvent';

-- Should see indexes like:
-- DetectionEvent_organizationId_siteId_timestamp_idx
-- DetectionEvent_organizationId_deviceId_timestamp_idx
```

#### Enable pgvector (if using vector search)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Build Applications

```bash
# Install dependencies
npm install --legacy-peer-deps

# Build all packages
npm run build

# Verify builds
ls apps/api/dist
ls apps/web/.next
```

## Deployment Options

### Option 1: Docker (Recommended)

#### Build Images

```bash
# Build API image
docker build -f infrastructure/docker/Dockerfile.api -t canopy-sight-api:latest .

# Build Web image
docker build -f infrastructure/docker/Dockerfile.web -t canopy-sight-web:latest .
```

#### Docker Compose

Update `infrastructure/docker/docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: canopy_sight
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  api:
    build:
      context: ../..
      dockerfile: infrastructure/docker/Dockerfile.api
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/canopy_sight
      REDIS_URL: redis://redis:6379
      PORT: 3001
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: ../..
      dockerfile: infrastructure/docker/Dockerfile.web
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres-data:
  redis-data:
```

#### Deploy

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Option 2: Platform-as-a-Service

#### Vercel (Web App)

1. **Connect repository** to Vercel
2. **Configure build settings:**
   - Framework: Next.js
   - Root directory: `apps/web`
   - Build command: `npm run build`
   - Output directory: `.next`

3. **Environment variables:**
   ```
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```

#### Render/Railway (API)

1. **Create new service** from repository
2. **Configure:**
   - Root directory: `apps/api`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Port: 3001

3. **Add environment variables** (see checklist above)

4. **Add PostgreSQL database** service

5. **Add Redis** service (optional but recommended)

### Option 3: Kubernetes

#### Create ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: canopy-sight-config
data:
  DATABASE_URL: "postgresql://..."
  REDIS_URL: "redis://..."
  NODE_ENV: "production"
```

#### Deploy API

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canopy-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: canopy-api
  template:
    metadata:
      labels:
        app: canopy-api
    spec:
      containers:
      - name: api
        image: canopy-sight-api:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: canopy-sight-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: canopy-api
spec:
  selector:
    app: canopy-api
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# API health
curl https://api.yourdomain.com/health

# Should return:
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.45,
  "memory": { ... },
  "database": "connected"
}
```

### 2. API Documentation

Visit: `https://api.yourdomain.com/api/docs`

Should show Swagger UI with all endpoints.

### 3. Test Endpoints

```bash
# Test ping
curl https://api.yourdomain.com/trpc/system.ping

# Test with authentication
curl -H "x-demo-mode: true" \
     -H "x-demo-user-id: test" \
     -H "x-demo-organization-id: test" \
     https://api.yourdomain.com/trpc/site.list
```

### 4. Verify Caching

```bash
# Check Redis connection (if configured)
redis-cli -h your-redis-host ping
# Should return: PONG

# Check cache keys
redis-cli -h your-redis-host KEYS "*"
```

### 5. Monitor Logs

```bash
# Docker
docker-compose logs -f api

# Kubernetes
kubectl logs -f deployment/canopy-api

# Should see:
# - "API server started"
# - "Redis connected" (if Redis configured)
# - "Event aggregator started"
```

## Performance Monitoring

### 1. Application Metrics

Monitor these endpoints:

- **Health**: `/health` - System status
- **Metrics**: Add custom metrics endpoint (future enhancement)

### 2. Database Performance

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 3. Redis Performance

```bash
# Check memory usage
redis-cli INFO memory

# Check hit rate (if using Redis monitoring)
redis-cli INFO stats | grep keyspace_hits
```

### 4. Application Logs

Monitor for:
- Slow query warnings (>1s)
- Cache hit/miss rates
- Error rates
- Connection issues

## Scaling Considerations

### Horizontal Scaling

1. **API Servers**: Deploy multiple instances behind load balancer
2. **Database**: Use read replicas for read-heavy workloads
3. **Redis**: Use Redis Cluster for high availability

### Vertical Scaling

1. **Database**: Increase connection pool size
2. **Redis**: Increase memory allocation
3. **Application**: Increase Node.js memory limit

### Load Balancer Configuration

```nginx
# Nginx example
upstream api_backend {
    least_conn;
    server api1:3001;
    server api2:3001;
    server api3:3001;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Hardening

### 1. Enable HTTPS

```bash
# Use Let's Encrypt
certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### 2. Rate Limiting

Already implemented in middleware. Configure limits:

```typescript
// In apps/api/src/middleware/rate-limiter.ts
// Adjust maxRequests and windowMs as needed
```

### 3. CORS Configuration

Update `ALLOWED_ORIGINS` in production:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 4. Database Security

- Use strong passwords
- Enable SSL connections
- Restrict network access
- Regular backups

## Backup Strategy

### Database Backups

```bash
# Daily backup script
pg_dump -h localhost -U postgres canopy_sight > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U postgres canopy_sight < backup_20240128.sql
```

### Redis Backups

```bash
# Enable AOF (Append Only File) - already in docker-compose
# Manual backup
redis-cli BGSAVE
```

## Rollback Procedure

1. **Revert code** to previous version
2. **Rebuild** applications
3. **Redeploy** with previous configuration
4. **Verify** health checks pass
5. **Monitor** for issues

## Troubleshooting

### API Not Starting

1. Check environment variables
2. Verify database connection
3. Check port availability
4. Review application logs

### Slow Performance

1. Check database query performance
2. Verify Redis is working (if configured)
3. Check application memory usage
4. Review slow query logs

### Cache Not Working

1. Verify Redis connection
2. Check cache middleware is applied
3. Review cache key generation
4. Monitor cache hit rates

## Support

For deployment issues:
1. Check application logs
2. Verify all environment variables
3. Test health endpoints
4. Review monitoring dashboards
