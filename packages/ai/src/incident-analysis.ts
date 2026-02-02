import { analyzeIncident } from "./claude";

export interface IncidentAnalysisResult {
  riskAssessment: string;
  patterns: string[];
  recommendations: string[];
  complianceStatus: string;
}

interface DetectionEventData {
  id: string;
  type: string;
  confidence: number;
  timestamp: Date;
  riskScore?: number;
  [key: string]: unknown;
}

interface AlertData {
  id: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  [key: string]: unknown;
}

export async function analyzeIncidentWithStructure(
  incidentData: {
    detectionEvents: DetectionEventData[];
    alerts: AlertData[];
    context: string;
  }
): Promise<IncidentAnalysisResult> {
  try {
    const analysis = await analyzeIncident(incidentData);

    // Parse the analysis into structured format
    // In production, you'd use structured output or parsing
    // For now, return a basic structure
    return {
      riskAssessment: analysis || "Analysis completed",
      patterns: [],
      recommendations: [],
      complianceStatus: "compliant",
    };
  } catch (error) {
    console.error("Error in incident analysis:", error);
    throw new Error("Failed to analyze incident");
  }
}
