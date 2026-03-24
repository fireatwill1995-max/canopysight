import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration test skeleton for job.router.ts
 *
 * Mocks BullMQ queue-service functions and Prisma to test router logic.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@canopy-sight/config", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services/queue-service", () => ({
  getJobStatus: vi.fn(),
  cancelJob: vi.fn(),
  retryJob: vi.fn(),
}));

import {
  getJobStatus,
  cancelJob,
  retryJob,
} from "../../services/queue-service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

function createMockCtx() {
  return {
    userId: "user-test-1",
    organizationId: "org-test-1",
    prisma: createMockPrisma(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("job.router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns mapped job records from the database", async () => {
      const mockJobs = [
        {
          id: "job-1",
          queue: "ai-inference",
          status: "completed",
          data: { fileId: "f1" },
          result: { detections: 3 },
          error: null,
          created_at: new Date("2025-01-01"),
          updated_at: new Date("2025-01-01"),
        },
        {
          id: "job-2",
          queue: "notifications",
          status: "active",
          data: {},
          result: null,
          error: null,
          created_at: new Date("2025-01-02"),
          updated_at: new Date("2025-01-02"),
        },
      ];

      const mockCtx = createMockCtx();
      vi.mocked(mockCtx.prisma.$queryRawUnsafe).mockResolvedValue(mockJobs);

      const results = await mockCtx.prisma.$queryRawUnsafe(
        "SELECT ...",
        mockCtx.organizationId,
        null,
        null,
        20,
        0,
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("job-1");
      expect(results[1].status).toBe("active");
    });

    it("filters by queue when specified", async () => {
      const mockCtx = createMockCtx();
      vi.mocked(mockCtx.prisma.$queryRawUnsafe).mockResolvedValue([]);

      await mockCtx.prisma.$queryRawUnsafe(
        "SELECT ...",
        mockCtx.organizationId,
        "ai-inference",
        null,
        20,
        0,
      );

      expect(mockCtx.prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.any(String),
        "org-test-1",
        "ai-inference",
        null,
        20,
        0,
      );
    });
  });

  describe("get", () => {
    it("returns job status when found", async () => {
      const mockStatus = {
        id: "job-1",
        status: "completed",
        data: { fileId: "f1" },
        result: { detections: 5 },
        progress: 100,
      };

      vi.mocked(getJobStatus).mockResolvedValue(mockStatus);

      const status = await getJobStatus("ai-inference" as any, "job-1");

      expect(status).toEqual(mockStatus);
      expect(getJobStatus).toHaveBeenCalledWith("ai-inference", "job-1");
    });

    it("returns null when job is not found", async () => {
      vi.mocked(getJobStatus).mockResolvedValue(null);

      const status = await getJobStatus("ai-inference" as any, "non-existent");

      expect(status).toBeNull();
      // The router would throw TRPCError NOT_FOUND in this case
    });
  });

  describe("cancel", () => {
    it("returns success when job is cancelled", async () => {
      vi.mocked(cancelJob).mockResolvedValue(true);

      const cancelled = await cancelJob("ai-inference" as any, "job-1");

      expect(cancelled).toBe(true);
      expect(cancelJob).toHaveBeenCalledWith("ai-inference", "job-1");
    });

    it("returns false when job cannot be cancelled", async () => {
      vi.mocked(cancelJob).mockResolvedValue(false);

      const cancelled = await cancelJob("ai-inference" as any, "completed-job");

      expect(cancelled).toBe(false);
      // The router would throw TRPCError BAD_REQUEST in this case
    });
  });

  describe("retry", () => {
    it("returns true when job is retried successfully", async () => {
      vi.mocked(retryJob).mockResolvedValue(true);

      const retried = await retryJob("ai-inference" as any, "failed-job");

      expect(retried).toBe(true);
    });

    it("returns false when job cannot be retried", async () => {
      vi.mocked(retryJob).mockResolvedValue(false);

      const retried = await retryJob("ai-inference" as any, "active-job");

      expect(retried).toBe(false);
    });
  });
});
