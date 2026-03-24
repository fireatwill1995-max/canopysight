# Build API for Fly.io (monorepo: build from repo root with docker build -f apps/api/Dockerfile .)
FROM node:22-alpine AS base
WORKDIR /app

# ---- Dependencies (all workspace package.json so npm ci works) ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/edge-agent/package.json apps/edge-agent/
COPY packages/database/package.json packages/database/
COPY packages/auth/package.json packages/auth/
COPY packages/validators/package.json packages/validators/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/ai/package.json packages/ai/
COPY services/alert-engine/package.json services/alert-engine/
COPY services/video-processor/package.json services/video-processor/

RUN npm ci

# ---- Prisma generate ----
FROM base AS prisma
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json ./
COPY packages/database/package.json packages/database/
COPY packages/database/prisma packages/database/prisma

WORKDIR /app/packages/database
RUN npx prisma generate
WORKDIR /app

# ---- Build API ----
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
# Prisma generate writes to root node_modules in workspace; overlay from prisma stage
COPY --from=prisma /app/node_modules /app/node_modules

WORKDIR /app/apps/api
RUN npm run build

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/edge-agent/package.json apps/edge-agent/
COPY packages/database/package.json packages/database/
COPY packages/auth/package.json packages/auth/
COPY packages/validators/package.json packages/validators/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/ai/package.json packages/ai/
COPY services/alert-engine/package.json services/alert-engine/
COPY services/video-processor/package.json services/video-processor/

RUN npm ci --omit=dev

# ---- Runner ----
FROM node:22-alpine AS runner

RUN addgroup -g 1001 -S canopy && \
    adduser -S canopy -u 1001 -G canopy

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prisma /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/apps/api /app/apps/api
COPY --from=builder /app/packages /app/packages

WORKDIR /app/apps/api

USER canopy

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["npx", "tsx", "dist/server.js"]
