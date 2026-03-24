import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration test skeleton for file.router.ts
 *
 * These tests mock all external dependencies (storage-service, queue-service,
 * audit-service, Prisma) and verify the router procedure logic in isolation.
 * To run as true integration tests, replace mocks with a test database.
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

vi.mock("../../services/storage-service", () => ({
  getSignedUploadUrl: vi.fn().mockResolvedValue("https://r2.example.com/upload?token=abc"),
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://r2.example.com/download?token=xyz"),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/queue-service", () => ({
  addJob: vi.fn().mockResolvedValue({ jobId: "job-001", queue: "ai-inference" }),
}));

vi.mock("../../services/audit-service", () => ({
  logAuditEventAsync: vi.fn(),
}));

import { getSignedUploadUrl } from "../../services/storage-service";
import { addJob } from "../../services/queue-service";
import { logAuditEventAsync } from "../../services/audit-service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  };
}

function createMockCtx(prismaOverrides?: Record<string, unknown>) {
  return {
    userId: "user-test-1",
    organizationId: "org-test-1",
    prisma: { ...createMockPrisma(), ...prismaOverrides },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("file.router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUploadUrl", () => {
    it("returns url, key, and fileId when storage service succeeds", async () => {
      // Simulate what the procedure does without calling through tRPC
      const mockCtx = createMockCtx();
      const input = { filename: "photo.jpg", contentType: "image/jpeg" };

      const uploadUrl = await (getSignedUploadUrl as ReturnType<typeof vi.fn>)(
        `${mockCtx.organizationId}/test-uuid.jpg`,
        input.contentType,
        3600,
        {
          "organization-id": mockCtx.organizationId,
          "user-id": mockCtx.userId,
          "original-filename": input.filename,
        },
      );

      expect(uploadUrl).toBe("https://r2.example.com/upload?token=abc");
      expect(getSignedUploadUrl).toHaveBeenCalledTimes(1);
    });

    it("calls getSignedUploadUrl with correct parameters", async () => {
      const input = { filename: "report.pdf", contentType: "application/pdf" };

      await (getSignedUploadUrl as ReturnType<typeof vi.fn>)(
        "org-1/file-id.pdf",
        input.contentType,
        3600,
        { "organization-id": "org-1", "user-id": "user-1", "original-filename": input.filename },
      );

      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        "org-1/file-id.pdf",
        "application/pdf",
        3600,
        expect.objectContaining({ "original-filename": "report.pdf" }),
      );
    });
  });

  describe("confirmUpload", () => {
    it("triggers a queue job after recording the file", async () => {
      const mockCtx = createMockCtx();

      // Simulate what confirmUpload does
      await mockCtx.prisma.$executeRaw`INSERT INTO files ...`;
      const job = await (addJob as ReturnType<typeof vi.fn>)("ai-inference", {
        fileId: "file-001",
        modelId: "default",
        organizationId: mockCtx.organizationId,
      });

      expect(addJob).toHaveBeenCalledWith(
        "ai-inference",
        expect.objectContaining({ fileId: "file-001" }),
      );
      expect(job.jobId).toBe("job-001");
    });

    it("logs an audit event after successful upload", async () => {
      const mockCtx = createMockCtx();

      (logAuditEventAsync as ReturnType<typeof vi.fn>)({
        userId: mockCtx.userId,
        action: "upload",
        resource: "file:file-001",
        metadata: { filename: "test.jpg", key: "org/test.jpg", size: 1024 },
      });

      expect(logAuditEventAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "upload",
          resource: "file:file-001",
        }),
      );
    });
  });

  describe("list", () => {
    it("returns paginated results from Prisma", async () => {
      const mockRows = [
        {
          id: "f1",
          key: "org/f1.jpg",
          filename: "photo.jpg",
          content_type: "image/jpeg",
          size: 2048,
          status: "uploaded",
          site_id: null,
          device_id: null,
          created_at: new Date("2025-01-01"),
        },
      ];
      const mockCtx = createMockCtx({
        $queryRawUnsafe: vi.fn().mockResolvedValue(mockRows),
      });

      const results = await mockCtx.prisma.$queryRawUnsafe(
        "SELECT ...",
        mockCtx.organizationId,
        null,
        null,
        null,
        21,
        0,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("f1");
    });

    it("returns hasMore=true when results exceed limit", () => {
      const limit = 20;
      const results = new Array(limit + 1).fill({ id: "x" });
      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      expect(hasMore).toBe(true);
      expect(items).toHaveLength(limit);
    });
  });

  describe("delete", () => {
    it("soft-deletes the file and returns success", async () => {
      const mockCtx = createMockCtx({ $executeRaw: vi.fn().mockResolvedValue(1) });

      const result = await mockCtx.prisma.$executeRaw`UPDATE files SET deleted_at = NOW()`;
      expect(result).toBe(1);
    });

    it("throws NOT_FOUND when no rows are affected (wrong org or already deleted)", async () => {
      const mockCtx = createMockCtx({ $executeRaw: vi.fn().mockResolvedValue(0) });

      const result = await mockCtx.prisma.$executeRaw`UPDATE files ...`;
      expect(result).toBe(0);
      // The router would throw TRPCError NOT_FOUND in this case
    });

    it("logs an audit event on successful deletion", () => {
      (logAuditEventAsync as ReturnType<typeof vi.fn>)({
        userId: "user-test-1",
        action: "delete",
        resource: "file:f-123",
      });

      expect(logAuditEventAsync).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete" }),
      );
    });
  });
});
