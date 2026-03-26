import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate an evidence package number in the format EVP-YYYY-NNN.
 * Finds the current highest sequence number for the organization in the
 * current year and increments it.
 */
async function generatePackageNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure["query"]>[0]>[0]["ctx"]["prisma"],
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EVP-${year}-`;

  // Find all packages for this org in the current year to determine next seq
  const existing = await prisma.evidencePackage.findMany({
    where: {
      organizationId,
      packageNumber: { startsWith: prefix },
    },
    select: { packageNumber: true },
    orderBy: { packageNumber: "desc" },
    take: 1,
  });

  let nextSeq = 1;
  if (existing.length > 0) {
    const lastNumber = existing[0].packageNumber;
    const lastSeq = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const evidenceRouter = router({
  // ─── Create ───────────────────────────────────────────────────────────────

  create: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        title: z.string().min(1).max(500),
        incidentIds: z.array(z.string()).default([]),
        detectionIds: z.array(z.string()).default([]),
        summary: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.siteId) {
          const site = await ctx.prisma.site.findFirst({
            where: { id: input.siteId, organizationId: ctx.organizationId },
          });
          if (!site) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
          }
        }

        const packageNumber = await generatePackageNumber(
          ctx.prisma,
          ctx.organizationId
        );

        const pkg = await ctx.prisma.evidencePackage.create({
          data: {
            organizationId: ctx.organizationId,
            siteId: input.siteId ?? null,
            packageNumber,
            title: input.title,
            status: "draft",
            incidentIds: input.incidentIds,
            detectionIds: input.detectionIds,
            summary: input.summary ?? null,
            notes: input.notes ?? null,
            createdById: ctx.userId ?? null,
            timeline: [],
            evidenceItems: [],
          },
        });

        logger.info("Evidence package created", {
          packageId: pkg.id,
          packageNumber: pkg.packageNumber,
          organizationId: ctx.organizationId,
        });

        return pkg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error creating evidence package", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create evidence package",
        });
      }
    }),

  // ─── List ─────────────────────────────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        status: z.enum(["draft", "finalized", "submitted"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const items = await ctx.prisma.evidencePackage.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.siteId && { siteId: input.siteId }),
            ...(input.status && { status: input.status }),
          },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
          ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        });

        let nextCursor: string | undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return { items, nextCursor };
      } catch (error) {
        logger.error("Error fetching evidence packages", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch evidence packages",
        });
      }
    }),

  // ─── Get by ID ────────────────────────────────────────────────────────────

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const pkg = await ctx.prisma.evidencePackage.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });

        if (!pkg) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Evidence package not found",
          });
        }

        return pkg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error fetching evidence package", error, {
          packageId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch evidence package",
        });
      }
    }),

  // ─── Add items ────────────────────────────────────────────────────────────

  addItems: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        items: z.array(
          z.object({
            type: z.enum(["image", "video", "audio", "document", "screenshot"]),
            filePath: z.string(),
            label: z.string().optional(),
            timestamp: z.string().optional(),
            metadata: z.record(z.unknown()).optional(),
          })
        ),
        timelineEvents: z
          .array(
            z.object({
              timestamp: z.string(),
              description: z.string(),
              sourceType: z.string().optional(),
              sourceId: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.evidencePackage.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            status: "draft",
          },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Draft evidence package not found",
          });
        }

        const currentItems = Array.isArray(existing.evidenceItems)
          ? (existing.evidenceItems as object[])
          : [];
        const mergedItems = [...currentItems, ...input.items];

        const currentTimeline = Array.isArray(existing.timeline)
          ? (existing.timeline as object[])
          : [];
        const mergedTimeline = input.timelineEvents
          ? [...currentTimeline, ...input.timelineEvents].sort((a, b) => {
              const aTime = (a as { timestamp: string }).timestamp;
              const bTime = (b as { timestamp: string }).timestamp;
              return new Date(aTime).getTime() - new Date(bTime).getTime();
            })
          : currentTimeline;

        const pkg = await ctx.prisma.evidencePackage.update({
          where: { id: input.id },
          data: {
            evidenceItems: mergedItems,
            timeline: mergedTimeline,
          },
        });

        logger.info("Evidence items added", {
          packageId: input.id,
          itemCount: input.items.length,
          organizationId: ctx.organizationId,
        });

        return pkg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error adding evidence items", error, {
          packageId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add evidence items",
        });
      }
    }),

  // ─── Finalize ─────────────────────────────────────────────────────────────

  finalize: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        summary: z.string().optional(),
        chainOfCustody: z.string().optional(), // SHA-256 hash
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.evidencePackage.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            status: "draft",
          },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Draft evidence package not found",
          });
        }

        const pkg = await ctx.prisma.evidencePackage.update({
          where: { id: input.id },
          data: {
            status: "finalized",
            finalizedAt: new Date(),
            ...(input.summary && { summary: input.summary }),
            ...(input.chainOfCustody && { chainOfCustody: input.chainOfCustody }),
          },
        });

        logger.info("Evidence package finalized", {
          packageId: input.id,
          packageNumber: pkg.packageNumber,
          organizationId: ctx.organizationId,
        });

        return pkg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error finalizing evidence package", error, {
          packageId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to finalize evidence package",
        });
      }
    }),

  // ─── Submit ───────────────────────────────────────────────────────────────

  submit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        lawEnforcementRef: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.prisma.evidencePackage.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            status: "finalized",
          },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Finalized evidence package not found",
          });
        }

        const pkg = await ctx.prisma.evidencePackage.update({
          where: { id: input.id },
          data: {
            status: "submitted",
            submittedAt: new Date(),
            ...(input.lawEnforcementRef && {
              lawEnforcementRef: input.lawEnforcementRef,
            }),
            ...(input.notes && { notes: input.notes }),
          },
        });

        logger.info("Evidence package submitted to law enforcement", {
          packageId: input.id,
          packageNumber: pkg.packageNumber,
          lawEnforcementRef: input.lawEnforcementRef,
          organizationId: ctx.organizationId,
        });

        return pkg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("Error submitting evidence package", error, {
          packageId: input.id,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit evidence package",
        });
      }
    }),
});
