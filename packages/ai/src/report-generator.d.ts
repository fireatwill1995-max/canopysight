interface EventData {
    id: string;
    type: string;
    timestamp: Date;
    [key: string]: unknown;
}
export interface ReportData {
    siteId: string;
    startDate: Date;
    endDate: Date;
    events: EventData[];
}
export declare function generateSafetyReport(data: ReportData): Promise<string>;
export {};
//# sourceMappingURL=report-generator.d.ts.map