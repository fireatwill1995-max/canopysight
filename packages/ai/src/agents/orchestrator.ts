/**
 * Agent Orchestrator - Routes incoming requests to the correct agent
 *
 * Classifies intent and dispatches to:
 * - Mission Planner Agent
 * - Detection Analyzer Agent
 * - RAG pipeline (general queries via existing vector-search)
 * - Report generation (combines detection + mission data)
 */

import { ChatAnthropic } from "@langchain/anthropic";
import type {
  AgentRequest,
  AgentResponse,
  AgentIntent,
  DetectionAnalysis,
  MissionPlanResult,
} from "./types";
import { planMissionFromRequest } from "./mission-planner";
import { analyzeDetections } from "./detection-analyzer";

// ── LLM for intent classification (lazy-loaded) ─────────────────────

let _classifierLlm: ChatAnthropic | null = null;
function getClassifierLlm(): ChatAnthropic {
  if (!_classifierLlm) {
    _classifierLlm = new ChatAnthropic({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0,
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 256,
    });
  }
  return _classifierLlm;
}

// ── Intent Classification ───────────────────────────────────────────

const INTENT_KEYWORDS: Record<AgentIntent, string[]> = {
  mission_planning: [
    "mission",
    "flight",
    "drone",
    "survey",
    "plan",
    "deploy",
    "waypoint",
    "coverage",
  ],
  detection_analysis: [
    "detection",
    "detect",
    "classify",
    "anomaly",
    "threat",
    "yolo",
    "object",
    "bbox",
    "risk",
  ],
  report_generation: [
    "report",
    "generate report",
    "summary",
    "brief",
    "compliance",
    "export",
  ],
  general_query: [],
};

function classifyIntentFast(message: string): AgentIntent | null {
  const lower = message.toLowerCase();
  let bestIntent: AgentIntent | null = null;
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as AgentIntent;
    }
  }

  return bestScore >= 2 ? bestIntent : null;
}

async function classifyIntentLLM(message: string): Promise<AgentIntent> {
  const prompt = `Classify the following user request into exactly one intent category.

Categories:
- mission_planning: requests about drone missions, flight paths, surveys, deployments
- detection_analysis: requests about analyzing detections, classifying objects, assessing threats
- report_generation: requests for reports, summaries, compliance documents
- general_query: anything else - general questions, information requests

User message: "${message}"

Respond with ONLY the category name, nothing else.`;

  try {
    const response = await getClassifierLlm().invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content.trim().toLowerCase()
        : "general_query";

    const validIntents: AgentIntent[] = [
      "mission_planning",
      "detection_analysis",
      "report_generation",
      "general_query",
    ];
    return validIntents.includes(content as AgentIntent)
      ? (content as AgentIntent)
      : "general_query";
  } catch {
    return "general_query";
  }
}

// ── Request Handlers ────────────────────────────────────────────────

async function handleMissionPlanning(
  request: AgentRequest
): Promise<AgentResponse> {
  const start = Date.now();

  if (!request.missionRequest) {
    return {
      intent: "mission_planning",
      success: false,
      data: {},
      error:
        "Mission planning requires a missionRequest object with siteId, missionType, targetArea, and priority",
      processingTimeMs: Date.now() - start,
    };
  }

  try {
    const plan: MissionPlanResult = await planMissionFromRequest(
      request.missionRequest
    );
    return {
      intent: "mission_planning",
      success: true,
      data: plan,
      processingTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      intent: "mission_planning",
      success: false,
      data: {},
      error: error instanceof Error ? error.message : "Mission planning failed",
      processingTimeMs: Date.now() - start,
    };
  }
}

async function handleDetectionAnalysis(
  request: AgentRequest
): Promise<AgentResponse> {
  const start = Date.now();

  if (!request.detections || request.detections.length === 0) {
    return {
      intent: "detection_analysis",
      success: false,
      data: {},
      error: "Detection analysis requires a non-empty detections array",
      processingTimeMs: Date.now() - start,
    };
  }

  try {
    const analysis: DetectionAnalysis = await analyzeDetections(
      request.detections
    );
    return {
      intent: "detection_analysis",
      success: true,
      data: analysis,
      processingTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      intent: "detection_analysis",
      success: false,
      data: {},
      error:
        error instanceof Error ? error.message : "Detection analysis failed",
      processingTimeMs: Date.now() - start,
    };
  }
}

async function handleGeneralQuery(
  request: AgentRequest
): Promise<AgentResponse> {
  const start = Date.now();

  // Use Claude directly for general queries (RAG pipeline would integrate
  // with VectorSearch from existing vector-search.ts in production)
  const llm = getClassifierLlm();

  try {
    const systemPrompt = `You are the Canopy Sight AI assistant for rail safety monitoring.
You help users understand detections, site analytics, safety patterns, and system capabilities.
Be concise and actionable. Reference specific data when available.`;

    const contextStr = request.context
      ? `\n\nContext: ${JSON.stringify(request.context)}`
      : "";

    const response = await llm.invoke([
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: request.message + contextStr },
    ]);

    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return {
      intent: "general_query",
      success: true,
      data: content,
      processingTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      intent: "general_query",
      success: false,
      data: {},
      error: error instanceof Error ? error.message : "Query processing failed",
      processingTimeMs: Date.now() - start,
    };
  }
}

async function handleReportGeneration(
  request: AgentRequest
): Promise<AgentResponse> {
  const start = Date.now();

  const llm = getClassifierLlm();

  try {
    // If detections are provided, run analysis first
    let analysisData: DetectionAnalysis | null = null;
    if (request.detections && request.detections.length > 0) {
      analysisData = await analyzeDetections(request.detections);
    }

    const prompt = `Generate a comprehensive rail safety monitoring report.

User request: ${request.message}
${analysisData ? `\nDetection Analysis:\n${JSON.stringify(analysisData, null, 2)}` : ""}
${request.context ? `\nAdditional Context:\n${JSON.stringify(request.context, null, 2)}` : ""}

Structure the report with:
1. Executive Summary
2. Detection Analysis (if applicable)
3. Risk Assessment
4. Recommendations
5. Next Steps`;

    const response = await llm.invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return {
      intent: "report_generation",
      success: true,
      data: {
        report: content,
        analysis: analysisData,
        generatedAt: new Date().toISOString(),
      },
      processingTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      intent: "report_generation",
      success: false,
      data: {},
      error:
        error instanceof Error ? error.message : "Report generation failed",
      processingTimeMs: Date.now() - start,
    };
  }
}

// ── Main Orchestrator ───────────────────────────────────────────────

/**
 * Routes an incoming request to the appropriate agent based on intent.
 *
 * Intent is resolved in this order:
 * 1. Explicit `request.intent` if provided
 * 2. Fast keyword-based classification
 * 3. LLM-based classification as fallback
 */
export async function orchestrateRequest(
  request: AgentRequest
): Promise<AgentResponse> {
  // Resolve intent
  let intent: AgentIntent;

  if (request.intent) {
    intent = request.intent;
  } else {
    const fastIntent = classifyIntentFast(request.message);
    intent = fastIntent ?? (await classifyIntentLLM(request.message));
  }

  // Dispatch to appropriate handler
  switch (intent) {
    case "mission_planning":
      return handleMissionPlanning(request);
    case "detection_analysis":
      return handleDetectionAnalysis(request);
    case "report_generation":
      return handleReportGeneration(request);
    case "general_query":
    default:
      return handleGeneralQuery(request);
  }
}
