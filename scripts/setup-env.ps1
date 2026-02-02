# Setup Environment Variables Script
# This script configures all .env files with your credentials

Write-Host "🔧 Setting up environment variables..." -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot

# Clerk credentials (get from https://dashboard.clerk.com)
$CLERK_PUBLISHABLE_KEY = ""
$CLERK_SECRET_KEY = ""

# Database
$DATABASE_URL = "postgresql://user:password@localhost:5432/meeting_intelligence"

# AI Services (get from https://console.anthropic.com)
$ANTHROPIC_API_KEY = ""

# Google Maps (get from https://console.cloud.google.com)
$GOOGLE_MAPS_API_KEY = ""

# API Configuration
$API_URL = "http://localhost:3001"
$PORT = "3001"
$FRONTEND_URL = "http://localhost:3000"

Write-Host "📝 Updating database credentials..." -ForegroundColor Yellow
$dbUser = Read-Host "PostgreSQL username (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "postgres"
}

$securePassword = Read-Host "PostgreSQL password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$dbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$DATABASE_URL = "postgresql://$dbUser`:$dbPass@localhost:5432/meeting_intelligence"

# Root .env
$rootEnv = @"
# Database
DATABASE_URL=$DATABASE_URL

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# API
API_URL=$API_URL
NEXT_PUBLIC_API_URL=$API_URL

# AI Services
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
OPENAI_API_KEY=

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY

# Storage (S3-compatible)
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Notifications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
FCM_SERVER_KEY=

# Monitoring
SENTRY_DSN=

# Node Environment
NODE_ENV=development
"@

# API .env
$apiEnv = @"
# Database
DATABASE_URL=$DATABASE_URL

# Clerk Authentication
CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# API Configuration
PORT=$PORT
FRONTEND_URL=$FRONTEND_URL
NODE_ENV=development

# AI Services
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
OPENAI_API_KEY=

# Redis
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=

# Monitoring
SENTRY_DSN=

# CORS
ALLOWED_ORIGINS=$FRONTEND_URL,http://localhost:3001
"@

# Web .env.local
$webEnv = @"
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# API
NEXT_PUBLIC_API_URL=$API_URL

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=
"@

# Database .env
$dbEnv = @"
DATABASE_URL=$DATABASE_URL
"@

# Edge Agent .env
$edgeEnv = @"
# Device Configuration
DEVICE_ID=
SITE_ID=
API_URL=$API_URL
API_KEY=

# Model Configuration
MODEL_PATH=./models/yolov8n.onnx
CAMERA_INDEX=0
FRAME_RATE=30
DETECTION_THRESHOLD=0.5
RISK_THRESHOLD=50

# Features
ENABLE_TRACKING=true
ENABLE_ANONYMIZATION=true

# Storage
STORAGE_PATH=./storage
MAX_OFFLINE_QUEUE_SIZE=1000

# Heartbeat
HEARTBEAT_INTERVAL=30000
"@

# Write files
Write-Host "📄 Writing environment files..." -ForegroundColor Yellow

$rootEnv | Out-File -FilePath "$rootDir\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created root .env" -ForegroundColor Green

$apiEnv | Out-File -FilePath "$rootDir\apps\api\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created apps/api/.env" -ForegroundColor Green

$webEnv | Out-File -FilePath "$rootDir\apps\web\.env.local" -Encoding utf8 -NoNewline
Write-Host "✅ Created apps/web/.env.local" -ForegroundColor Green

$dbEnv | Out-File -FilePath "$rootDir\packages\database\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created packages/database/.env" -ForegroundColor Green

$edgeEnv | Out-File -FilePath "$rootDir\apps\edge-agent\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created apps/edge-agent/.env" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Environment variables configured!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set up database: .\scripts\setup-database.ps1" -ForegroundColor Cyan
Write-Host "2. Run migrations: cd packages/database && npm run db:push" -ForegroundColor Cyan
Write-Host "3. Start development: npm run dev" -ForegroundColor Cyan
