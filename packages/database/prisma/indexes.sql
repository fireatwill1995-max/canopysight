-- Performance indexes for Canopy Sight
-- These indexes supplement the ones already defined in schema.prisma.
-- Run against the PostgreSQL database to add any missing indexes.
--
-- Note: Prisma already manages indexes via @@index() directives in schema.prisma.
-- This file documents additional recommended indexes for query-heavy workloads
-- and composite indexes for common access patterns.

-- ============================================================================
-- DetectionEvent indexes (high-volume table)
-- ============================================================================
-- Already in Prisma: organizationId, siteId, deviceId, type, timestamp, riskScore, createdAt
-- Already in Prisma (composite): [orgId, siteId, timestamp], [orgId, deviceId, timestamp], [orgId, type, timestamp], [siteId, timestamp, riskScore]

-- Device + createdAt for device-scoped time-series queries
CREATE INDEX IF NOT EXISTS idx_detection_event_device_created
  ON "DetectionEvent"("deviceId", "createdAt" DESC);

-- Site + type for filtered analytics
CREATE INDEX IF NOT EXISTS idx_detection_event_site_type
  ON "DetectionEvent"("siteId", "type");

-- ============================================================================
-- Alert indexes
-- ============================================================================
-- Already in Prisma: organizationId, siteId, severity, status, createdAt
-- Already in Prisma (composite): [orgId, status, createdAt], [orgId, severity, status], [siteId, status, createdAt]

-- Device + status for device-specific alert lookups
CREATE INDEX IF NOT EXISTS idx_alert_device_status
  ON "Alert"("deviceId", "status")
  WHERE "deviceId" IS NOT NULL;

-- ============================================================================
-- VideoClip indexes
-- ============================================================================
-- Already in Prisma: organizationId, siteId, deviceId, startTime

-- Device + time range for playback queries
CREATE INDEX IF NOT EXISTS idx_video_clip_device_time
  ON "VideoClip"("deviceId", "startTime" DESC);

-- ============================================================================
-- AuditLog indexes
-- ============================================================================
-- Already in Prisma: organizationId, userId, [resourceType, resourceId], createdAt

-- User + createdAt for user activity audit trails
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON "AuditLog"("userId", "createdAt" DESC)
  WHERE "userId" IS NOT NULL;

-- Org + action for compliance reporting
CREATE INDEX IF NOT EXISTS idx_audit_log_org_action
  ON "AuditLog"("organizationId", "action");

-- ============================================================================
-- SystemHealth indexes
-- ============================================================================
-- Already in Prisma: organizationId, deviceId, timestamp
-- Already in Prisma (composite): [orgId, deviceId, timestamp]

-- Device + recent timestamp for health dashboard
CREATE INDEX IF NOT EXISTS idx_system_health_device_recent
  ON "SystemHealth"("deviceId", "timestamp" DESC)
  WHERE "deviceId" IS NOT NULL;

-- ============================================================================
-- Device indexes
-- ============================================================================
-- Already in Prisma: organizationId, siteId, status, lastHeartbeat, deviceType

-- Site + status for site overview dashboard
CREATE INDEX IF NOT EXISTS idx_device_site_status
  ON "Device"("siteId", "status");

-- ============================================================================
-- RiskScore indexes
-- ============================================================================
-- Already in Prisma: detectionEventId, overallScore

-- High-risk score lookup for alert generation
CREATE INDEX IF NOT EXISTS idx_risk_score_high
  ON "RiskScore"("overallScore" DESC)
  WHERE "overallScore" >= 70;
