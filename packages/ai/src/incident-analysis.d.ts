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
export declare function analyzeIncidentWithStructure(incidentData: {
    detectionEvents: DetectionEventData[];
    alerts: AlertData[];
    context: string;
}): Promise<IncidentAnalysisResult>;
export {};
//# sourceMappingURL=incident-analysis.d.ts.map