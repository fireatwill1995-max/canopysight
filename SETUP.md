# Canopy Sight™ - Setup Guide

## Prerequisites

- Node.js 18+ 
- npm 9+
- PostgreSQL database
- Clerk account (for authentication)
- (Optional) Redis for caching
- (Optional) S3-compatible storage

## Initial Setup

1. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Set Up Environment Variables**

   Create `.env` files in:
   - Root directory
   - `apps/api/.env`
   - `apps/web/.env`
   - `apps/edge-agent/.env`

   See `.env.example` files for required variables.

3. **Set Up Database**

   ```bash
   cd packages/database
   npm run db:push
   # Or for migrations:
   npm run db:migrate
   ```

4. **Generate Prisma Client**

   ```bash
   cd packages/database
   npm run db:generate
   ```

5. **Set Up Clerk**

   - Create a Clerk account at https://clerk.com
   - Create a new application
   - Copy the API keys to your `.env` files
   - Configure allowed redirect URLs

## Running the Application

### Development Mode

```bash
# Run all apps
npm run dev

# Or run individually:
cd apps/api && npm run dev
cd apps/web && npm run dev
cd apps/edge-agent && npm run dev
```

### Build for Production

```bash
npm run build
```

## Project Structure

```
canopy-sight/
├── apps/
│   ├── web/              # Next.js dashboard (port 3000)
│   ├── api/              # Express + tRPC API (port 3001)
│   └── edge-agent/       # Raspberry Pi edge software
├── packages/
│   ├── ui/               # Shared UI components
│   ├── database/         # Prisma schema
│   ├── auth/             # Clerk helpers
│   ├── config/           # Shared configs
│   ├── validators/       # Zod schemas
│   └── ai/               # AI utilities
└── services/
    ├── video-processor/  # Video processing service
    └── alert-engine/     # Alert distribution service
```

## Key Features Implemented

### ✅ Backend (tRPC API)
- Site management (CRUD)
- Device management with heartbeat
- Detection event storage and querying
- Alert management with workflows
- Zone configuration
- Analytics and heatmaps
- Video clip management
- Notification preferences
- System health monitoring

### ✅ Frontend (Next.js)
- Dashboard with metrics
- Site management interface
- Device monitoring
- Alert center
- Analytics views
- Zone configuration
- Navigation and authentication

### 🚧 In Progress
- Live video feeds (WebRTC/HLS)
- Real-time WebSocket updates
- Edge agent AI detection
- Advanced visualizations

## Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests (when implemented)
npm run test
```

## Troubleshooting

### Common Issues

1. **Dependency conflicts**: Use `--legacy-peer-deps` flag
2. **Database connection**: Ensure PostgreSQL is running and DATABASE_URL is correct
3. **Clerk authentication**: Verify API keys and redirect URLs
4. **Type errors**: Run `npm run type-check` to identify issues

## Next Steps

See `PROGRESS.md` for detailed implementation status and TODO items.
