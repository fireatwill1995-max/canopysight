# Build Next.js web app for Fly.io (monorepo: build from repo root)
# Build context MUST be repo root: docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies: copy all workspace package.json so npm ci can link ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/edge-agent/package.json apps/edge-agent/
COPY packages/database/package.json packages/database/
COPY packages/auth/package.json packages/auth/
COPY packages/validators/package.json packages/validators/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/ai/package.json packages/ai/
COPY services/alert-engine/package.json services/alert-engine/

RUN npm ci

# ---- Build web ----
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=https://canopy-sight-api.fly.dev
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

WORKDIR /app/apps/web
RUN npm run build

# ---- Runner: minimal image with standalone server ----
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

# Copy full standalone output (includes minimal node_modules + server)
COPY --from=builder /app/apps/web/.next/standalone ./
# Next.js monorepo: server may be at standalone/server.js or standalone/apps/web/server.js
RUN if [ -f apps/web/server.js ]; then cp apps/web/server.js server.js; fi
# .next (BUILD_ID, static, etc.) - server looks for it in cwd
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]
