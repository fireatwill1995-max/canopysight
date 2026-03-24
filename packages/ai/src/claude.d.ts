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
export declare function analyzeIncident(incidentData: {
    detectionEvents: DetectionEventData[];
    alerts: AlertData[];
    context: string;
}): Promise<string>;
interface EventData {
    id: string;
    type: string;
    timestamp: Date;
    [key: string]: unknown;
}
export declare function generateReport(data: {
    siteId: string;
    startDate: Date;
    endDate: Date;
    events: EventData[];
}): Promise<string>;
export {};
//# sourceMappingURL=claude.d.ts.map