import { describe, it, expect } from "vitest";
import { appRouter } from "../router";

describe("Site Router", () => {
  const ctx = {
    userId: "test-user",
    organizationId: "test-org",
    userRole: "admin",
    prisma: {} as any, // Mock Prisma client
  };

  it("should have list procedure", () => {
    expect(appRouter.site.list).toBeDefined();
  });

  it("should have create procedure", () => {
    expect(appRouter.site.create).toBeDefined();
  });

  // Add more tests as needed
});
