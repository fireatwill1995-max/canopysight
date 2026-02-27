# Build API for Fly.io (monorepo: build from repo root with docker build -f apps/api/Dockerfile .)
FROM node:20-alpine AS base
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

# ---- Runner (Alpine 3.18 has openssl1.1-compat; 3.19+ removed it) ----
FROM node:20-alpine3.18 AS runner
RUN apk add --no-cache openssl1.1-compat

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/apps/api /app/apps/api
COPY --from=builder /app/packages /app/packages

WORKDIR /app/apps/api
EXPOSE 8080

CMD ["node", "dist/server.js"]
