import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("@canopy-sight/database", () => ({
  prisma: {
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@canopy-sight/config", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { logAuditEvent, logAuditEventAsync } from "../audit-service";
import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

describe("logAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseEvent = {
    userId: "user-123",
    action: "create" as const,
    resource: "file:abc",
  };

  it("calls prisma.$executeRaw to insert an audit log", async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    await logAuditEvent(baseEvent);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("logs a debug message on success", async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    await logAuditEvent(baseEvent);

    expect(logger.debug).toHaveBeenCalledWith(
      "Audit event logged",
      expect.objectContaining({
        userId: "user-123",
        action: "create",
        resource: "file:abc",
      }),
    );
  });

  it("does not throw when prisma.$executeRaw rejects", async () => {
    vi.mocked(prisma.$executeRaw).mockRejectedValue(
      new Error("Table does not exist"),
    );

    // Should not throw
    await expect(logAuditEvent(baseEvent)).resolves.toBeUndefined();
  });

  it("logs a warning when the insert fails", async () => {
    vi.mocked(prisma.$executeRaw).mockRejectedValue(
      new Error("Table does not exist"),
    );

    await logAuditEvent(baseEvent);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to write audit log"),
      expect.objectContaining({
        error: "Table does not exist",
        action: "create",
        resource: "file:abc",
      }),
    );
  });

  it("passes optional fields (ip, userAgent, metadata)", async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    await logAuditEvent({
      ...baseEvent,
      ip: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { key: "value" },
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalled();
  });
});

describe("logAuditEventAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns void (fire-and-forget)", () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    const result = logAuditEventAsync({
      userId: "user-456",
      action: "delete" as const,
      resource: "project:xyz",
    });

    // Should return undefined (void), not a Promise
    expect(result).toBeUndefined();
  });

  it("does not throw even if the underlying call fails", () => {
    vi.mocked(prisma.$executeRaw).mockRejectedValue(
      new Error("Connection lost"),
    );

    // Should not throw
    expect(() =>
      logAuditEventAsync({
        userId: "user-456",
        action: "login" as const,
        resource: "session",
      }),
    ).not.toThrow();
  });
});
