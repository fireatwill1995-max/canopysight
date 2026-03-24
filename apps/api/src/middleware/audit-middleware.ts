import { logAuditEventAsync, type AuditAction } from "../services/audit-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tRPC middleware generics are complex
export function auditMiddleware(): any {
  return async (opts: {
    ctx: { userId?: string; organizationId?: string };
    path: string;
    type: string;
    next: () => Promise<unknown>;
  }) => {
    const result = await opts.next();

    // Only audit mutations (create/update/delete operations)
    if (opts.type !== "mutation") {
      return result;
    }

    // Derive action from procedure path
    let action: AuditAction = "update";
    const pathLower = opts.path.toLowerCase();
    if (pathLower.includes("create") || pathLower.includes("add")) {
      action = "create";
    } else if (pathLower.includes("delete") || pathLower.includes("remove")) {
      action = "delete";
    } else if (pathLower.includes("upload")) {
      action = "upload";
    } else if (pathLower.includes("export")) {
      action = "export";
    }

    // Fire-and-forget: don't block the response
    if (opts.ctx.userId) {
      logAuditEventAsync({
        userId: opts.ctx.userId,
        action,
        resource: opts.path,
        metadata: {
          organizationId: opts.ctx.organizationId,
          type: opts.type,
        },
      });
    }

    return result;
  };
}
