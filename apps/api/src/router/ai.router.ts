/**
 * AI Router — Canopy Copilot tRPC endpoints
 *
 * Wires the existing (but previously dead-code) AI agents to live API procedures.
 * All procedures are protectedProcedure (require valid org/user context).
 *
 * Procedures:
 *   chat                  — accumulate-stream chat with Canopy Copilot
 *   analyzeDetection      — deep analysis of a single detection event
 *   generateShiftBrief    — AI-powered shift handover briefing
 *   generateEvidencePackage — law enforcement evidence package
 *   analyzeThreatLevel    — current site threat score (0-100)
 *   suggestPatrolRoutes   — AI patrol recommendations
 *   naturalLanguageQuery  — ask questions in plain English
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@canopy-sight/config";
import Anthropic from "@anthropic-ai/sdk";
import { generateShiftBriefing } from "../services/shift-briefing";
import { generateEvidencePackage } from "../services/evidence-package";

// ── Constants ────────────────────────────────────────────────────────

const CANOPY_COPILOT_SYSTEM_PROMPT = `You are Canopy Copilot, the intelligence officer for Canopy Sight wildlife surveillance platform.
You have access to real-time detection data, alerts, and site intelligence.
You speak with authority about wildlife conservation and anti-poaching operations.
Always ground your responses in the actual data provided. Cite specific numbers.
Be actionable - every response should include at least one concrete recommendation.
Keep responses focused and professional. Use markdown formatting where appropriate.`;

// Graceful Claude client — returns null if API key missing
function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a context string from live DB data for grounding Claude responses.
 */
async function buildSiteContext(
  prisma: Parameters<Parameters<typeof protectedProcedure["query"]>[0]>[0]["ctx"]["prisma"],
  organizationId: string,
  siteId?: string
): Promise<string> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [recentAlerts, detectionStats, deviceCount] = await Promise.all([
    prisma.alert.findMany({
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
        status: { in: ["active", "acknowledged"] },
        createdAt: { gte: last24h },
      },
      select: {
        severity: true,
        title: true,
        message: true,
        createdAt: true,
        site: { select: { name: true } },
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),

    prisma.detectionEvent.groupBy({
      by: ["type"],
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
        timestamp: { gte: last24h },
      },
      _count: { id: true },
      _avg: { riskScore: true },
    }),

    prisma.device.count({
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
        status: "online",
      },
    }),
  ]);

  const totalDetections = detectionStats.reduce((s, g) => s + g._count.id, 0);
  const criticalCount = recentAlerts.filter((a) => a.severity === "critical").length;

  const detectionSummary = detectionStats
    .map((g) => `${g.type}: ${g._count.id} (avg risk: ${Math.round(g._avg.riskScore ?? 0)})`)
    .join(", ");

  const alertSummary = recentAlerts
    .slice(0, 5)
    .map((a) => `[${a.severity.toUpperCase()}] ${a.title}`)
    .join("; ");

  return `LIVE SITE DATA (last 24 hours):
- Total detections: ${totalDetections}
- Detection breakdown: ${detectionSummary || "none"}
- Active/acknowledged alerts: ${recentAlerts.length} (${criticalCount} critical)
- Recent alerts: ${alertSummary || "none"}
- Online devices: ${deviceCount}
- Data timestamp: ${now.toISOString()}`;
}

// ── Router ───────────────────────────────────────────────────────────

