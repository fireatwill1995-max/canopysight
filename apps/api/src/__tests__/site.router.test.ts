import { describe, it, expect, vi } from "vitest";

vi.mock("@canopy-sight/database", () => ({
  prisma: {
    organization: { upsert: vi.fn() },
    user: { upsert: vi.fn() },
    site: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    device: { findMany: vi.fn(), findFirst: vi.fn() },
    alert: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    detectionEvent: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import { appRouter } from "../router";

describe("Site Router", () => {
  it("should have list procedure", () => {
    expect(appRouter.site.list).toBeDefined();
  });

  it("should have create procedure", () => {
    expect(appRouter.site.create).toBeDefined();
  });
});
