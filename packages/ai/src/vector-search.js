"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearch = void 0;
const openai_embeddings_1 = require("./embeddings/openai-embeddings");
/**
 * Enhanced vector search utilities using pgvector
 * For similarity search, anomaly detection, and pattern recognition
 */
class VectorSearch {
    prisma;
    embeddings;
    constructor(prisma) {
        this.prisma = prisma;
        this.embeddings = new openai_embeddings_1.OpenAIEmbeddings();
    }
    /**
     * Generate high-quality embedding for detection event
     */
    async generateEmbedding(event) {
        return this.embeddings.generateEmbedding(event);
    }
    /**
     * Find similar events using vector similarity
     */
    async findSimilarEvents(eventId, _limit = 10, _threshold = 0.8) {
        // This would use pgvector's cosine similarity
        // SELECT id, 1 - (embedding <=> (SELECT embedding FROM "DetectionEvent" WHERE id = $1)) as similarity
        // FROM "DetectionEvent"
        // WHERE id != $1 AND organizationId = $2
        // ORDER BY similarity DESC
        // LIMIT $3
        // Placeholder implementation
        return [];
    }
    /**
     * Detect anomalies using vector clustering (DBSCAN approach)
     */
    async detectAnomalies(organizationId, startDate, endDate, minClusterSize = 3, epsilon = 0.3) {
        try {
            // NOTE: pgvector-backed embeddings are not implemented in the current Prisma schema.
            // Advanced AI/ML is explicitly deferred in the v1 CANOPY brief, so this remains a stub.
            void organizationId;
            void startDate;
            void endDate;
            void minClusterSize;
            void epsilon;
            return [];
        }
        catch (error) {
            console.error("Error detecting anomalies:", error);
            return [];
        }
    }
    /**
     * Calculate cosine distance between two vectors
     */
    cosineDistance(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error("Vectors must have same length");
        }
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
        return 1 - similarity; // Convert similarity to distance
    }
    /**
     * Find behavioral patterns using temporal clustering
     */
    async findPatterns(organizationId, timeWindow) {
        try {
            // NOTE: pattern discovery is provided via `apps/api` analytics router (behavioralPatterns).
            // This module remains a stub until embeddings + pgvector are wired into Prisma.
            void organizationId;
            void timeWindow;
            return [];
        }
        catch (error) {
            console.error("Error finding patterns:", error);
            return [];
        }
    }
    /**
     * Calculate average distance to cluster
     */
    calculateAverageDistance(vec, clusterVectors) {
        if (clusterVectors.length === 0)
            return Infinity;
        const distances = clusterVectors.map((cv) => this.cosineDistance(vec, cv));
        return distances.reduce((a, b) => a + b, 0) / distances.length;
    }
    /**
     * Get time of day label
     */
    getTimeOfDayLabel(hour) {
        if (hour >= 5 && hour < 12)
            return "morning";
        if (hour >= 12 && hour < 17)
            return "afternoon";
        if (hour >= 17 && hour < 21)
            return "evening";
        return "night";
    }
    /**
     * Find most frequent value
     */
    mostFrequent(arr) {
        const counts = new Map();
        arr.forEach((item) => {
            counts.set(item, (counts.get(item) || 0) + 1);
        });
        let maxCount = 0;
        let mostFrequent = arr[0];
        counts.forEach((count, item) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = item;
            }
        });
        return mostFrequent;
    }
}
exports.VectorSearch = VectorSearch;
