import OpenAI from "openai";

/**
 * OpenAI Embeddings for vector search
 * Generates high-quality embeddings for detection events
 */
export class OpenAIEmbeddings {
  private client?: OpenAI;
  private model: string = "text-embedding-3-small"; // 1536 dimensions, cost-effective
  private enabled: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      this.enabled = true;
    } else {
      console.warn("OpenAI API key not found. Embeddings will use fallback method.");
    }
  }

  /**
   * Generate embedding for a detection event
   */
  async generateEmbedding(event: {
    type: string;
    confidence: number;
    riskScore?: number;
    zoneIds: string[];
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): Promise<number[]> {
    if (!this.enabled || !this.client) {
      return this.generateFallbackEmbedding(event);
    }

    try {
      // Create a rich text representation of the event
      const text = this.createEventText(event);

      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      if (response.data && response.data[0] && response.data[0].embedding) {
        return response.data[0].embedding;
      }

      throw new Error("Invalid embedding response");
    } catch (error) {
      console.error("Error generating OpenAI embedding:", error);
      return this.generateFallbackEmbedding(event);
    }
  }

  /**
   * Create text representation of event for embedding
   */
  private createEventText(event: {
    type: string;
    confidence: number;
    riskScore?: number;
    zoneIds: string[];
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): string {
    const parts = [
      `Detection type: ${event.type}`,
      `Confidence: ${(event.confidence * 100).toFixed(1)}%`,
      event.riskScore ? `Risk score: ${event.riskScore}` : "",
      event.zoneIds.length > 0 ? `Zones: ${event.zoneIds.join(", ")}` : "",
      `Time: ${event.timestamp.toISOString()}`,
    ];

    if (event.metadata) {
      const metaParts = Object.entries(event.metadata)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`);
      if (metaParts.length > 0) {
        parts.push(`Metadata: ${metaParts.join(", ")}`);
      }
    }

    return parts.filter(Boolean).join(". ");
  }

  /**
   * Fallback embedding generation (simple hash-based)
   */
  private generateFallbackEmbedding(event: {
    type: string;
    confidence: number;
    riskScore?: number;
    zoneIds: string[];
  }): number[] {
    // Simple deterministic embedding for fallback
    const text = JSON.stringify({
      type: event.type,
      confidence: Math.round(event.confidence * 100) / 100,
      riskScore: event.riskScore ? Math.round(event.riskScore) : 0,
      zones: event.zoneIds.length,
    });

    // Simple hash-based embedding (not as good as real embeddings)
    const embedding = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      const hash = text.charCodeAt(i);
      embedding[hash % 1536] += hash / 1000;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / magnitude);
  }

  /**
   * Batch generate embeddings
   */
  async generateBatchEmbeddings(
    events: Array<{
      type: string;
      confidence: number;
      riskScore?: number;
      zoneIds: string[];
      timestamp: Date;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<number[][]> {
    if (!this.enabled || !this.client || events.length === 0) {
      return events.map((e) => this.generateFallbackEmbedding(e));
    }

    try {
      const texts = events.map((e) => this.createEventText(e));

      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      return events.map((e) => this.generateFallbackEmbedding(e));
    }
  }
}
