import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../router";
import { createContext } from "../trpc/context";

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
