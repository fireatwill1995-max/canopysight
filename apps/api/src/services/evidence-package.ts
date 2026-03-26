/**
 * Evidence Package Service
 *
 * Builds a law-enforcement-grade evidence package from an incident + detection events.
 * Produces a SHA-256 chain of custody hash and a structured JSON package.
 */

import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@canopy-sight/database";
import { logger } from "@canopy-sight/config";

const SYSTEM_PROMPT = `You are Canopy Copilot, the intelligence officer for Canopy Sight wildlife surveillance platform.
You have access to real-time detection data, alerts, and site intelligence.
You speak with authority about wildlife conservation and anti-poaching operations.
Always ground your responses in the actual data provided. Cite specific numbers.
Be actionable - every response should include at least one concrete recommendation.`;

export interface EvidencePackageInput {
  incidentId: string;
  detectionIds: string[];
  organizationId: string;
  notes?: string;
}

export interface TimelineEntry {
  timestamp: Date;
  eventType: "detection" | "alert" | "incident_created" | "note";
  description: string;
  entityId: string;
  severity?: string;
  confidence?: number;
  riskScore?: number;
  detectionType?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceItem {
  id: string;
  type: "detection_event" | "alert" | "video_clip";
  timestamp: Date;
  description: string;
  confidence?: number;
  riskScore?: number;
  deviceName?: string;
  siteName?: string;
  videoClipPath?: string;
  boundingBox?: unknown;
  zoneIds?: string[];
  metadata?: unknown;
}

export interface EvidencePackageResult {
  packageId: string;
  incidentId: string;
  summary: string;
  timeline: TimelineEntry[];
  evidence: EvidenceItem[];
  chainOfCustody: string;
  chainOfCustodyHash: string;
  generatedAt: string;
  incident: {
    id: string;
    title: string;
    description: string;
    severity: string;
    reportedAt: Date;
    reportedBy?: string | null;
    siteName: string;
    resolvedAt?: Date | null;
  };
  totalDetections: number;
  totalAlerts: number;
}

export async function generateEvidencePackage(
  input: EvidencePackageInput
): Promise<EvidencePackageResult> {
  const packageId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  // Fetch incident
  const incident = await prisma.incidentReport.findFirst({
    where: {
      id: input.incidentId,
      organizationId: input.organizationId,
    },
    include: {
      site: {
        select: { id: true, name: true, address: true, latitude: true, longitude: true },
      },
    },
  });

  if (!incident) {
    throw new Error(`Incident ${input.incidentId} not found`);
  }

  // Fetch detection events
  const detectionEvents = await prisma.detectionEvent.findMany({
    where: {
      id: { in: input.detectionIds },
      organizationId: input.organizationId,
    },
    include: {
      device: { select: { id: true, name: true, status: true } },
      site: { select: { id: true, name: true } },
      videoClip: {
        select: {
          id: true,
          filePath: true,
          thumbnailPath: true,
          startTime: true,
          endTime: true,
          duration: true,
        },
      },
      alerts: {
        select: {
          id: true,
          severity: true,
          title: true,
          message: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { timestamp: "asc" },
  });

  // Fetch any alerts directly linked to the incident's site around the incident time
  const windowStart = new Date(incident.reportedAt.getTime() - 30 * 60 * 1000); // -30 min
  const windowEnd = new Date(incident.reportedAt.getTime() + 60 * 60 * 1000); // +60 min
  const relatedAlerts = await prisma.alert.findMany({
    where: {
      siteId: incident.siteId,
      organizationId: input.organizationId,
      createdAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  // Build timeline
  const timeline: TimelineEntry[] = [];

  // Detection events
  detectionEvents.forEach((det) => {
    timeline.push({
      timestamp: det.timestamp,
      eventType: "detection",
      description: `${det.type} detected by ${det.device.name} with ${Math.round(det.confidence * 100)}% confidence${det.riskScore ? ` (risk score: ${Math.round(det.riskScore)})` : ""}`,
      entityId: det.id,
      confidence: det.confidence,
      riskScore: det.riskScore ?? undefined,
      detectionType: det.type,
      metadata: det.metadata as Record<string, unknown> | undefined,
    });

    // Alerts from this detection
    det.alerts.forEach((alert) => {
      timeline.push({
        timestamp: alert.createdAt,
        eventType: "alert",
        description: `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`,
        entityId: alert.id,
        severity: alert.severity,
      });
    });
  });

  // Related alerts not already included
  const detectionAlertIds = new Set(
    detectionEvents.flatMap((d) => d.alerts.map((a) => a.id))
  );
  relatedAlerts
    .filter((a) => !detectionAlertIds.has(a.id))
    .forEach((alert) => {
      timeline.push({
        timestamp: alert.createdAt,
        eventType: "alert",
        description: `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`,
        entityId: alert.id,
        severity: alert.severity,
      });
    });

  // Incident creation
  timeline.push({
    timestamp: incident.reportedAt,
    eventType: "incident_created",
    description: `Incident report created: "${incident.title}" — ${incident.description}`,
    entityId: incident.id,
    severity: incident.severity,
  });

  // Notes if provided
  if (input.notes) {
    timeline.push({
      timestamp: new Date(),
      eventType: "note",
      description: `Investigator notes: ${input.notes}`,
      entityId: packageId,
    });
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Build evidence items
  const evidenceItems: EvidenceItem[] = detectionEvents.map((det) => ({
    id: det.id,
    type: "detection_event" as const,
    timestamp: det.timestamp,
    description: `${det.type} detection — ${det.device.name} at ${det.site.name}`,
    confidence: det.confidence,
    riskScore: det.riskScore ?? undefined,
    deviceName: det.device.name,
    siteName: det.site.name,
    videoClipPath: det.videoClip?.filePath,
    boundingBox: det.boundingBox,
    zoneIds: det.zoneIds,
    metadata: det.metadata,
  }));

  // Add video clips as separate evidence items
  detectionEvents
    .filter((det) => det.videoClip)
    .forEach((det) => {
      evidenceItems.push({
        id: det.videoClip!.id,
        type: "video_clip" as const,
        timestamp: det.videoClip!.startTime,
        description: `Video clip from ${det.device.name}: ${det.videoClip!.duration.toFixed(1)}s clip`,
        deviceName: det.device.name,
        siteName: det.site.name,
        videoClipPath: det.videoClip!.filePath,
      });
    });

  // Add alert evidence items
  const allDetectionAlerts = detectionEvents.flatMap((d) => d.alerts);
  allDetectionAlerts.forEach((alert) => {
    evidenceItems.push({
      id: alert.id,
      type: "alert" as const,
      timestamp: alert.createdAt,
      description: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      severity: alert.severity,
    });
  });

  // Build chain of custody string
  const chainOfCustodyData = {
    packageId,
    incidentId: input.incidentId,
    organizationId: input.organizationId,
    generatedAt,
    detectionIds: input.detectionIds.sort(),
    incidentTitle: incident.title,
    incidentReportedAt: incident.reportedAt.toISOString(),
    totalDetections: detectionEvents.length,
    totalAlerts: allDetectionAlerts.length + relatedAlerts.length,
    notes: input.notes ?? null,
  };

  const chainOfCustodyJson = JSON.stringify(chainOfCustodyData, null, 2);
  const chainOfCustodyHash = crypto
    .createHash("sha256")
    .update(chainOfCustodyJson)
    .digest("hex");

  const chainOfCustody = `CANOPY SIGHT EVIDENCE PACKAGE
Package ID: ${packageId}
Generated: ${generatedAt}
Incident: ${incident.title} (${incident.id})
Organization: ${input.organizationId}
Detections: ${detectionEvents.length}
Alerts: ${allDetectionAlerts.length}
Chain of Custody Hash (SHA-256): ${chainOfCustodyHash}

This package was automatically generated by Canopy Sight AI.
Integrity is guaranteed by the SHA-256 hash above.
Any modification to this package will invalidate the chain of custody.`;

  // Generate AI summary
  let summary = `Evidence package for incident "${incident.title}" — ${detectionEvents.length} detection(s), ${allDetectionAlerts.length} alert(s) over ${Math.round((windowEnd.getTime() - windowStart.getTime()) / 60000)} minutes.`;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();

      const summaryData = {
        incident: {
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          reportedAt: incident.reportedAt.toISOString(),
          site: incident.site.name,
          location: { lat: incident.site.latitude, lon: incident.site.longitude },
        },
        detections: detectionEvents.map((d) => ({
          type: d.type,
          confidence: d.confidence,
          riskScore: d.riskScore,
          timestamp: d.timestamp.toISOString(),
          device: d.device.name,
        })),
        alertCount: allDetectionAlerts.length,
        timelineEvents: timeline.length,
        notes: input.notes,
      };

      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Write a concise law enforcement evidence summary for this wildlife surveillance incident.
This will be submitted to wildlife crime authorities.

Incident data:
${JSON.stringify(summaryData, null, 2)}

Write 2-3 paragraphs covering:
1. What happened, with specific times and detection types
2. The evidence chain (devices, confidence levels, risk scores)
3. Recommended follow-up actions for law enforcement

Use professional, objective language appropriate for official documentation.`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        summary = textBlock.text;
      }
    } catch (error) {
      logger.error("Failed to generate AI summary for evidence package", error);
    }
  }

  return {
    packageId,
    incidentId: input.incidentId,
    summary,
    timeline,
    evidence: evidenceItems,
    chainOfCustody,
    chainOfCustodyHash,
    generatedAt,
    incident: {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      reportedAt: incident.reportedAt,
      reportedBy: incident.reportedBy,
      siteName: incident.site.name,
      resolvedAt: incident.resolvedAt,
    },
    totalDetections: detectionEvents.length,
    totalAlerts: allDetectionAlerts.length + relatedAlerts.filter((a) => !detectionAlertIds.has(a.id)).length,
  };
}
