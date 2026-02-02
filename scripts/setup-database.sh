#!/bin/bash

# Database Setup Script for Canopy Sight
# This script sets up PostgreSQL with pgvector extension

set -e

echo "🗄️  Setting up Canopy Sight database..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed. Please install it first.${NC}"
    exit 1
fi

echo -e "${YELLOW}📝 Please enter your PostgreSQL credentials:${NC}"
read -p "PostgreSQL username (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "PostgreSQL password: " DB_PASS
echo ""

read -p "PostgreSQL host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "PostgreSQL port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

DB_NAME="meeting_intelligence"

echo -e "${YELLOW}Creating database if it doesn't exist...${NC}"

# Create database
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database already exists or error occurred"

echo -e "${YELLOW}Installing pgvector extension...${NC}"

# Install pgvector extension
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
    echo -e "${RED}❌ Failed to install pgvector extension.${NC}"
    echo -e "${YELLOW}You may need to install pgvector separately.${NC}"
    echo -e "${YELLOW}See: https://github.com/pgvector/pgvector${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database setup complete!${NC}"
echo ""
echo -e "${YELLOW}Update your .env files with:${NC}"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update DATABASE_URL in apps/api/.env"
echo "2. Update DATABASE_URL in packages/database/.env"
echo "3. Run: cd packages/database && npm run db:push"
echo "4. Run: cd packages/database && npm run db:generate"
