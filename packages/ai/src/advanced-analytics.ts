import { PrismaClient } from "@canopy-sight/database";
import { VectorSearch } from "./vector-search";
import { LangChainChains } from "./langchain/chains";

/**
 * Advanced analytics engine
 * Provides behavioral pattern analysis, predictive alerts, and anomaly detection
 */
export class AdvancedAnalytics {
  private prisma: PrismaClient;
  private vectorSearch: VectorSearch;
  private langchain: LangChainChains;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.vectorSearch = new VectorSearch(prisma);
    this.langchain = new LangChainChains();
  }

  /**
   * Analyze behavioral patterns across sites
   */
  async analyzeBehavioralPatterns(
    organizationId: string,
    timeWindow: { start: Date; end: Date }
  ): Promise<{
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
  }> {
    try {
      // Find patterns using vector clustering
      const patterns = await this.vectorSearch.findPatterns(organizationId, timeWindow);

      // Detect anomalies
      const anomalies = await this.vectorSearch.detectAnomalies(
        organizationId,
        timeWindow.start,
        timeWindow.end
      );

      // Use LangChain to analyze and generate insights
      const events = await this.prisma.detectionEvent.findMany({
        where: {
          organizationId,
          timestamp: { gte: timeWindow.start, lte: timeWindow.end },
        },
        take: 100, // Sample for analysis
      });

      const analysisPrompt = `Analyze these rail safety detection patterns:
${JSON.stringify(patterns, null, 2)}

Anomalies detected: ${anomalies.length}

Provide:
1. Risk assessment for each pattern
2. Recommendations for each pattern
3. Explanation of anomalies`;

      const chain = this.langchain.createAnomalyDetectionChain();
      const analysis = await chain.invoke({ events: JSON.stringify(events) });

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
    } catch (error) {
      console.error("Error analyzing behavioral patterns:", error);
      return { patterns: [], anomalies: [] };
    }
  }

  /**
   * Generate predictive alerts based on historical patterns
   */
  async generatePredictiveAlerts(
    organizationId: string,
    siteId?: string
  ): Promise<Array<{
    type: "time_based" | "location_based" | "pattern_based";
    message: string;
    confidence: number;
    recommendedAction: string;
  }>> {
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
    } catch (error) {
      console.error("Error generating predictive alerts:", error);
      return [];
    }
  }

  /**
   * Calculate risk level from frequency
   */
  private calculateRiskLevel(frequency: number): "low" | "medium" | "high" {
    if (frequency < 5) return "low";
    if (frequency < 20) return "medium";
    return "high";
  }

  /**
   * Parse AI predictions into structured format
   */
  private parsePredictions(prediction: string): Array<{
    type: "time_based" | "location_based" | "pattern_based";
    message: string;
    confidence: number;
    recommendedAction: string;
  }> {
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
