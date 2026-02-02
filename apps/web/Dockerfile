# Build Next.js web app for Fly.io (monorepo: build from repo root with docker build -f apps/web/Dockerfile .)
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY apps/edge-agent/package.json apps/edge-agent/
COPY packages/database/package.json packages/database/
COPY packages/auth/package.json packages/auth/
COPY packages/validators/package.json packages/validators/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/ai/package.json packages/ai/
COPY apps/api/package.json apps/api/

RUN npm ci

# ---- Build web ----
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY . .

# Build-time env for NEXT_PUBLIC_* (baked into client bundle)
ARG NEXT_PUBLIC_API_URL=https://canopy-sight-api.fly.dev
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

WORKDIR /app/apps/web
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app
# Copy full standalone tree
COPY --from=builder /app/apps/web/.next/standalone ./
# Force server.js at /app (Next monorepo puts it in standalone/apps/web/)
COPY --from=builder /app/apps/web/.next/standalone/apps/web/server.js /app/server.js
# Server looks for .next in CWD (/app); need full .next (BUILD_ID, etc.) not just static
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
# Fly sets PORT at runtime; Next respects process.env.PORT
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "/app/server.js"]
