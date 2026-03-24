/**
 * Detection Analyzer Agent - LangGraph multi-step detection classification
 *
 * Takes YOLO detection results (with optional SAM2 masks), classifies anomalies,
 * assesses risk, and generates actionable recommendations.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, END, START } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import type {
  DetectionAnalyzerState,
  DetectionInput,
  DetectionClassification,
  DetectionCategory,
  RiskAssessment,
  DetectionAnalysis,
} from "./types";

// ── LLM (lazy-loaded to avoid errors when ANTHROPIC_API_KEY is not set) ──

let _llm: ChatAnthropic | null = null;
function getLLM(): ChatAnthropic {
  if (!_llm) {
    _llm = new ChatAnthropic({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0.2,
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 4096,
    });
  }
  return _llm;
}

// ── Classification rules (deterministic fast path) ──────────────────

const THREAT_LABELS = new Set([
  "person",
  "trespasser",
  "intruder",
  "vehicle_unauthorized",
  "weapon",
  "fire",
  "smoke",
]);

const ANOMALY_LABELS = new Set([
  "debris",
  "obstruction",
  "damage",
  "unknown_object",
  "animal",
  "deformation",
  "leak",
]);

const NORMAL_LABELS = new Set([
  "train",
  "rail",
  "signal",
  "vehicle_authorized",
  "worker",
  "equipment",
  "vegetation",
]);

function classifyLabel(label: string, confidence: number): DetectionCategory {
  const normalized = label.toLowerCase().replace(/\s+/g, "_");
  if (THREAT_LABELS.has(normalized)) return "threat";
  if (ANOMALY_LABELS.has(normalized)) return "anomaly";
  if (NORMAL_LABELS.has(normalized)) return "normal";
  if (confidence < 0.4) return "unknown";
  return "unknown";
}

// ── Graph Nodes ─────────────────────────────────────────────────────

async function receiveDetections(
  state: DetectionAnalyzerState
): Promise<Partial<DetectionAnalyzerState>> {
  if (!state.detections || state.detections.length === 0) {
    return {
      messages: [...state.messages, "ERROR: No detections provided"],
      currentStep: "error",
    };
  }

  return {
    messages: [
      ...state.messages,
      `Received ${state.detections.length} detection(s) for analysis`,
    ],
    currentStep: "classify_anomalies",
  };
}

async function classifyAnomalies(
  state: DetectionAnalyzerState
): Promise<Partial<DetectionAnalyzerState>> {
  // Fast-path deterministic classification
  const fastClassifications: DetectionClassification[] = state.detections.map(
    (det) => ({
      detectionId: det.id,
      category: classifyLabel(det.label, det.confidence),
      subcategory: det.label,
      confidence: det.confidence,
      reasoning: "",
    })
  );

  // For unknown / low-confidence detections, ask the LLM
  const unknowns = fastClassifications.filter((c) => c.category === "unknown");

  if (unknowns.length > 0) {
    const unknownDetections = state.detections.filter((d) =>
      unknowns.some((u) => u.detectionId === d.id)
    );

    const prompt = `You are a rail safety detection classifier.
Classify each detection into one of: threat, anomaly, normal, unknown.
Provide a subcategory and brief reasoning.

Detections:
${JSON.stringify(
  unknownDetections.map((d) => ({
    id: d.id,
    label: d.label,
    confidence: d.confidence,
    bbox: d.bbox,
    hasMask: !!d.mask,
  })),
  null,
  2
)}

Respond with a JSON array:
[{"detectionId": "...", "category": "...", "subcategory": "...", "reasoning": "..."}]
Respond ONLY with valid JSON.`;

    try {
      const response = await getLLM().invoke(prompt);
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
      const llmClassifications: Array<{
        detectionId: string;
        category: DetectionCategory;
        subcategory: string;
        reasoning: string;
      }> = JSON.parse(content);

      for (const llmC of llmClassifications) {
        const idx = fastClassifications.findIndex(
          (fc) => fc.detectionId === llmC.detectionId
        );
        if (idx !== -1) {
          fastClassifications[idx] = {
            ...fastClassifications[idx],
            category: llmC.category,
            subcategory: llmC.subcategory || fastClassifications[idx].subcategory,
            reasoning: llmC.reasoning,
          };
        }
      }
    } catch {
      // If LLM fails, keep as unknown
    }
  }

  return {
    classifications: fastClassifications,
    messages: [
      ...state.messages,
      `Classified ${fastClassifications.length} detections: ${fastClassifications.filter((c) => c.category === "threat").length} threats, ${fastClassifications.filter((c) => c.category === "anomaly").length} anomalies`,
    ],
    currentStep: "assess_risk",
  };
}

async function assessRisk(
  state: DetectionAnalyzerState
): Promise<Partial<DetectionAnalyzerState>> {
  const { classifications, detections } = state;

  // Score factors
  const threatCount = classifications.filter(
    (c) => c.category === "threat"
  ).length;
  const anomalyCount = classifications.filter(
    (c) => c.category === "anomaly"
  ).length;
  const avgConfidence =
    detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
  const hasMasks = detections.some((d) => !!d.mask);

  const factors = [
    {
      factor: "threat_presence",
      score: Math.min(100, threatCount * 30),
      weight: 0.4,
      description: `${threatCount} threat detection(s) identified`,
    },
    {
      factor: "anomaly_density",
      score: Math.min(100, anomalyCount * 20),
      weight: 0.25,
      description: `${anomalyCount} anomalous detection(s)`,
    },
    {
      factor: "detection_confidence",
      score: Math.round(avgConfidence * 100),
      weight: 0.2,
      description: `Average detection confidence: ${(avgConfidence * 100).toFixed(1)}%`,
    },
    {
      factor: "segmentation_quality",
      score: hasMasks ? 90 : 50,
      weight: 0.15,
      description: hasMasks
        ? "SAM2 masks available for precise segmentation"
        : "No segmentation masks - bounding box only",
    },
  ];

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  const level =
    overallScore >= 75
      ? "critical"
      : overallScore >= 50
        ? "high"
        : overallScore >= 25
          ? "medium"
          : "low";

  const risk: RiskAssessment = {
    overallScore,
    level,
    factors,
    trend: "stable",
  };

  return {
    risk,
    messages: [
      ...state.messages,
      `Risk assessed: ${level} (score: ${overallScore})`,
    ],
    currentStep: "generate_recommendations",
  };
}

async function generateRecommendations(
  state: DetectionAnalyzerState
): Promise<Partial<DetectionAnalyzerState>> {
  const { classifications, risk } = state;

  const prompt = `You are a rail safety AI advisor. Based on the following detection analysis, provide actionable recommendations.

Classifications:
${JSON.stringify(classifications, null, 2)}

Risk Assessment:
${JSON.stringify(risk, null, 2)}

Return a JSON object with:
- recommendations: array of {priority: "low"|"medium"|"high", action: string, reasoning: string}
- summary: a 2-3 sentence summary of findings

Respond ONLY with valid JSON.`;

  let recommendations = state.recommendations;
  let summary = state.summary;

  try {
    const response = await getLLM().invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    const parsed = JSON.parse(content);
    recommendations = parsed.recommendations ?? [];
    summary = parsed.summary ?? "Analysis complete.";
  } catch {
    // Fallback deterministic recommendations
    recommendations = [];
    if (classifications.some((c) => c.category === "threat")) {
      recommendations.push({
        priority: "high" as const,
        action: "Dispatch security to investigate threat detections immediately",
        reasoning: "Active threat detections require immediate response",
      });
    }
    if (classifications.some((c) => c.category === "anomaly")) {
      recommendations.push({
        priority: "medium" as const,
        action: "Schedule inspection of anomalous areas within 24 hours",
        reasoning: "Anomalies may indicate developing safety hazards",
      });
    }
    summary = `Analyzed ${classifications.length} detections. Risk level: ${risk?.level ?? "unknown"}.`;
  }

  return {
    recommendations,
    summary,
    messages: [
      ...state.messages,
      `Generated ${recommendations.length} recommendation(s)`,
    ],
    currentStep: "complete",
  };
}

// ── Build Graph ─────────────────────────────────────────────────────

function buildDetectionAnalyzerGraph() {
  const graph = new StateGraph<DetectionAnalyzerState>({
    channels: {
      detections: {
        value: (a: DetectionInput[], b: DetectionInput[]) => b ?? a,
        default: () => [],
      },
      classifications: {
        value: (a: DetectionClassification[], b: DetectionClassification[]) =>
          b ?? a,
        default: () => [],
      },
      risk: { value: (a: any, b: any) => b ?? a, default: () => null },
      recommendations: {
        value: (a: any[], b: any[]) => b ?? a,
        default: () => [],
      },
      summary: {
        value: (a: string, b: string) => b ?? a,
        default: () => "",
      },
      messages: {
        value: (a: string[], b: string[]) => b ?? a,
        default: () => [],
      },
      currentStep: {
        value: (a: string, b: string) => b ?? a,
        default: () => "receive_detections",
      },
    },
  } as any);

  graph.addNode("receive_detections", receiveDetections);
  graph.addNode("classify_anomalies", classifyAnomalies);
  graph.addNode("assess_risk", assessRisk);
  graph.addNode("generate_recommendations", generateRecommendations);

  graph.addEdge(START, "receive_detections");
  graph.addEdge("receive_detections", "classify_anomalies");
  graph.addEdge("classify_anomalies", "assess_risk");
  graph.addEdge("assess_risk", "generate_recommendations");
  graph.addEdge("generate_recommendations", END);

  return graph.compile();
}

export const detectionAnalyzerAgent = buildDetectionAnalyzerGraph();

/**
 * Convenience wrapper to analyze detections and return a structured result.
 */
export async function analyzeDetections(
  detections: DetectionInput[]
): Promise<DetectionAnalysis> {
  const result = await detectionAnalyzerAgent.invoke({
    detections,
    classifications: [],
    risk: null,
    recommendations: [],
    summary: "",
    messages: [],
    currentStep: "receive_detections",
  });

  return {
    analysisId: uuidv4(),
    detections: result.classifications,
    risk: result.risk!,
    recommendations: result.recommendations,
    summary: result.summary,
    analyzedAt: new Date().toISOString(),
  };
}
