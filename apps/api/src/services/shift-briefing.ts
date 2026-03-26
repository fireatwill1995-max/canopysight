/**
 * Shift Briefing Service
 *
 * Queries live DB data for a site and generates an AI-powered shift handover brief.
 * Used by the ai.router generateShiftBrief procedure.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

const SYSTEM_PROMPT = `You are Canopy Copilot, the intelligence officer for Canopy Sight wildlife surveillance platform.
You have access to real-time detection data, alerts, and site intelligence.
You speak with authority about wildlife conservation and anti-poaching operations.
Always ground your responses in the actual data provided. Cite specific numbers.
Be actionable - every response should include at least one concrete recommendation.`;

export interface ShiftBriefingInput {
  siteId: string;
  organizationId: string;
  shiftStartTime: string; // ISO date string
}

export interface ShiftBriefingResult {
  summary: string;
  criticalAlerts: Array<{
    id: string;
    title: string;
    severity: string;
    message: string;
    createdAt: Date;
  }>;
  topThreats: Array<{
    type: string;
    count: number;
    avgRiskScore: number;
    lastSeen: Date;
  }>;
  recommendedPatrolAreas: Array<{
    zoneId: string;
    zoneName: string;
    detectionCount: number;
    reason: string;
  }>;
  speciesSightings: Array<{
    type: string;
    count: number;
    confidence: number;
  }>;
  deviceHealthSummary: {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    devicesWithIssues: string[];
  };
  generatedAt: string;
  shiftStartTime: string;
  naturalLanguageBrief: string;
}

export async function generateShiftBriefing(
  input: ShiftBriefingInput
): Promise<ShiftBriefingResult> {
  const shiftStart = new Date(input.shiftStartTime);
  const now = new Date();

  // Parallel fetch of all data needed for the brief
  const [
    criticalAlertsRaw,
    detectionsSinceShift,
    activeIncidents,
    devices,
    zones,
    recentDetectionsByType,
  ] = await Promise.all([
    // Critical and warning alerts since shift started (or last 24h if shift is old)
    prisma.alert.findMany({
      where: {
        siteId: input.siteId,
        organizationId: input.organizationId,
        severity: { in: ["critical", "warning"] },
        status: { in: ["active", "acknowledged"] },
        createdAt: { gte: shiftStart },
      },
      select: {
        id: true,
        title: true,
        severity: true,
        message: true,
        createdAt: true,
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),

    // All detections since shift start
    prisma.detectionEvent.findMany({
      where: {
        siteId: input.siteId,
        organizationId: input.organizationId,
        timestamp: { gte: shiftStart },
      },
      select: {
        id: true,
        type: true,
        confidence: true,
        riskScore: true,
        timestamp: true,
        zoneIds: true,
      },
      orderBy: { timestamp: "desc" },
      take: 500,
    }),

    // Active (unresolved) incidents
    prisma.incidentReport.findMany({
      where: {
        siteId: input.siteId,
        organizationId: input.organizationId,
        resolvedAt: null,
      },
      select: {
        id: true,
        title: true,
        severity: true,
        reportedAt: true,
        description: true,
      },
      orderBy: { reportedAt: "desc" },
      take: 10,
    }),

    // All devices at this site
    prisma.device.findMany({
      where: {
        siteId: input.siteId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        lastHeartbeat: true,
      },
    }),

    // All active zones at this site
    prisma.detectionZone.findMany({
      where: {
        siteId: input.siteId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),

    // Detections grouped by type for this site in last 24h
    prisma.detectionEvent.groupBy({
      by: ["type"],
      where: {
        siteId: input.siteId,
        organizationId: input.organizationId,
        timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
      _avg: { riskScore: true },
      _max: { timestamp: true },
    }),
  ]);

  // Build top threats (high risk detections by type)
  const topThreats = recentDetectionsByType
    .filter((g) => (g._avg.riskScore ?? 0) > 30 || g._count.id > 5)
    .sort((a, b) => (b._avg.riskScore ?? 0) - (a._avg.riskScore ?? 0))
    .slice(0, 5)
    .map((g) => ({
      type: g.type,
      count: g._count.id,
      avgRiskScore: Math.round(g._avg.riskScore ?? 0),
      lastSeen: g._max.timestamp ?? now,
    }));

  // Build recommended patrol areas based on detection density per zone
  const zoneCounts = new Map<string, number>();
  detectionsSinceShift.forEach((det) => {
    if (Array.isArray(det.zoneIds)) {
      det.zoneIds.forEach((zid: string) => {
        zoneCounts.set(zid, (zoneCounts.get(zid) ?? 0) + 1);
      });
    }
  });

  const recommendedPatrolAreas = zones
    .map((zone) => ({
      zoneId: zone.id,
      zoneName: zone.name,
      detectionCount: zoneCounts.get(zone.id) ?? 0,
      reason:
        (zoneCounts.get(zone.id) ?? 0) > 0
          ? `${zoneCounts.get(zone.id)} detection(s) since shift start`
          : "Scheduled patrol coverage",
    }))
    .sort((a, b) => b.detectionCount - a.detectionCount)
    .slice(0, 5);

  // Species sightings (detection types that are wildlife-related)
  const speciesSightings = detectionsSinceShift
    .reduce(
      (
        acc: Array<{ type: string; count: number; confidenceSum: number }>,
        det
      ) => {
        const existing = acc.find((s) => s.type === det.type);
        if (existing) {
          existing.count += 1;
          existing.confidenceSum += det.confidence;
        } else {
          acc.push({
            type: det.type,
            count: 1,
            confidenceSum: det.confidence,
          });
        }
        return acc;
      },
      []
    )
    .map((s) => ({
      type: s.type,
      count: s.count,
      confidence: Math.round((s.confidenceSum / s.count) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Device health summary
  const onlineDevices = devices.filter((d) => d.status === "online");
  const offlineDevices = devices.filter((d) => d.status === "offline");
  const devicesWithIssues = devices
    .filter((d) => d.status === "error" || d.status === "maintenance")
    .map((d) => d.name);

  const deviceHealthSummary = {
    totalDevices: devices.length,
    onlineDevices: onlineDevices.length,
    offlineDevices: offlineDevices.length,
    devicesWithIssues,
  };

  // Generate natural language brief via Claude
  let naturalLanguageBrief =
    "Shift briefing generated. Review the structured data above for details.";

  if (!process.env.ANTHROPIC_API_KEY) {
    naturalLanguageBrief = `[Demo Mode] Shift brief for shift starting ${shiftStart.toLocaleString()}:
${detectionsSinceShift.length} detection(s) recorded.
${criticalAlertsRaw.length} active alert(s) requiring attention.
${activeIncidents.length} unresolved incident(s).
Device health: ${onlineDevices.length}/${devices.length} online.
Top detection type: ${speciesSightings[0]?.type ?? "none"}.
Recommend prioritizing ${recommendedPatrolAreas[0]?.zoneName ?? "all zones"}.`;
  } else {
    try {
      const client = new Anthropic();

      const briefingData = {
        shiftStartTime: shiftStart.toISOString(),
        currentTime: now.toISOString(),
        totalDetections: detectionsSinceShift.length,
        criticalAlerts: criticalAlertsRaw.slice(0, 5),
        activeIncidents: activeIncidents.slice(0, 5),
        topThreats,
        deviceHealth: deviceHealthSummary,
        recommendedPatrolAreas: recommendedPatrolAreas.slice(0, 3),
        speciesSightings: speciesSightings.slice(0, 5),
      };

      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Generate a concise shift handover brief for a wildlife surveillance ranger.
Here is the data for this shift:

${JSON.stringify(briefingData, null, 2)}

Write a 3-5 paragraph professional briefing in plain English.
Include: what happened this shift, current alert status, recommended priorities, and any immediate actions needed.
Be specific - cite actual numbers from the data.`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        naturalLanguageBrief = textBlock.text;
      }
    } catch (error) {
      logger.error("Failed to generate AI narrative for shift brief", error);
      naturalLanguageBrief = `Shift brief for ${shiftStart.toLocaleString()}: ${detectionsSinceShift.length} detections, ${criticalAlertsRaw.length} active alerts. Device health: ${onlineDevices.length}/${devices.length} online.`;
    }
  }

  const result: ShiftBriefingResult = {
    summary: `Shift from ${shiftStart.toLocaleString()} — ${detectionsSinceShift.length} detections, ${criticalAlertsRaw.length} active alert(s), ${activeIncidents.length} open incident(s)`,
    criticalAlerts: criticalAlertsRaw,
    topThreats,
    recommendedPatrolAreas,
    speciesSightings,
    deviceHealthSummary,
    generatedAt: now.toISOString(),
    shiftStartTime: shiftStart.toISOString(),
    naturalLanguageBrief,
  };

  return result;
}
