#!/usr/bin/env node
/**
 * One-off: enable pgvector extension on Postgres. Run before prisma db push
 * when the schema uses Unsupported("vector(...)").
 * Usage: from repo root, DATABASE_URL set: node packages/database/scripts/enable-pgvector.js
 * Or from packages/database: node scripts/enable-pgvector.js
 */
const { prisma } = require("@canopy-sight/database");

async function main() {
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "vector"');
    console.log("pgvector extension enabled.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
