/**
 * OpenAI Embeddings for vector search
 * Generates high-quality embeddings for detection events
 */
export declare class OpenAIEmbeddings {
    private client?;
    private model;
    private enabled;
    constructor();
    /**
     * Generate embedding for a detection event
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
     * Create text representation of event for embedding
     */
    private createEventText;
    /**
     * Fallback embedding generation (simple hash-based)
     */
    private generateFallbackEmbedding;
    /**
     * Batch generate embeddings
     */
    generateBatchEmbeddings(events: Array<{
        type: string;
        confidence: number;
        riskScore?: number;
        zoneIds: string[];
        timestamp: Date;
        metadata?: Record<string, unknown>;
    }>): Promise<number[][]>;
}
//# sourceMappingURL=openai-embeddings.d.ts.map