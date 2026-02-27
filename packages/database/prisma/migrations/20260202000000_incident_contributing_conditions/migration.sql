-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "contributingConditions" JSONB;
