# Database Setup Script for Canopy Sight (PowerShell)
# This script sets up PostgreSQL with pgvector extension

Write-Host "🗄️  Setting up Canopy Sight database..." -ForegroundColor Cyan

# Check if PostgreSQL is installed
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ PostgreSQL is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host "📝 Please enter your PostgreSQL credentials:" -ForegroundColor Yellow

$DB_USER = Read-Host "PostgreSQL username (default: postgres)"
if ([string]::IsNullOrWhiteSpace($DB_USER)) {
    $DB_USER = "postgres"
}

$securePassword = Read-Host "PostgreSQL password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$DB_PASS = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$DB_HOST = Read-Host "PostgreSQL host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($DB_HOST)) {
    $DB_HOST = "localhost"
}

$DB_PORT = Read-Host "PostgreSQL port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($DB_PORT)) {
    $DB_PORT = "5432"
}

$DB_NAME = "meeting_intelligence"

Write-Host "Creating database if it doesn't exist..." -ForegroundColor Yellow

# Set password environment variable
$env:PGPASSWORD = $DB_PASS

# Create database
try {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>&1 | Out-Null
    Write-Host "✅ Database created or already exists" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database creation skipped (may already exist)" -ForegroundColor Yellow
}

Write-Host "Installing pgvector extension..." -ForegroundColor Yellow

# Install pgvector extension
try {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 | Out-Null
    Write-Host "✅ pgvector extension installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install pgvector extension." -ForegroundColor Red
    Write-Host "You may need to install pgvector separately." -ForegroundColor Yellow
    Write-Host "See: https://github.com/pgvector/pgvector" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Update your .env files with:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update DATABASE_URL in apps/api/.env"
Write-Host "2. Update DATABASE_URL in packages/database/.env"
Write-Host "3. Run: cd packages/database && npm run db:push"
Write-Host "4. Run: cd packages/database && npm run db:generate"

# Clear password from environment
Remove-Item Env:\PGPASSWORD
