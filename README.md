# Canopy Sight™

AI-powered rail safety monitoring system with real-time detection, alerting, and analytics.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ with pgvector extension
- npm 9+

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Set Up Environment Variables

**Windows (PowerShell):**
```powershell
.\scripts\setup-env.ps1
```

This will:
- Configure all `.env` files with your credentials
- Set up Clerk authentication
- Configure database connection
- Set up API keys

### 3. Set Up Database

**Windows (PowerShell):**
```powershell
.\scripts\setup-database.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

Then run migrations:
```bash
cd packages/database
npm run db:push
npm run db:generate
```

### 4. Start Development

```bash
npm run dev
```

- **Web Dashboard**: http://localhost:3000
- **API Server**: http://localhost:3001

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in 5 minutes
- **[Setup Guide](SETUP.md)** - Detailed development setup
- **[Environment Variables](SETUP_ENV.md)** - Environment configuration
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment
- **[Deploy API to Fly.io](docs/DEPLOY_API_FLY.md)** - Backend deploy via GitHub
- **[Deploy Web to Vercel](docs/DEPLOY_WEB_VERCEL.md)** - Frontend deploy
- **[Testing Guide](TESTING.md)** - Testing procedures
- **[Build Summary](BUILD_SUMMARY.md)** - Complete feature list

**Env templates:** Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`, then fill in values.

## 🏗️ Project Structure

```
canopy-sight/
├── apps/
│   ├── web/              # Next.js dashboard
│   ├── api/              # Express + tRPC API
│   └── edge-agent/       # Raspberry Pi edge software
├── packages/
│   ├── ui/               # Shared UI components
│   ├── database/         # Prisma schema
│   ├── auth/             # Clerk helpers
│   ├── config/           # Shared configs
│   ├── validators/       # Zod schemas
│   └── ai/               # AI utilities
└── services/
    ├── video-processor/  # Video processing
    └── alert-engine/     # Alert distribution
```

## ✨ Features

### ✅ Implemented

- **Backend API**: Complete tRPC API with 9 routers
- **Dashboard**: Next.js web interface with all major pages
- **Edge Agent**: AI detection pipeline with YOLO
- **AI Integration**: Claude 4.5, LangChain chains, vector search
- **Security**: Helmet, CORS, rate limiting, authentication
- **Deployment**: Docker, CI/CD, monitoring

### 🚧 In Progress

- Live video feeds (WebRTC/HLS)
- Real-time WebSocket updates
- Advanced visualizations

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, ShadCN
- **Backend**: Node.js, Express, tRPC, Prisma, PostgreSQL
- **AI/ML**: Claude 4.5, LangChain, ONNX Runtime, YOLO
- **Auth**: Clerk
- **Infrastructure**: Docker, TurboRepo, Vitest

## 📝 Scripts

```bash
npm run dev          # Start all apps in development
npm run build        # Build all packages
npm run lint         # Run linting
npm run type-check   # TypeScript type checking
npm run test         # Run tests
npm run test:watch   # Watch mode tests
npm run test:coverage # Coverage report
```

## 🔐 Environment Variables

All environment variables are configured via `scripts/setup-env.ps1` or manually:

- **Clerk**: Authentication keys
- **Database**: PostgreSQL connection string
- **AI Services**: Claude API key
- **Google Maps**: API key for location services

See [SETUP_ENV.md](SETUP_ENV.md) for details.

## 🚀 Deploy

- **API (backend):** [Deploy to Fly.io via GitHub](docs/DEPLOY_API_FLY.md) — `fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile` (from repo root). Add `FLY_API_TOKEN` in GitHub for auto-deploy on push to `main`.
- **Web (frontend):** [Deploy to Fly.io](docs/DEPLOY_WEB_FLY.md) — `fly deploy --config fly.web.toml -a canopy-sight-web` (from repo root). Or [Vercel](docs/DEPLOY_WEB_VERCEL.md).

## 🐳 Docker (local)

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up
```

## 📖 Learn More

- [Architecture Overview](BUILD_SUMMARY.md)
- [API Documentation](apps/api/README.md)
- [Edge Agent Setup](apps/edge-agent/README.md)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Proprietary - All rights reserved

---

Built with ❤️ for rail safety
