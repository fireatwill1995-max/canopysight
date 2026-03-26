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
  // Single-org model: all requests are authenticated as the canopy-admin user.
  // Replace with a real auth provider (Clerk, Auth0, etc.) for multi-tenancy.

  const runDb = async (): Promise<Context> => {
    const org = await prisma.organization.upsert({
      where: { slug: "canopy-org" },
      update: {},
      create: {
        name: "Canopy Sight",
        slug: "canopy-org",
      },
    });

    const user = await prisma.user.upsert({
      where: { clerkId: "canopy-admin" },
      update: {
        organizationId: org.id,
        role: "admin",
        email: "admin@canopysight.com",
        firstName: "Canopy",
        lastName: "Admin",
      },
      create: {
        clerkId: "canopy-admin",
        email: "admin@canopysight.com",
        firstName: "Canopy",
        lastName: "Admin",
        role: "admin",
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
