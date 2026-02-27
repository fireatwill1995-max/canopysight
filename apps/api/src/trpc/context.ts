import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

export interface Context {
  userId?: string;
  organizationId?: string;
  userRole?: string;
  prisma: typeof prisma;
}

export async function createContext(opts: { req: { headers: Record<string, string | string[] | undefined> } }): Promise<Context> {
  const req = opts.req;
  // Clerk has been removed. In this demo build, always act as a single
  // demo admin user bound to a demo organization so that all protected
  // procedures have a valid organization/user context.

  const demoRoleHeader = req.headers["x-demo-user-role"];
  const demoRole = Array.isArray(demoRoleHeader) ? demoRoleHeader[0] : demoRoleHeader;

  const runDb = async (): Promise<Context> => {
    const org = await prisma.organization.upsert({
      where: { slug: "demo-org" },
      update: {},
      create: {
        name: "Demo Organization",
        slug: "demo-org",
      },
    });

    const user = await prisma.user.upsert({
      where: { clerkId: "demo-user-123" },
      update: {
        organizationId: org.id,
        role: demoRole || "admin",
        email: "demo@canopysight.com",
        firstName: "Demo",
        lastName: "User",
      },
      create: {
        clerkId: "demo-user-123",
        email: "demo@canopysight.com",
        firstName: "Demo",
        lastName: "User",
        role: demoRole || "admin",
        organizationId: org.id,
      },
    });

    return {
      userId: user.id,
      organizationId: org.id,
      userRole: user.role,
      prisma,
    };
  };

  const runWithTimeout = (timeoutMs: number) =>
    Promise.race([
      runDb(),
      new Promise<Context>((_, reject) =>
        setTimeout(() => reject(new Error("Database operation timeout")), timeoutMs)
      ),
    ]);

  try {
    return await runWithTimeout(5000);
  } catch (firstError) {
    logger.warn("tRPC context creation failed, retrying once", {
      error: firstError instanceof Error ? firstError.message : String(firstError),
    });
    await new Promise((r) => setTimeout(r, 500));
    try {
      return await runWithTimeout(5000);
    } catch (error) {
      logger.error("Failed to create tRPC context after 2 attempts", error, {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        userId: undefined,
        organizationId: undefined,
        userRole: undefined,
        prisma,
      };
    }
  }
}
