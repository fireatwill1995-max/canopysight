"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedAnalytics = void 0;
const vector_search_1 = require("./vector-search");
const chains_1 = require("./langchain/chains");
/**
 * Advanced analytics engine
 * Provides behavioral pattern analysis, predictive alerts, and anomaly detection
 */
class AdvancedAnalytics {
    prisma;
    vectorSearch;
    langchain;
    constructor(prisma) {
        this.prisma = prisma;
        this.vectorSearch = new vector_search_1.VectorSearch(prisma);
        this.langchain = new chains_1.LangChainChains();
    }
    /**
     * Analyze behavioral patterns across sites
     */
    async analyzeBehavioralPatterns(organizationId, timeWindow) {
        try {
            // Find patterns using vector clustering
            const patterns = await this.vectorSearch.findPatterns(organizationId, timeWindow);
            // Detect anomalies
            const anomalies = await this.vectorSearch.detectAnomalies(organizationId, timeWindow.start, timeWindow.end);
            // Use LangChain to analyze and generate insights
            const events = await this.prisma.detectionEvent.findMany({
                where: {
                    organizationId,
                    timestamp: { gte: timeWindow.start, lte: timeWindow.end },
                },
                take: 100, // Sample for analysis
            });
            const _analysisPrompt = `Analyze these rail safety detection patterns:
${JSON.stringify(patterns, null, 2)}

Anomalies detected: ${anomalies.length}

Provide:
1. Risk assessment for each pattern
2. Recommendations for each pattern
3. Explanation of anomalies`;
            const chain = this.langchain.createAnomalyDetectionChain();
            const _analysis = await chain.invoke({ events: JSON.stringify(events) });
            return {
                patterns: patterns.map((p) => ({
                    description: p.pattern,
                    frequency: p.frequency,
                    riskLevel: this.calculateRiskLevel(p.frequency),
                    recommendations: [], // Would be extracted from AI analysis
                })),
                anomalies: anomalies.map((a) => ({
                    eventId: a.eventId,
                    description: a.reason,
                    anomalyScore: a.anomalyScore,
                })),
            };
        }
        catch (error) {
            console.error("Error analyzing behavioral patterns:", error);
            return { patterns: [], anomalies: [] };
        }
    }
    /**
     * Generate predictive alerts based on historical patterns
     */
    async generatePredictiveAlerts(organizationId, siteId) {
        try {
            // Get historical data
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
            const events = await this.prisma.detectionEvent.findMany({
                where: {
                    organizationId,
                    ...(siteId && { siteId }),
                    timestamp: { gte: startDate, lte: endDate },
                },
                orderBy: { timestamp: "desc" },
                take: 1000,
            });
            // Use predictive chain
            const chain = this.langchain.createPredictiveChain();
            const prediction = await chain.invoke({
                events: JSON.stringify(events),
                patterns: JSON.stringify(await this.vectorSearch.findPatterns(organizationId, { start: startDate, end: endDate })),
                sites: JSON.stringify(await this.prisma.site.findMany({ where: { organizationId } })),
            });
            // Parse prediction (would use structured output in production)
            return this.parsePredictions(prediction);
        }
        catch (error) {
            console.error("Error generating predictive alerts:", error);
            return [];
        }
    }
    /**
     * Calculate risk level from frequency
     */
    calculateRiskLevel(frequency) {
        if (frequency < 5)
            return "low";
        if (frequency < 20)
            return "medium";
        return "high";
    }
    /**
     * Parse AI predictions into structured format
     */
    parsePredictions(_prediction) {
        // Placeholder - in production, use structured output from AI
        return [
            {
                type: "pattern_based",
                message: "High activity expected during evening hours based on historical patterns",
                confidence: 0.75,
                recommendedAction: "Increase monitoring sensitivity during 18:00-22:00",
            },
        ];
    }
}
exports.AdvancedAnalytics = AdvancedAnalytics;
