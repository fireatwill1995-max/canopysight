/**
 * Mission Planner Agent - LangGraph multi-step mission planning
 *
 * Receives a mission request, analyzes requirements, plans optimal flight path,
 * validates coverage, and generates a mission brief.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, END, START } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type {
  MissionPlannerState,
  MissionPlanRequest,
  MissionPlanResult,
  Waypoint,
} from "./types";

// ── LLM (lazy-loaded to avoid errors when ANTHROPIC_API_KEY is not set) ──

let _llm: ChatAnthropic | null = null;
function getLLM(): ChatAnthropic {
  if (!_llm) {
    _llm = new ChatAnthropic({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0.3,
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 4096,
    });
  }
  return _llm;
}

// ── Tools ───────────────────────────────────────────────────────────

export const getProjectData = tool(
  async ({ siteId }: { siteId: string }) => {
    // In production, fetches site/project data from database
    return JSON.stringify({
      siteId,
      name: `Site ${siteId}`,
      terrain: "mixed",
      restrictions: [],
      boundaries: {
        type: "Polygon",
        coordinates: [],
      },
      activeDevices: 4,
    });
  },
  {
    name: "getProjectData",
    description:
      "Retrieves project and site data including terrain, boundaries, and active devices for a given site.",
    schema: z.object({
      siteId: z.string().describe("The site identifier"),
    }),
  }
);

export const getWeatherForecast = tool(
  async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    // In production, calls weather API
    return JSON.stringify({
      latitude,
      longitude,
      temperature: 18,
      windSpeedKmh: 12,
      windDirection: "NW",
      visibilityKm: 10,
      precipitation: "none",
      cloudCoverPercent: 25,
      suitable: true,
      risks: [],
    });
  },
  {
    name: "getWeatherForecast",
    description:
      "Fetches current and forecasted weather conditions for mission planning at the given coordinates.",
    schema: z.object({
      latitude: z.number().describe("Latitude of target area"),
      longitude: z.number().describe("Longitude of target area"),
    }),
  }
);

export const getDroneTelemetry = tool(
  async ({ siteId }: { siteId: string }) => {
    // In production, queries edge-agent / MeshConnect for real telemetry
    return JSON.stringify({
      siteId,
      availableDrones: [
        {
          id: "drone-1",
          batteryPercent: 92,
          status: "ready",
          maxFlightTimeMinutes: 35,
        },
      ],
      lastCalibration: new Date().toISOString(),
    });
  },
  {
    name: "getDroneTelemetry",
    description:
      "Gets real-time drone telemetry data including battery, status, and flight capability for available drones at a site.",
    schema: z.object({
      siteId: z.string().describe("The site to query drones for"),
    }),
  }
);

export const calculateCoverage = tool(
  async ({
    waypoints,
    targetRadius,
  }: {
    waypoints: Array<{ lat: number; lng: number; alt: number }>;
    targetRadius: number;
  }) => {
    // In production, performs geospatial coverage calculation
    const estimatedCoverage = Math.min(
      100,
      (waypoints.length * 15 * 100) / (Math.PI * targetRadius * targetRadius + 1)
    );
    return JSON.stringify({
      coveragePercentage: Math.round(estimatedCoverage * 100) / 100,
      uncoveredAreas: [],
      overlapPercentage: 12,
      totalAreaSqMeters: Math.PI * targetRadius * targetRadius,
    });
  },
  {
    name: "calculateCoverage",
    description:
      "Calculates the coverage percentage of a flight path over the target area, identifying gaps and overlaps.",
    schema: z.object({
      waypoints: z
        .array(
          z.object({
            lat: z.number(),
            lng: z.number(),
            alt: z.number(),
          })
        )
        .describe("Planned flight waypoints"),
      targetRadius: z.number().describe("Target area radius in meters"),
    }),
  }
);

const tools = [getProjectData, getWeatherForecast, getDroneTelemetry, calculateCoverage];

// ── Graph node helpers ──────────────────────────────────────────────

function createDefaultState(): MissionPlannerState {
  return {
    request: null,
    projectData: null,
    weather: null,
    telemetry: null,
    plan: null,
    validationErrors: [],
    messages: [],
    currentStep: "analyze_request",
  };
}

async function analyzeRequest(
  state: MissionPlannerState
): Promise<Partial<MissionPlannerState>> {
  const req = state.request;
  if (!req) {
    return {
      messages: [...state.messages, "ERROR: No mission request provided"],
      currentStep: "error",
    };
  }

  // Gather data in parallel via tool calls
  const [projectDataRaw, weatherRaw, telemetryRaw] = await Promise.all([
    getProjectData.invoke({ siteId: req.siteId }),
    getWeatherForecast.invoke({
      latitude: req.targetArea.latitude,
      longitude: req.targetArea.longitude,
    }),
    getDroneTelemetry.invoke({ siteId: req.siteId }),
  ]);

  return {
    projectData: JSON.parse(projectDataRaw),
    weather: JSON.parse(weatherRaw),
    telemetry: JSON.parse(telemetryRaw),
    messages: [...state.messages, "Request analyzed, data gathered"],
    currentStep: "plan_mission",
  };
}

async function planMission(
  state: MissionPlannerState
): Promise<Partial<MissionPlannerState>> {
  const req = state.request!;

  const prompt = `You are a drone mission planner for rail safety monitoring.
Given the following inputs, plan an optimal flight path.

Mission Request: ${JSON.stringify(req)}
Site Data: ${JSON.stringify(state.projectData)}
Weather: ${JSON.stringify(state.weather)}
Drone Telemetry: ${JSON.stringify(state.telemetry)}

Return a JSON object with:
- waypoints: array of {latitude, longitude, altitudeMeters, speedMs, action, durationSeconds}
- estimatedDurationMinutes: number
- warnings: array of strings
- brief: a one-paragraph mission summary

Respond ONLY with valid JSON, no markdown.`;

  const response = await getLLM().invoke(prompt);
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let parsed: {
    waypoints?: Waypoint[];
    estimatedDurationMinutes?: number;
    warnings?: string[];
    brief?: string;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      waypoints: generateDefaultWaypoints(req),
      estimatedDurationMinutes: 20,
      warnings: ["LLM response could not be parsed; using default plan"],
      brief: "Default survey mission generated.",
    };
  }

  const waypoints = parsed.waypoints ?? generateDefaultWaypoints(req);

  // Calculate coverage
  const coverageRaw = await calculateCoverage.invoke({
    waypoints: waypoints.map((w) => ({
      lat: w.latitude,
      lng: w.longitude,
      alt: w.altitudeMeters,
    })),
    targetRadius: req.targetArea.radiusMeters,
  });
  const coverage = JSON.parse(coverageRaw);

  const weatherData = state.weather as Record<string, unknown> | null;

  const plan: MissionPlanResult = {
    missionId: uuidv4(),
    status: "planned",
    flightPath: waypoints,
    estimatedDurationMinutes: parsed.estimatedDurationMinutes ?? 20,
    coveragePercentage: coverage.coveragePercentage,
    weatherAssessment: {
      suitable: (weatherData?.suitable as boolean) ?? true,
      conditions: `Wind ${weatherData?.windSpeedKmh ?? "N/A"} km/h ${weatherData?.windDirection ?? ""}, Visibility ${weatherData?.visibilityKm ?? "N/A"} km`,
      risks: (weatherData?.risks as string[]) ?? [],
    },
    brief: parsed.brief ?? "Mission planned successfully.",
    warnings: parsed.warnings ?? [],
    createdAt: new Date().toISOString(),
  };

  return {
    plan,
    messages: [...state.messages, "Mission plan generated"],
    currentStep: "validate_plan",
  };
}

async function validatePlan(
  state: MissionPlannerState
): Promise<Partial<MissionPlannerState>> {
  const plan = state.plan!;
  const req = state.request!;
  const errors: string[] = [];

  // Validate altitude constraints
  if (req.constraints?.maxAltitudeMeters) {
    const maxAlt = Math.max(...plan.flightPath.map((w) => w.altitudeMeters));
    if (maxAlt > req.constraints.maxAltitudeMeters) {
      errors.push(
        `Max altitude ${maxAlt}m exceeds limit of ${req.constraints.maxAltitudeMeters}m`
      );
    }
  }

  // Validate duration
  if (req.constraints?.maxDurationMinutes) {
    if (plan.estimatedDurationMinutes > req.constraints.maxDurationMinutes) {
      errors.push(
        `Estimated duration ${plan.estimatedDurationMinutes}min exceeds limit of ${req.constraints.maxDurationMinutes}min`
      );
    }
  }

  // Validate weather
  if (!plan.weatherAssessment.suitable) {
    errors.push("Weather conditions are unsuitable for flight");
  }

  // Validate coverage
  if (plan.coveragePercentage < 70) {
    errors.push(
      `Coverage ${plan.coveragePercentage}% is below minimum threshold of 70%`
    );
  }

  const updatedPlan: MissionPlanResult = {
    ...plan,
    status: errors.length === 0 ? "validated" : "rejected",
    warnings: [...plan.warnings, ...errors],
  };

  return {
    plan: updatedPlan,
    validationErrors: errors,
    messages: [
      ...state.messages,
      errors.length === 0
        ? "Plan validated successfully"
        : `Validation failed: ${errors.join("; ")}`,
    ],
    currentStep: "generate_report",
  };
}

async function generateReport(
  state: MissionPlannerState
): Promise<Partial<MissionPlannerState>> {
  const plan = state.plan!;

  const prompt = `Generate a concise mission brief for a drone survey mission:

Mission ID: ${plan.missionId}
Status: ${plan.status}
Duration: ${plan.estimatedDurationMinutes} minutes
Coverage: ${plan.coveragePercentage}%
Weather: ${plan.weatherAssessment.conditions}
Warnings: ${plan.warnings.join(", ") || "None"}
Waypoints: ${plan.flightPath.length}

Write a professional 2-3 paragraph mission brief suitable for operations review.`;

  const response = await getLLM().invoke(prompt);
  const brief =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  const updatedPlan: MissionPlanResult = { ...plan, brief };

  return {
    plan: updatedPlan,
    messages: [...state.messages, "Mission brief generated"],
    currentStep: "complete",
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function generateDefaultWaypoints(req: MissionPlanRequest): Waypoint[] {
  const { latitude, longitude, radiusMeters } = req.targetArea;
  const alt = req.constraints?.maxAltitudeMeters
    ? Math.min(80, req.constraints.maxAltitudeMeters)
    : 80;

  // Simple lawnmower pattern
  const points: Waypoint[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const offsetLat = (radiusMeters / 111320) * ((i / steps) * 2 - 1);
    const direction = i % 2 === 0 ? 1 : -1;
    points.push({
      latitude: latitude + offsetLat,
      longitude: longitude - (direction * radiusMeters) / 111320,
      altitudeMeters: alt,
      speedMs: 5,
      action: "scan",
    });
    points.push({
      latitude: latitude + offsetLat,
      longitude: longitude + (direction * radiusMeters) / 111320,
      altitudeMeters: alt,
      speedMs: 5,
      action: "capture",
    });
  }
  return points;
}

// ── Routing ─────────────────────────────────────────────────────────

function routeAfterValidation(
  state: MissionPlannerState
): typeof END | "generate_report" {
  // Always proceed to report generation regardless of validation outcome
  return "generate_report";
}

// ── Build Graph ─────────────────────────────────────────────────────

function buildMissionPlannerGraph() {
  const graph = new StateGraph<MissionPlannerState>({
    channels: {
      request: { value: (a: any, b: any) => b ?? a, default: () => null },
      projectData: { value: (a: any, b: any) => b ?? a, default: () => null },
      weather: { value: (a: any, b: any) => b ?? a, default: () => null },
      telemetry: { value: (a: any, b: any) => b ?? a, default: () => null },
      plan: { value: (a: any, b: any) => b ?? a, default: () => null },
      validationErrors: {
        value: (a: string[], b: string[]) => b ?? a,
        default: () => [],
      },
      messages: {
        value: (a: string[], b: string[]) => b ?? a,
        default: () => [],
      },
      currentStep: {
        value: (a: string, b: string) => b ?? a,
        default: () => "analyze_request",
      },
    },
  } as any);

  graph.addNode("analyze_request", analyzeRequest);
  graph.addNode("plan_mission", planMission);
  graph.addNode("validate_plan", validatePlan);
  graph.addNode("generate_report", generateReport);

  graph.addEdge(START, "analyze_request");
  graph.addEdge("analyze_request", "plan_mission");
  graph.addEdge("plan_mission", "validate_plan");
  graph.addConditionalEdges("validate_plan", routeAfterValidation);
  graph.addEdge("generate_report", END);

  return graph.compile();
}

export const missionPlannerAgent = buildMissionPlannerGraph();

/**
 * Convenience wrapper to run a mission plan from a request object.
 */
export async function planMissionFromRequest(
  request: MissionPlanRequest
): Promise<MissionPlanResult> {
  const result = await missionPlannerAgent.invoke({
    ...createDefaultState(),
    request,
  });
  if (!result.plan) {
    throw new Error("Mission planning failed: no plan generated");
  }
  return result.plan;
}

export { tools as missionPlannerTools };
