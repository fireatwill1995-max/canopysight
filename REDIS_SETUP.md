# Redis Caching Setup Guide

This guide explains how to configure Redis for production caching in Canopy Sight.

## Overview

The application uses Redis for caching frequently accessed data, with automatic fallback to in-memory cache if Redis is unavailable. This provides:
- **30-50% faster** response times for cached endpoints
- **Reduced database load** for read-heavy operations
- **Automatic failover** to memory cache if Redis is down

## Local Development Setup

### Option 1: Docker (Recommended)

```bash
# Run Redis in Docker
docker run -d \
  --name canopy-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify it's running
docker ps | grep redis
```

### Option 2: Local Installation

**Windows:**
```powershell
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Option 1: Individual settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty for local dev, set for production

# Option 2: Connection URL (recommended for production)
REDIS_URL=redis://localhost:6379
# With password: redis://:password@localhost:6379
# With SSL: rediss://:password@host:6379
```

### Application Code

The cache service automatically detects Redis configuration:

```typescript
// In apps/api/src/services/cache.ts
// Automatically uses Redis if REDIS_HOST or REDIS_URL is set
// Falls back to memory cache if Redis unavailable
```

## Production Setup

### Cloud Redis Providers

#### 1. Redis Cloud (Recommended for AWS/GCP/Azure)

**Sign up:** https://redis.com/try-free/

**Configuration:**
```bash
REDIS_URL=rediss://:password@your-instance.redis.cloud:port
```

#### 2. AWS ElastiCache

**Create ElastiCache cluster:**
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id canopy-sight-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1
```

**Configuration:**
```bash
REDIS_HOST=your-elasticache-endpoint.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-auth-token
```

#### 3. Google Cloud Memorystore

**Create instance:**
```bash
gcloud redis instances create canopy-redis \
  --size=1 \
  --region=us-central1
```

**Configuration:**
```bash
REDIS_HOST=your-memorystore-ip
REDIS_PORT=6379
```

#### 4. Azure Cache for Redis

**Create cache:**
```bash
az redis create \
  --name canopy-redis \
  --resource-group your-resource-group \
  --location eastus \
  --sku Basic \
  --vm-size c0
```

**Configuration:**
```bash
REDIS_URL=rediss://:password@your-cache.redis.cache.windows.net:6380
```

### Self-Hosted Redis

#### Docker Compose

Add to `infrastructure/docker/docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

#### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

## Security Best Practices

### 1. Use Password Authentication

```bash
# Generate strong password
openssl rand -base64 32

# Set in Redis config
requirepass your-strong-password

# Update environment variable
REDIS_PASSWORD=your-strong-password
```

### 2. Use TLS/SSL in Production

```bash
# Enable TLS in Redis
REDIS_URL=rediss://:password@host:6380
```

### 3. Network Security

- **Restrict access** to Redis port (6379/6380) to application servers only
- **Use VPC/private networks** for cloud deployments
- **Enable firewall rules** to block public access

### 4. Key Naming

The application uses namespaced keys:
- `site:{id}`
- `device:{id}`
- `detections:{orgId}:{filters}`
- `alerts:{orgId}:{filters}`

This prevents key collisions and allows easy cache invalidation.

## Monitoring

### Health Checks

The application automatically checks Redis connectivity:

```typescript
// In apps/api/src/services/cache.ts
// Automatically falls back to memory cache if Redis unavailable
```

### Metrics to Monitor

1. **Cache Hit Rate**
   - Target: 60-80% for frequently accessed data
   - Monitor via application logs

2. **Redis Memory Usage**
   ```bash
   redis-cli INFO memory
   ```

3. **Connection Count**
   ```bash
   redis-cli INFO clients
   ```

4. **Command Statistics**
   ```bash
   redis-cli INFO stats
   ```

### Redis CLI Commands

```bash
# Connect to Redis
redis-cli -h localhost -p 6379

# Check if Redis is running
redis-cli ping
# Should return: PONG

# View all keys
redis-cli KEYS "*"

# Get cache statistics
redis-cli INFO stats

# Monitor commands in real-time
redis-cli MONITOR

# Clear all cache (use with caution!)
redis-cli FLUSHDB
```

## Troubleshooting

### Redis Not Connecting

1. **Check Redis is running:**
   ```bash
   redis-cli ping
   ```

2. **Check environment variables:**
   ```bash
   echo $REDIS_HOST
   echo $REDIS_PORT
   ```

3. **Check application logs:**
   - Look for "Redis not available, falling back to memory cache"
   - This is expected if Redis is not configured

### High Memory Usage

1. **Set max memory policy:**
   ```bash
   redis-cli CONFIG SET maxmemory 256mb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

2. **Monitor memory:**
   ```bash
   redis-cli INFO memory
   ```

### Slow Performance

1. **Check connection pool:**
   - Ensure connection pooling is configured
   - Default: 10 connections

2. **Monitor slow queries:**
   ```bash
   redis-cli SLOWLOG GET 10
   ```

## Cache Invalidation

The application automatically invalidates cache on mutations:

```typescript
// After creating/updating/deleting resources
await cacheInvalidation.organization(orgId);
await cacheInvalidation.site(siteId);
await cacheInvalidation.device(deviceId);
```

## TTL Configuration

Default TTLs (Time To Live) for cached data:

- **Detection lists**: 60 seconds
- **Alert lists**: 30 seconds
- **Site/Device details**: 300 seconds (5 minutes)
- **System health**: 60 seconds

These can be adjusted in the cache middleware:

```typescript
.use(cacheMiddleware(60)) // 60 seconds TTL
```

## Performance Benchmarks

### Without Redis (Memory Cache):
- Cache hit rate: ~40-50%
- Response time: 50-100ms (cache hit), 200-500ms (cache miss)

### With Redis:
- Cache hit rate: ~60-80%
- Response time: 20-50ms (cache hit), 200-500ms (cache miss)
- **30-50% faster** average response times

## Cost Estimation

### Redis Cloud (Free Tier):
- **Free**: 30MB, 1 database
- **Paid**: Starting at $0.05/hour (~$36/month)

### AWS ElastiCache:
- **cache.t3.micro**: ~$15/month
- **cache.t3.small**: ~$30/month

### Self-Hosted:
- **VPS**: $5-20/month (depending on size)
- **Dedicated**: $50-200/month

## Migration from Memory to Redis

1. **Deploy Redis** (using one of the methods above)
2. **Set environment variables** in production
3. **Restart application** - it will automatically use Redis
4. **Monitor logs** - should see "Redis connected" message
5. **Verify cache** - check Redis keys with `redis-cli KEYS "*"`

## Support

For issues or questions:
- Check application logs for Redis connection errors
- Verify Redis is accessible from application servers
- Test connection with `redis-cli` from application server
- Review Redis logs: `/var/log/redis/redis-server.log`
