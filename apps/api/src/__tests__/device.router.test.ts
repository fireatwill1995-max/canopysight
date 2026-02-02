import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "../router";
import { prisma } from "@canopy-sight/database";

vi.mock("@canopy-sight/database", () => ({
  prisma: {
    device: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cameraConfig: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    site: {
      findFirst: vi.fn(),
    },
  },
}));

describe("Device Router", () => {
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
    it("should fetch devices with filters", async () => {
      const mockDevices = [
        {
          id: "device-1",
          name: "Test Device",
          status: "online",
          organizationId: "test-org-123",
          siteId: "site-1",
        },
      ];

      (prisma.device.findMany as any).mockResolvedValue(mockDevices);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.list({
        siteId: "site-1",
        status: "online",
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("online");
    });
  });

  describe("byId", () => {
    it("should fetch a single device", async () => {
      const mockDevice = {
        id: "device-1",
        name: "Test Device",
        status: "online",
        organizationId: "test-org-123",
        site: { id: "site-1", name: "Test Site" },
        systemHealth: [],
      };

      (prisma.device.findFirst as any).mockResolvedValue(mockDevice);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.byId({ id: "device-1" });

      expect(result.id).toBe("device-1");
      expect(result.site).toBeDefined();
    });
  });

  describe("create", () => {
    it("should create a device (admin only)", async () => {
      const mockDevice = {
        id: "device-1",
        name: "New Device",
        siteId: "site-1",
        organizationId: "test-org-123",
        status: "offline",
        deviceType: "camera",
        createdAt: new Date(),
      };

      (prisma.device.create as any).mockResolvedValue(mockDevice);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.create({
        name: "New Device",
        siteId: "site-1",
        deviceType: "camera",
        status: "offline",
      });

      expect(result.name).toBe("New Device");
      expect(prisma.device.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "New Device",
            organizationId: "test-org-123",
          }),
        })
      );
    });
  });

  describe("update", () => {
    it("should update a device (admin only)", async () => {
      const mockDevice = {
        id: "device-1",
        name: "Updated Device",
        siteId: "site-1",
        organizationId: "test-org-123",
        status: "online",
        deviceType: "camera",
      };
      (prisma.device.findFirst as any).mockResolvedValue({ id: "device-1", organizationId: "test-org-123" });
      (prisma.device.update as any).mockResolvedValue(mockDevice);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.update({
        id: "device-1",
        name: "Updated Device",
        status: "online",
      });

      expect(result.name).toBe("Updated Device");
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: expect.objectContaining({ name: "Updated Device", status: "online" }),
        })
      );
    });
  });

  describe("createCameraConfig", () => {
    it("should create a camera config (admin only)", async () => {
      const mockConfig = {
        id: "cam-config-1",
        deviceId: "device-1",
        cameraIndex: 0,
        name: "Main camera",
        resolution: "1920x1080",
        fps: 30,
        is360: false,
        isActive: true,
      };
      (prisma.device.findFirst as any).mockResolvedValue({ id: "device-1", organizationId: "test-org-123" });
      (prisma.cameraConfig.create as any).mockResolvedValue(mockConfig);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.createCameraConfig({
        deviceId: "device-1",
        cameraIndex: 0,
        name: "Main camera",
        resolution: "1920x1080",
        fps: 30,
        is360: false,
        isActive: true,
      });

      expect(result.id).toBe("cam-config-1");
      expect(prisma.cameraConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceId: "device-1",
            cameraIndex: 0,
            name: "Main camera",
          }),
        })
      );
    });
  });

  describe("updateCameraConfig", () => {
    it("should update a camera config (admin only)", async () => {
      const mockConfig = {
        id: "cam-config-1",
        deviceId: "device-1",
        resolution: "1280x720",
        isActive: false,
      };
      (prisma.device.findFirst as any).mockResolvedValue({ id: "device-1", organizationId: "test-org-123" });
      (prisma.cameraConfig.findFirst as any).mockResolvedValue({ id: "cam-config-1", deviceId: "device-1" });
      (prisma.cameraConfig.update as any).mockResolvedValue(mockConfig);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.updateCameraConfig({
        id: "cam-config-1",
        deviceId: "device-1",
        resolution: "1280x720",
        isActive: false,
      });

      expect(result.resolution).toBe("1280x720");
      expect(prisma.cameraConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cam-config-1" },
          data: expect.objectContaining({ resolution: "1280x720", isActive: false }),
        })
      );
    });
  });

  describe("deleteCameraConfig", () => {
    it("should delete a camera config (admin only)", async () => {
      (prisma.device.findFirst as any).mockResolvedValue({ id: "device-1", organizationId: "test-org-123" });
      (prisma.cameraConfig.findFirst as any).mockResolvedValue({ id: "cam-config-1", deviceId: "device-1" });
      (prisma.cameraConfig.delete as any).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.device.deleteCameraConfig({ id: "cam-config-1", deviceId: "device-1" });

      expect(result.success).toBe(true);
      expect(prisma.cameraConfig.delete).toHaveBeenCalledWith({ where: { id: "cam-config-1" } });
    });
  });
});