export const aiRouter = router({
  /**
   * chat — Streaming-style chat with Canopy Copilot
   * Accumulates the full Claude stream and returns complete text.
   * For true token-streaming use the raw Express /ai/stream endpoint.
   */
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(4000),
        siteId: z.string().optional(),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Build live context from DB
        const liveContext = await buildSiteContext(
          ctx.prisma,
          ctx.organizationId,
          input.siteId
        );

        const userContent = input.context
          ? `${input.message}\n\nAdditional context: ${input.context}\n\n${liveContext}`
          : `${input.message}\n\n${liveContext}`;

        const client = getAnthropicClient();

        if (!client) {
          // Demo mode — return a helpful mock response
          logger.warn("ANTHROPIC_API_KEY not set — returning demo chat response");
          return {
            response: `[Canopy Copilot — Demo Mode]\n\nYou asked: "${input.message}"\n\n${liveContext}\n\nTo enable real AI responses, set the ANTHROPIC_API_KEY environment variable.`,
            model: "demo",
            inputTokens: 0,
            outputTokens: 0,
          };
        }

        // Stream and accumulate full text
        const stream = client.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: 2048,
          system: CANOPY_COPILOT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        });

        const message = await stream.finalMessage();
        const textContent = message.content.find((b) => b.type === "text");
        const responseText =
          textContent?.type === "text"
            ? textContent.text
            : "No response generated.";

        logger.info("Canopy Copilot chat completed", {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        });

        return {
          response: responseText,
          model: message.model,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        };
      } catch (error) {
        logger.error("Canopy Copilot chat error", error, {
          organizationId: ctx.organizationId,
        });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to process chat request",
        });
      }
    }),

  /**
   * analyzeDetection — Deep analysis of a single detection event
   * Returns classification, risk level, species info, and recommendations.
   */
  analyzeDetection: protectedProcedure
    .input(z.object({ detectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const detection = await ctx.prisma.detectionEvent.findFirst({
          where: {
            id: input.detectionId,
            organizationId: ctx.organizationId,
          },
          include: {
            device: { select: { id: true, name: true, status: true } },
            site: { select: { id: true, name: true, address: true } },
            videoClip: {
              select: { filePath: true, duration: true, startTime: true },
            },
            alerts: {
              select: { severity: true, title: true, status: true },
              take: 5,
            },
            riskScores: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        if (!detection) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Detection event not found",
          });
        }

        // Fast deterministic classification
        const riskScore = detection.riskScore ?? 0;
        const riskLevel: "low" | "medium" | "high" | "critical" =
          riskScore >= 75
            ? "critical"
            : riskScore >= 50
              ? "high"
              : riskScore >= 25
                ? "medium"
                : "low";

        const baseResult = {
          detectionId: detection.id,
          classification: detection.type,
          riskLevel,
          riskScore: Math.round(riskScore),
          confidence: detection.confidence,
          timestamp: detection.timestamp,
          site: detection.site.name,
          device: detection.device.name,
          hasVideoEvidence: !!detection.videoClip,
          linkedAlerts: detection.alerts.length,
        };

        const client = getAnthropicClient();

        if (!client) {
          return {
            ...baseResult,
            species: null,
            behavior: null,
            recommendations: [
              `${riskLevel === "critical" || riskLevel === "high" ? "Immediately dispatch ranger to investigate" : "Schedule zone inspection"}`,
              "Review associated video clip if available",
              "Cross-reference with recent patrol logs",
            ],
            aiSummary: `[Demo Mode] ${detection.type} detected with ${Math.round(detection.confidence * 100)}% confidence. Risk score: ${Math.round(riskScore)}/100.`,
          };
        }

        const analysisPrompt = `Analyze this wildlife detection event and provide expert assessment.

Detection Data:
- Type: ${detection.type}
- Confidence: ${Math.round(detection.confidence * 100)}%
- Risk Score: ${Math.round(riskScore)}/100
- Timestamp: ${detection.timestamp.toISOString()}
- Site: ${detection.site.name}
- Device: ${detection.device.name}
- Bounding Box: ${JSON.stringify(detection.boundingBox)}
- Zone IDs: ${JSON.stringify(detection.zoneIds)}
- Associated Alerts: ${JSON.stringify(detection.alerts)}
${detection.metadata ? `- Metadata: ${JSON.stringify(detection.metadata)}` : ""}

Respond with a JSON object containing:
{
  "species": "identified species or null if unknown",
  "behavior": "observed behavior description or null",
  "recommendations": ["action1", "action2", "action3"],
  "aiSummary": "2-3 sentence expert assessment",
  "urgencyFlag": true/false,
  "escalateTo": "authority level to escalate to if needed, or null"
}

Respond ONLY with valid JSON.`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: CANOPY_COPILOT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: analysisPrompt }],
        });

        const textBlock = message.content.find((b) => b.type === "text");
        let aiResult: {
          species: string | null;
          behavior: string | null;
          recommendations: string[];
          aiSummary: string;
          urgencyFlag?: boolean;
          escalateTo?: string | null;
        } = {
          species: null,
          behavior: null,
          recommendations: [
            `Investigate ${detection.type} detection at ${detection.site.name}`,
            "Review video evidence if available",
            "Update incident log",
          ],
          aiSummary: `${detection.type} detected with ${Math.round(detection.confidence * 100)}% confidence at ${detection.site.name}.`,
        };

        if (textBlock?.type === "text") {
          try {
            // Strip potential markdown code fence
            const raw = textBlock.text.replace(/```(?:json)?\n?/g, "").trim();
            aiResult = JSON.parse(raw);
          } catch {
            logger.warn("Failed to parse detection analysis JSON response");
          }
        }

        return {
          ...baseResult,
          species: aiResult.species,
          behavior: aiResult.behavior,
          recommendations: aiResult.recommendations,
          aiSummary: aiResult.aiSummary,
          urgencyFlag: aiResult.urgencyFlag ?? (riskLevel === "critical"),
          escalateTo: aiResult.escalateTo ?? null,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("analyzeDetection error", error, {
          detectionId: input.detectionId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze detection event",
        });
      }
    }),

  /**
   * generateShiftBrief — AI shift handover briefing
   * Queries real DB data and generates both structured data and natural language.
   */
  generateShiftBrief: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        shiftStartTime: z.string(), // ISO date string
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const brief = await generateShiftBriefing({
          siteId: input.siteId,
          organizationId: ctx.organizationId,
          shiftStartTime: input.shiftStartTime,
        });

        logger.info("Shift brief generated", {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
          shiftStartTime: input.shiftStartTime,
        });

        return brief;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("generateShiftBrief error", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate shift briefing",
        });
      }
    }),

  /**
   * generateEvidencePackage — Law enforcement evidence package
   * Fetches all related data, produces structured package + SHA-256 chain of custody.
   */
  generateEvidencePackage: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
        detectionIds: z.array(z.string()).min(0).max(100),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const pkg = await generateEvidencePackage({
          incidentId: input.incidentId,
          detectionIds: input.detectionIds,
          organizationId: ctx.organizationId,
          notes: input.notes,
        });

        logger.info("Evidence package generated", {
          packageId: pkg.packageId,
          incidentId: input.incidentId,
          organizationId: ctx.organizationId,
          detectionCount: pkg.totalDetections,
        });

        return pkg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("not found")) {
          throw new TRPCError({ code: "NOT_FOUND", message: msg });
        }
        logger.error("generateEvidencePackage error", error, {
          incidentId: input.incidentId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate evidence package",
        });
      }
    }),

  /**
   * analyzeThreatLevel — Current site threat assessment (0-100)
   * Scores the site based on recent detection and alert data via Claude.
   */
  analyzeThreatLevel: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const last6h = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const [
          recentDetections6h,
          recentDetections24h,
          previousDetections24h,
          activeAlerts,
          criticalAlerts24h,
          zones,
        ] = await Promise.all([
          ctx.prisma.detectionEvent.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              timestamp: { gte: last6h },
            },
            select: { type: true, riskScore: true, confidence: true, timestamp: true },
            orderBy: { timestamp: "desc" },
            take: 200,
          }),

          ctx.prisma.detectionEvent.count({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              timestamp: { gte: last24h },
            },
          }),

          ctx.prisma.detectionEvent.count({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              timestamp: { gte: last48h, lte: last24h },
            },
          }),

          ctx.prisma.alert.count({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              status: "active",
            },
          }),

          ctx.prisma.alert.count({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              severity: "critical",
              createdAt: { gte: last24h },
            },
          }),

          ctx.prisma.detectionZone.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              isActive: true,
            },
            select: { id: true, name: true, type: true },
          }),
        ]);

        // Compute deterministic base score
        const avgRisk =
          recentDetections6h.length > 0
            ? recentDetections6h.reduce(
                (s, d) => s + (d.riskScore ?? 0),
                0
              ) / recentDetections6h.length
            : 0;

        const trendRatio =
          previousDetections24h > 0
            ? recentDetections24h / previousDetections24h
            : recentDetections24h > 0
              ? 2
              : 1;

        const trend: "rising" | "falling" | "stable" =
          trendRatio > 1.25
            ? "rising"
            : trendRatio < 0.75
              ? "falling"
              : "stable";

        // Weighted factor scoring
        const factors = [
          {
            name: "Recent detection frequency",
            score: Math.min(100, recentDetections6h.length * 5),
            weight: 0.25,
            description: `${recentDetections6h.length} detections in the last 6 hours`,
          },
          {
            name: "Average risk score",
            score: Math.round(avgRisk),
            weight: 0.3,
            description: `Average risk score of ${Math.round(avgRisk)}/100 for recent detections`,
          },
          {
            name: "Active alerts",
            score: Math.min(100, activeAlerts * 20),
            weight: 0.25,
            description: `${activeAlerts} active alert(s), ${criticalAlerts24h} critical in last 24h`,
          },
          {
            name: "Detection trend",
            score:
              trend === "rising" ? 75 : trend === "stable" ? 40 : 15,
            weight: 0.2,
            description: `Detection volume is ${trend} (${recentDetections24h} today vs ${previousDetections24h} yesterday)`,
          },
        ];

        const overallScore = Math.round(
          factors.reduce((s, f) => s + f.score * f.weight, 0)
        );

        const topRisks: string[] = [];
        if (criticalAlerts24h > 0)
          topRisks.push(
            `${criticalAlerts24h} critical alert(s) in the last 24 hours`
          );
        if (trend === "rising")
          topRisks.push(
            `Detection volume rising — ${recentDetections24h} today vs ${previousDetections24h} yesterday`
          );

        const highRiskTypes = recentDetections6h
          .filter((d) => (d.riskScore ?? 0) > 70)
          .reduce((acc: Record<string, number>, d) => {
            acc[d.type] = (acc[d.type] ?? 0) + 1;
            return acc;
          }, {});
        Object.entries(highRiskTypes).forEach(([type, count]) => {
          topRisks.push(`${count} high-risk ${type} detection(s) in last 6h`);
        });

        if (zones.some((z) => z.type === "exclusion"))
          topRisks.push("Active exclusion zones detected");

        // Optional AI narrative
        let aiAssessment: string | undefined;
        const client = getAnthropicClient();

        if (client) {
          try {
            const message = await client.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 512,
              system: CANOPY_COPILOT_SYSTEM_PROMPT,
              messages: [
                {
                  role: "user",
                  content: `Provide a 2-sentence threat level assessment for this wildlife site.

Threat Score: ${overallScore}/100 (${trend})
Factors: ${factors.map((f) => `${f.name}: ${f.score}`).join(", ")}
Top Risks: ${topRisks.join("; ")}

Be specific, authoritative, and actionable.`,
                },
              ],
            });
            const textBlock = message.content.find((b) => b.type === "text");
            if (textBlock?.type === "text") {
              aiAssessment = textBlock.text;
            }
          } catch (error) {
            logger.warn("Failed to generate AI threat assessment narrative", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          overallScore,
          factors,
          trend,
          topRisks: topRisks.slice(0, 5),
          activeAlerts,
          recentDetections: recentDetections6h.length,
          aiAssessment: aiAssessment ?? null,
          calculatedAt: now.toISOString(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("analyzeThreatLevel error", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze threat level",
        });
      }
    }),

  /**
   * suggestPatrolRoutes — AI-generated patrol recommendations
   * Analyzes detection hotspots and zone coverage to recommend patrol routes.
   */
  suggestPatrolRoutes: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        rangerCount: z.number().min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [zones, recentDetections, activeAlerts, site] = await Promise.all([
          ctx.prisma.detectionZone.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              type: true,
              sensitivity: true,
              points: true,
            },
          }),

          ctx.prisma.detectionEvent.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              timestamp: { gte: last24h },
            },
            select: { type: true, riskScore: true, zoneIds: true, timestamp: true },
            orderBy: { timestamp: "desc" },
            take: 300,
          }),

          ctx.prisma.alert.findMany({
            where: {
              siteId: input.siteId,
              organizationId: ctx.organizationId,
              status: "active",
            },
            select: { severity: true, title: true, message: true },
            take: 20,
          }),

          ctx.prisma.site.findFirst({
            where: {
              id: input.siteId,
              organizationId: ctx.organizationId,
            },
            select: { name: true, address: true, latitude: true, longitude: true },
          }),
        ]);

        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        // Score zones by detection density
        const zoneHeatmap = new Map<string, { count: number; riskSum: number }>();
        recentDetections.forEach((det) => {
          if (Array.isArray(det.zoneIds)) {
            det.zoneIds.forEach((zid: string) => {
              const entry = zoneHeatmap.get(zid) ?? { count: 0, riskSum: 0 };
              entry.count += 1;
              entry.riskSum += det.riskScore ?? 0;
              zoneHeatmap.set(zid, entry);
            });
          }
        });

        const priorityZones = zones
          .map((zone) => {
            const heat = zoneHeatmap.get(zone.id);
            return {
              zoneId: zone.id,
              zoneName: zone.name,
              zoneType: zone.type,
              sensitivity: zone.sensitivity,
              detectionCount: heat?.count ?? 0,
              avgRiskScore:
                heat && heat.count > 0
                  ? Math.round(heat.riskSum / heat.count)
                  : 0,
              priority:
                zone.type === "exclusion"
                  ? "high"
                  : zone.type === "crossing"
                    ? "medium"
                    : "low",
            };
          })
          .sort(
            (a, b) =>
              b.detectionCount * 2 +
              b.avgRiskScore -
              (a.detectionCount * 2 + a.avgRiskScore)
          );

        // Deterministic route assignment — distribute zones across rangers
        const routes: Array<{
          rangerIndex: number;
          zones: typeof priorityZones;
          estimatedDurationMinutes: number;
          priority: "high" | "medium" | "low";
        }> = [];

        for (let i = 0; i < input.rangerCount; i++) {
          const rangerZones = priorityZones.filter(
            (_, idx) => idx % input.rangerCount === i
          );
          routes.push({
            rangerIndex: i + 1,
            zones: rangerZones,
            estimatedDurationMinutes: rangerZones.length * 15,
            priority: rangerZones.some((z) => z.priority === "high")
              ? "high"
              : rangerZones.some((z) => z.priority === "medium")
                ? "medium"
                : "low",
          });
        }

        // AI reasoning
        let reasoning =
          `${input.rangerCount} ranger(s) assigned to ${zones.length} zone(s). ` +
          `${recentDetections.length} detections in last 24h. ` +
          `Focus on ${priorityZones.slice(0, 3).map((z) => z.zoneName).join(", ") || "all active zones"}.`;

        const client = getAnthropicClient();
        if (client) {
          try {
            const message = await client.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 600,
              system: CANOPY_COPILOT_SYSTEM_PROMPT,
              messages: [
                {
                  role: "user",
                  content: `Generate patrol route recommendations for ${input.rangerCount} ranger(s) at ${site.name}.

Site data:
- Active zones: ${zones.map((z) => `${z.name} (${z.type})`).join(", ")}
- Recent detections (24h): ${recentDetections.length}
- Active alerts: ${activeAlerts.length}
- Priority zones by detection density: ${priorityZones.slice(0, 5).map((z) => `${z.zoneName}: ${z.detectionCount} detections`).join(", ")}

Write 2-3 sentences explaining the patrol strategy: which zones to prioritize, why, and any tactical considerations.
Be specific with zone names and detection numbers.`,
                },
              ],
            });
            const textBlock = message.content.find((b) => b.type === "text");
            if (textBlock?.type === "text") {
              reasoning = textBlock.text;
            }
          } catch (error) {
            logger.warn("Failed to generate AI patrol route reasoning", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          routes,
          priorityZones: priorityZones.slice(0, 10),
          reasoning,
          totalZones: zones.length,
          rangerCount: input.rangerCount,
          basedOnDetections: recentDetections.length,
          generatedAt: now.toISOString(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("suggestPatrolRoutes error", error, {
          siteId: input.siteId,
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate patrol route suggestions",
        });
      }
    }),

  /**
   * naturalLanguageQuery — Ask questions about site data in plain English
   * Uses Claude to interpret the question, queries the DB, and returns an answer.
   */
  naturalLanguageQuery: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(2000),
        siteId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Fetch a broad context snapshot to ground Claude's answer
        const [
          totalDetections,
          detectionsByType,
          recentAlerts,
          openIncidents,
          deviceStatuses,
          topRiskDetections,
        ] = await Promise.all([
          ctx.prisma.detectionEvent.count({
            where: {
              organizationId: ctx.organizationId,
              ...(input.siteId ? { siteId: input.siteId } : {}),
              timestamp: { gte: last7days },
            },
          }),

          ctx.prisma.detectionEvent.groupBy({
            by: ["type"],
            where: {
              organizationId: ctx.organizationId,
              ...(input.siteId ? { siteId: input.siteId } : {}),
              timestamp: { gte: last7days },
            },
            _count: { id: true },
            _avg: { riskScore: true },
          }),

          ctx.prisma.alert.findMany({
            where: {
              organizationId: ctx.organizationId,
              ...(input.siteId ? { siteId: input.siteId } : {}),
              status: { in: ["active", "acknowledged"] },
            },
            select: {
              severity: true,
              title: true,
              message: true,
              createdAt: true,
              site: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 15,
          }),

          ctx.prisma.incidentReport.findMany({
            where: {
              organizationId: ctx.organizationId,
              ...(input.siteId ? { siteId: input.siteId } : {}),
              resolvedAt: null,
            },
            select: {
              title: true,
              severity: true,
              reportedAt: true,
              site: { select: { name: true } },
            },
            orderBy: { reportedAt: "desc" },
            take: 10,
          }),

          ctx.prisma.device.groupBy({
            by: ["status"],
            where: {
              organizationId: ctx.organizationId,
              ...(input.siteId ? { siteId: input.siteId } : {}),
            },
            _count: { id: true },
          }),

          ctx.prisma.detectionEvent.findMany({
            where: {
              organizationId: ctx.organizationId,
              ...(input.siteId ? { siteId: input.siteId } : {}),
              riskScore: { gte: 70 },
              timestamp: { gte: last7days },
            },
            select: {
              type: true,
              riskScore: true,
              timestamp: true,
              site: { select: { name: true } },
            },
            orderBy: { riskScore: "desc" },
            take: 10,
          }),
        ]);

        const dataContext = {
          queryPeriod: "last 7 days",
          totalDetections,
          detectionsByType: detectionsByType.map((g) => ({
            type: g.type,
            count: g._count.id,
            avgRisk: Math.round(g._avg.riskScore ?? 0),
          })),
          activeAlerts: recentAlerts.length,
          alertsBySeverity: {
            critical: recentAlerts.filter((a) => a.severity === "critical").length,
            warning: recentAlerts.filter((a) => a.severity === "warning").length,
            advisory: recentAlerts.filter((a) => a.severity === "advisory").length,
          },
          recentAlerts: recentAlerts.slice(0, 5).map((a) => ({
            severity: a.severity,
            title: a.title,
            site: a.site.name,
            when: a.createdAt,
          })),
          openIncidents: openIncidents.length,
          incidentSummary: openIncidents.slice(0, 3).map((i) => ({
            title: i.title,
            severity: i.severity,
            site: i.site.name,
            reportedAt: i.reportedAt,
          })),
          deviceStatuses: deviceStatuses.reduce(
            (acc: Record<string, number>, g) => {
              acc[g.status] = g._count.id;
              return acc;
            },
            {}
          ),
          highRiskDetections: topRiskDetections.map((d) => ({
            type: d.type,
            riskScore: d.riskScore,
            site: d.site.name,
            when: d.timestamp,
          })),
        };

        const client = getAnthropicClient();

        if (!client) {
          return {
            answer: `[Demo Mode] You asked: "${input.query}"\n\nHere is the raw data I found:\n${JSON.stringify(dataContext, null, 2)}\n\nSet ANTHROPIC_API_KEY to get natural language answers.`,
            data: dataContext,
            confidence: 0.5,
          };
        }

        const message = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: CANOPY_COPILOT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Answer this question about our wildlife surveillance site data:

"${input.query}"

Here is the current data (${input.siteId ? `filtered to specific site` : "all sites"}):
${JSON.stringify(dataContext, null, 2)}

Provide a direct, specific answer using the actual numbers from the data.
If the question cannot be answered from this data, say so clearly and explain what additional data would be needed.
Keep your answer focused and actionable.`,
            },
          ],
        });

        const textBlock = message.content.find((b) => b.type === "text");
        const answer =
          textBlock?.type === "text"
            ? textBlock.text
            : "Unable to generate answer from available data.";

        // Simple confidence heuristic based on data availability
        const confidence =
          totalDetections > 0
            ? Math.min(0.95, 0.6 + Math.min(0.35, totalDetections / 1000))
            : 0.3;

        logger.info("Natural language query processed", {
          organizationId: ctx.organizationId,
          siteId: input.siteId,
          queryLength: input.query.length,
        });

        return {
          answer,
          data: dataContext,
          confidence: Math.round(confidence * 100) / 100,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error("naturalLanguageQuery error", error, {
          organizationId: ctx.organizationId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process natural language query",
        });
      }
    }),
});
