import { OpenAIEmbeddings } from "@canopy-sight/ai";

/**
 * Embeddings service wrapper
 * Handles embedding generation for detection events
 */
export class EmbeddingsService {
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings();
  }

  async generateForEvent(event: {
    type: string;
    confidence: number;
    riskScore?: number;
    zoneIds: string[];
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): Promise<number[]> {
    return this.embeddings.generateEmbedding(event);
  }
}

export const embeddingsService = new EmbeddingsService();
