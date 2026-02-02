import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "../router";
import { prisma } from "@canopy-sight/database";

// Mock the database
vi.mock("@canopy-sight/database", () => ({
  prisma: {
    alert: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    site: {
      findFirst: vi.fn(),
    },
    device: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock alert dispatcher
vi.mock("../services/alert-dispatcher", () => ({
  alertDispatcher: {
    dispatch: vi.fn(),
  },
}));

describe("Alert Router", () => {
  const mockCtx = {
    userId: "test-user-123",
    organizationId: "test-org-123",
    userRole: "admin" as const,
    prisma: prisma as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should fetch alerts with filters", async () => {
      const mockAlerts = [
        {
          id: "alert-1",
          severity: "critical",
          status: "active",
          title: "Test Alert",
          message: "Test message",
          organizationId: "test-org-123",
          siteId: "site-1",
          createdAt: new Date(),
        },
      ];

      (prisma.alert.findMany as any).mockResolvedValue(mockAlerts);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alert.list({
        limit: 10,
        severity: "critical",
        status: "active",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].severity).toBe("critical");
      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "test-org-123",
            severity: "critical",
            status: "active",
          }),
        })
      );
    });

    it("should handle pagination", async () => {
      const mockAlerts = Array.from({ length: 11 }, (_, i) => ({
        id: `alert-${i}`,
        severity: "warning",
        status: "active",
        title: `Alert ${i}`,
        message: "Test",
        organizationId: "test-org-123",
        createdAt: new Date(),
      }));

      (prisma.alert.findMany as any).mockResolvedValue(mockAlerts);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alert.list({ limit: 10 });

      expect(result.items.length).toBeLessThanOrEqual(10);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe("byId", () => {
    it("should fetch a single alert", async () => {
      const mockAlert = {
        id: "alert-1",
        severity: "critical",
        status: "active",
        title: "Test Alert",
        message: "Test message",
        organizationId: "test-org-123",
        site: { id: "site-1", name: "Test Site" },
      };

      (prisma.alert.findFirst as any).mockResolvedValue(mockAlert);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alert.byId({ id: "alert-1" });

      expect(result.id).toBe("alert-1");
      expect(result.site).toBeDefined();
    });

    it("should throw NOT_FOUND for non-existent alert", async () => {
      (prisma.alert.findFirst as any).mockResolvedValue(null);

      const caller = appRouter.createCaller(mockCtx);

      await expect(caller.alert.byId({ id: "non-existent" })).rejects.toThrow("not found");
    });
  });

  describe("acknowledge", () => {
    it("should acknowledge an alert", async () => {
      const mockAlert = {
        id: "alert-1",
        status: "active",
        organizationId: "test-org-123",
      };

      (prisma.alert.findFirst as any).mockResolvedValue(mockAlert);
      (prisma.alert.update as any).mockResolvedValue({
        ...mockAlert,
        status: "acknowledged",
        acknowledgedBy: "test-user-123",
        acknowledgedAt: new Date(),
      });

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alert.acknowledge({ id: "alert-1" });

      expect(result.status).toBe("acknowledged");
      expect(result.acknowledgedBy).toBe("test-user-123");
    });
  });
});
