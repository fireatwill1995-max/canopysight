/**
 * Type definitions for Canopy Sight LangGraph multi-agent system
 */

// ── Mission Planning Types ──────────────────────────────────────────

export interface MissionPlanRequest {
  siteId: string;
  missionType: "survey" | "inspection" | "emergency" | "routine";
  targetArea: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  constraints?: {
    maxAltitudeMeters?: number;
    maxDurationMinutes?: number;
    avoidZones?: Array<{ lat: number; lng: number; radius: number }>;
    weatherMinimums?: {
      maxWindSpeedKmh?: number;
      minVisibilityKm?: number;
    };
  };
  priority: "low" | "medium" | "high" | "critical";
  requestedBy: string;
}

export interface Waypoint {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  speedMs: number;
  action?: "hover" | "capture" | "scan" | "rtl";
  durationSeconds?: number;
}

export interface MissionPlanResult {
  missionId: string;
  status: "planned" | "validated" | "rejected";
  flightPath: Waypoint[];
  estimatedDurationMinutes: number;
  coveragePercentage: number;
  weatherAssessment: {
    suitable: boolean;
    conditions: string;
    risks: string[];
  };
  brief: string;
  warnings: string[];
  createdAt: string;
}

// ── Detection Analysis Types ────────────────────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionInput {
  id: string;
  frameId: string;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  mask?: {
    /** Base64-encoded SAM2 segmentation mask */
    data: string;
    width: number;
    height: number;
  };
  timestamp: string;
  deviceId: string;
  siteId: string;
  metadata?: Record<string, unknown>;
}

export type DetectionCategory = "threat" | "anomaly" | "normal" | "unknown";

export interface DetectionClassification {
  detectionId: string;
  category: DetectionCategory;
  subcategory: string;
  confidence: number;
  reasoning: string;
}

export interface RiskAssessment {
  overallScore: number;
  level: "low" | "medium" | "high" | "critical";
  factors: Array<{
    factor: string;
    score: number;
    weight: number;
    description: string;
  }>;
  trend: "improving" | "stable" | "degrading";
}

export interface DetectionAnalysis {
  analysisId: string;
  detections: DetectionClassification[];
  risk: RiskAssessment;
  recommendations: Array<{
    priority: "low" | "medium" | "high";
    action: string;
    reasoning: string;
  }>;
  summary: string;
  analyzedAt: string;
}

// ── Orchestrator Types ──────────────────────────────────────────────

export type AgentIntent =
  | "mission_planning"
  | "detection_analysis"
  | "general_query"
  | "report_generation";

export interface AgentRequest {
  intent?: AgentIntent;
  message: string;
  context?: Record<string, unknown>;
  /** For mission_planning */
  missionRequest?: MissionPlanRequest;
  /** For detection_analysis */
  detections?: DetectionInput[];
  /** User/org context */
  organizationId?: string;
  userId?: string;
}

export interface AgentResponse {
  intent: AgentIntent;
  success: boolean;
  data: MissionPlanResult | DetectionAnalysis | string | Record<string, unknown>;
  error?: string;
  processingTimeMs: number;
}

// ── Streaming Types ─────────────────────────────────────────────────

export type StreamEventType =
  | "agent:start"
  | "agent:state_change"
  | "agent:tool_call"
  | "agent:tool_result"
  | "agent:message"
  | "agent:error"
  | "agent:complete";

export interface StreamEvent {
  type: StreamEventType;
  agentName: string;
  state?: string;
  data: unknown;
  timestamp: string;
}

// ── LangGraph State Types ───────────────────────────────────────────

export interface MissionPlannerState {
  request: MissionPlanRequest | null;
  projectData: Record<string, unknown> | null;
  weather: Record<string, unknown> | null;
  telemetry: Record<string, unknown> | null;
  plan: MissionPlanResult | null;
  validationErrors: string[];
  messages: string[];
  currentStep: string;
}

export interface DetectionAnalyzerState {
  detections: DetectionInput[];
  classifications: DetectionClassification[];
  risk: RiskAssessment | null;
  recommendations: Array<{
    priority: "low" | "medium" | "high";
    action: string;
    reasoning: string;
  }>;
  summary: string;
  messages: string[];
  currentStep: string;
}
