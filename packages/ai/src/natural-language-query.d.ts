/**
 * Natural language query interface
 * Converts user queries to structured database queries
 */
export declare class NaturalLanguageQuery {
    private chains;
    constructor();
    /**
     * Parse natural language query into structured filters
     */
    parseQuery(query: string): Promise<{
        siteId?: string;
        deviceId?: string;
        startDate?: Date;
        endDate?: Date;
        types?: Array<"person" | "vehicle" | "animal" | "unknown">;
        minRiskScore?: number;
        zones?: string[];
    }>;
}
//# sourceMappingURL=natural-language-query.d.ts.map