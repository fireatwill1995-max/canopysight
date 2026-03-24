import { PrismaClient } from "@canopy-sight/database";
/**
 * Advanced analytics engine
 * Provides behavioral pattern analysis, predictive alerts, and anomaly detection
 */
export declare class AdvancedAnalytics {
    private prisma;
    private vectorSearch;
    private langchain;
    constructor(prisma: PrismaClient);
    /**
     * Analyze behavioral patterns across sites
     */
    analyzeBehavioralPatterns(organizationId: string, timeWindow: {
        start: Date;
        end: Date;
    }): Promise<{
        patterns: Array<{
            description: string;
            frequency: number;
            riskLevel: "low" | "medium" | "high";
            recommendations: string[];
        }>;
        anomalies: Array<{
            eventId: string;
            description: string;
            anomalyScore: number;
        }>;
    }>;
    /**
     * Generate predictive alerts based on historical patterns
     */
    generatePredictiveAlerts(organizationId: string, siteId?: string): Promise<Array<{
        type: "time_based" | "location_based" | "pattern_based";
        message: string;
        confidence: number;
        recommendedAction: string;
    }>>;
    /**
     * Calculate risk level from frequency
     */
    private calculateRiskLevel;
    /**
     * Parse AI predictions into structured format
     */
    private parsePredictions;
}
//# sourceMappingURL=advanced-analytics.d.ts.map