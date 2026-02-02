# Complete Setup Script for Canopy Sight
# This script runs all setup steps automatically

$ErrorActionPreference = "Stop"

Write-Host "🚀 Canopy Sight - Complete Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Node.js
Write-Host "📦 Step 1: Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green

# Step 2: Install dependencies
Write-Host ""
Write-Host "📦 Step 2: Installing dependencies..." -ForegroundColor Yellow
Set-Location $PSScriptRoot\..
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Step 3: Generate Prisma Client
Write-Host ""
Write-Host "🗄️  Step 3: Generating Prisma Client..." -ForegroundColor Yellow
Set-Location packages\database
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green

# Step 4: Check PostgreSQL
Write-Host ""
Write-Host "🗄️  Step 4: Checking PostgreSQL..." -ForegroundColor Yellow
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "⚠️  PostgreSQL not found in PATH" -ForegroundColor Yellow
    Write-Host "   Please install PostgreSQL or add it to your PATH" -ForegroundColor Yellow
    Write-Host "   You can still continue, but database setup will need to be done manually" -ForegroundColor Yellow
} else {
    Write-Host "✅ PostgreSQL found" -ForegroundColor Green
    
    # Try to connect and set up database
    Write-Host ""
    Write-Host "📝 Setting up database..." -ForegroundColor Yellow
    Write-Host "   Please enter your PostgreSQL credentials:" -ForegroundColor Cyan
    
    $dbUser = Read-Host "PostgreSQL username (default: postgres)"
    if ([string]::IsNullOrWhiteSpace($dbUser)) {
        $dbUser = "postgres"
    }
    
    $securePassword = Read-Host "PostgreSQL password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $dbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    $dbHost = Read-Host "PostgreSQL host (default: localhost)"
    if ([string]::IsNullOrWhiteSpace($dbHost)) {
        $dbHost = "localhost"
    }
    
    $dbPort = Read-Host "PostgreSQL port (default: 5432)"
    if ([string]::IsNullOrWhiteSpace($dbPort)) {
        $dbPort = "5432"
    }
    
    $dbName = "meeting_intelligence"
    $DATABASE_URL = "postgresql://$dbUser`:$dbPass@$dbHost`:$dbPort/$dbName"
    
    # Update .env files
    Write-Host ""
    Write-Host "📝 Updating .env files with database credentials..." -ForegroundColor Yellow
    
    $apiEnvPath = "..\..\apps\api\.env"
    $dbEnvPath = ".env"
    
    if (Test-Path $apiEnvPath) {
        (Get-Content $apiEnvPath) -replace "DATABASE_URL=.*", "DATABASE_URL=$DATABASE_URL" | Set-Content $apiEnvPath
        Write-Host "✅ Updated apps/api/.env" -ForegroundColor Green
    }
    
    if (Test-Path $dbEnvPath) {
        "DATABASE_URL=$DATABASE_URL" | Set-Content $dbEnvPath
        Write-Host "✅ Updated packages/database/.env" -ForegroundColor Green
    }
    
    # Create database
    Write-Host ""
    Write-Host "🗄️  Creating database..." -ForegroundColor Yellow
    $env:PGPASSWORD = $dbPass
    
    try {
        & psql -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
        Write-Host "✅ Database created or already exists" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not create database automatically" -ForegroundColor Yellow
        Write-Host "   Please create it manually: CREATE DATABASE $dbName;" -ForegroundColor Yellow
    }
    
    # Install pgvector extension
    Write-Host ""
    Write-Host "🔌 Installing pgvector extension..." -ForegroundColor Yellow
    try {
        & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 | Out-Null
        Write-Host "✅ pgvector extension installed" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not install pgvector automatically" -ForegroundColor Yellow
        Write-Host "   Please install it manually: CREATE EXTENSION IF NOT EXISTS vector;" -ForegroundColor Yellow
    }
    
    # Push schema
    Write-Host ""
    Write-Host "📊 Pushing database schema..." -ForegroundColor Yellow
    npm run db:push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database schema pushed successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Database schema push had issues" -ForegroundColor Yellow
        Write-Host "   You may need to run: npm run db:push" -ForegroundColor Yellow
    }
    
    Remove-Item Env:\PGPASSWORD
}

# Step 5: Summary
Write-Host ""
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update database credentials in .env files if needed" -ForegroundColor White
Write-Host "2. Start the API server: cd apps/api && npm run dev" -ForegroundColor White
Write-Host "3. Start the web app: cd apps/web && npm run dev" -ForegroundColor White
Write-Host "4. Visit http://localhost:3000 and use Demo Login for testing" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - Quick Start: QUICK_START.md" -ForegroundColor White
Write-Host "   - Setup Guide: SETUP.md" -ForegroundColor White
Write-Host "   - Demo Login: DEMO_LOGIN_GUIDE.md" -ForegroundColor White
