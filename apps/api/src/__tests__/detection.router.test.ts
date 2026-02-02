import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "../router";
import { createContext } from "../trpc/context";
import { prisma } from "@canopy-sight/database";

// Mock the database
vi.mock("@canopy-sight/database", () => ({
  prisma: {
    detectionEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

describe("Detection Router", () => {
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
    it("should fetch detection events with filters", async () => {
      const mockEvents = [
        {
          id: "event-1",
          type: "person",
          confidence: 0.95,
          timestamp: new Date(),
          organizationId: "test-org-123",
          siteId: "site-1",
          deviceId: "device-1",
        },
      ];

      (prisma.detectionEvent.findMany as any).mockResolvedValue(mockEvents);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.detection.list({
        limit: 10,
        siteId: "site-1",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("event-1");
      expect(prisma.detectionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "test-org-123",
            siteId: "site-1",
          }),
        })
      );
    });

    it("should handle pagination with cursor", async () => {
      const mockEvents = Array.from({ length: 11 }, (_, i) => ({
        id: `event-${i}`,
        type: "person",
        confidence: 0.9,
        timestamp: new Date(),
        organizationId: "test-org-123",
      }));

      (prisma.detectionEvent.findMany as any).mockResolvedValue(mockEvents);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.detection.list({
        limit: 10,
        cursor: "event-0",
      });

      expect(result.items.length).toBeLessThanOrEqual(10);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe("byId", () => {
    it("should fetch a single detection event", async () => {
      const mockEvent = {
        id: "event-1",
        type: "person",
        confidence: 0.95,
        timestamp: new Date(),
        organizationId: "test-org-123",
        site: { id: "site-1", name: "Test Site" },
        device: { id: "device-1", name: "Test Device" },
      };

      (prisma.detectionEvent.findFirst as any).mockResolvedValue(mockEvent);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.detection.byId({ id: "event-1" });

      expect(result.id).toBe("event-1");
      expect(result.site).toBeDefined();
      expect(prisma.detectionEvent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "event-1",
            organizationId: "test-org-123",
          },
        })
      );
    });

    it("should throw NOT_FOUND for non-existent event", async () => {
      (prisma.detectionEvent.findFirst as any).mockResolvedValue(null);

      const caller = appRouter.createCaller(mockCtx);

      await expect(caller.detection.byId({ id: "non-existent" })).rejects.toThrow("not found");
    });
  });

  describe("stats", () => {
    it("should calculate detection statistics", async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      (prisma.detectionEvent.count as any).mockResolvedValue(100);
      (prisma.detectionEvent.groupBy as any).mockResolvedValue([
        { type: "person", _count: 60 },
        { type: "vehicle", _count: 40 },
      ]);
      (prisma.detectionEvent.aggregate as any).mockResolvedValue({
        _avg: { riskScore: 75.5 },
      });

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.detection.stats({
        startDate,
        endDate,
      });

      expect(result.total).toBe(100);
      expect(result.byType).toHaveLength(2);
      expect(result.avgRiskScore).toBe(75.5);
    });
  });
});
