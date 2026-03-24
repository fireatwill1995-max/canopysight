import { PrismaClient } from "@canopy-sight/database";
/**
 * Enhanced vector search utilities using pgvector
 * For similarity search, anomaly detection, and pattern recognition
 */
export declare class VectorSearch {
    private prisma;
    private embeddings;
    constructor(prisma: PrismaClient);
    /**
     * Generate high-quality embedding for detection event
     */
    generateEmbedding(event: {
        type: string;
        confidence: number;
        riskScore?: number;
        zoneIds: string[];
        timestamp: Date;
        metadata?: Record<string, unknown>;
    }): Promise<number[]>;
    /**
     * Find similar events using vector similarity
     */
    findSimilarEvents(eventId: string, limit?: number, threshold?: number): Promise<Array<{
        id: string;
        similarity: number;
    }>>;
    /**
     * Detect anomalies using vector clustering (DBSCAN approach)
     */
    detectAnomalies(organizationId: string, startDate: Date, endDate: Date, minClusterSize?: number, epsilon?: number): Promise<Array<{
        eventId: string;
        anomalyScore: number;
        reason: string;
    }>>;
    /**
     * Calculate cosine distance between two vectors
     */
    private cosineDistance;
    /**
     * Find behavioral patterns using temporal clustering
     */
    findPatterns(organizationId: string, timeWindow: {
        start: Date;
        end: Date;
    }): Promise<Array<{
        pattern: string;
        frequency: number;
        events: string[];
        timeOfDay: string;
        zoneIds: string[];
    }>>;
    /**
     * Calculate average distance to cluster
     */
    private calculateAverageDistance;
    /**
     * Get time of day label
     */
    private getTimeOfDayLabel;
    /**
     * Find most frequent value
     */
    private mostFrequent;
}
//# sourceMappingURL=vector-search.d.ts.map