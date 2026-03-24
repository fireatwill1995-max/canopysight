import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "upload";

export interface AuditEventInput {
  userId: string;
  action: AuditAction;
  resource: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    // Use raw SQL to insert into audit_logs table in case the Prisma model
    // hasn't been generated yet. This makes the service resilient to schema
    // drift.  If an AuditLog model exists in the Prisma schema, a typed
    // approach can replace this later.
    await prisma.$executeRaw`
      INSERT INTO "audit_logs" ("id", "user_id", "action", "resource", "metadata", "ip", "user_agent", "created_at")
      VALUES (
        gen_random_uuid(),
        ${event.userId},
        ${event.action},
        ${event.resource},
        ${JSON.stringify(event.metadata ?? {})}::jsonb,
        ${event.ip ?? null},
        ${event.userAgent ?? null},
        NOW()
      )
    `;

    logger.debug("Audit event logged", {
      userId: event.userId,
      action: event.action,
      resource: event.resource,
    });
  } catch (error) {
    // Audit logging should never break the main flow. Log and move on.
    logger.warn("Failed to write audit log (table may not exist yet)", {
      error: error instanceof Error ? error.message : String(error),
      action: event.action,
      resource: event.resource,
    });
  }
}

// Fire-and-forget helper: schedules audit logging without awaiting
export function logAuditEventAsync(event: AuditEventInput): void {
  logAuditEvent(event).catch(() => {
    // Already handled inside logAuditEvent
  });
}
