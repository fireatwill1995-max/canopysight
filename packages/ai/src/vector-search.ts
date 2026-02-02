import { PrismaClient } from "@canopy-sight/database";
import { OpenAIEmbeddings } from "./embeddings/openai-embeddings";

/**
 * Enhanced vector search utilities using pgvector
 * For similarity search, anomaly detection, and pattern recognition
 */
export class VectorSearch {
  private prisma: PrismaClient;
  private embeddings: OpenAIEmbeddings;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.embeddings = new OpenAIEmbeddings();
  }

  /**
   * Generate high-quality embedding for detection event
   */
  async generateEmbedding(event: {
    type: string;
    confidence: number;
    riskScore?: number;
    zoneIds: string[];
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): Promise<number[]> {
    return this.embeddings.generateEmbedding(event);
  }

  /**
   * Find similar events using vector similarity
   */
  async findSimilarEvents(
    eventId: string,
    limit: number = 10,
    threshold: number = 0.8
  ): Promise<Array<{ id: string; similarity: number }>> {
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
  async detectAnomalies(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    minClusterSize: number = 3,
    epsilon: number = 0.3
  ): Promise<Array<{ eventId: string; anomalyScore: number; reason: string }>> {
    try {
      // NOTE: pgvector-backed embeddings are not implemented in the current Prisma schema.
      // Advanced AI/ML is explicitly deferred in the v1 CANOPY brief, so this remains a stub.
      void organizationId;
      void startDate;
      void endDate;
      void minClusterSize;
      void epsilon;
      return [];
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      return [];
    }
  }

  /**
   * Calculate cosine distance between two vectors
   */
  private cosineDistance(vec1: number[], vec2: number[]): number {
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
  async findPatterns(
    organizationId: string,
    timeWindow: { start: Date; end: Date }
  ): Promise<Array<{
    pattern: string;
    frequency: number;
    events: string[];
    timeOfDay: string;
    zoneIds: string[];
  }>> {
    try {
      // NOTE: pattern discovery is provided via `apps/api` analytics router (behavioralPatterns).
      // This module remains a stub until embeddings + pgvector are wired into Prisma.
      void organizationId;
      void timeWindow;
      return [];
    } catch (error) {
      console.error("Error finding patterns:", error);
      return [];
    }
  }

  /**
   * Calculate average distance to cluster
   */
  private calculateAverageDistance(vec: number[], clusterVectors: number[][]): number {
    if (clusterVectors.length === 0) return Infinity;

    const distances = clusterVectors.map((cv) => this.cosineDistance(vec, cv));
    return distances.reduce((a, b) => a + b, 0) / distances.length;
  }

  /**
   * Get time of day label
   */
  private getTimeOfDayLabel(hour: number): string {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }

  /**
   * Find most frequent value
   */
  private mostFrequent<T>(arr: T[]): T {
    const counts = new Map<T, number>();
    arr.forEach((item) => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    let maxCount = 0;
    let mostFrequent: T = arr[0];
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    });

    return mostFrequent;
  }
}
