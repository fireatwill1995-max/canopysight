"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIEmbeddings = void 0;
const openai_1 = __importDefault(require("openai"));
/**
 * OpenAI Embeddings for vector search
 * Generates high-quality embeddings for detection events
 */
class OpenAIEmbeddings {
    client;
    model = "text-embedding-3-small"; // 1536 dimensions, cost-effective
    enabled = false;
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.client = new openai_1.default({ apiKey });
            this.enabled = true;
        }
        else {
            console.warn("OpenAI API key not found. Embeddings will use fallback method.");
        }
    }
    /**
     * Generate embedding for a detection event
     */
    async generateEmbedding(event) {
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
        }
        catch (error) {
            console.error("Error generating OpenAI embedding:", error);
            return this.generateFallbackEmbedding(event);
        }
    }
    /**
     * Create text representation of event for embedding
     */
    createEventText(event) {
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
    generateFallbackEmbedding(event) {
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
    async generateBatchEmbeddings(events) {
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
        }
        catch (error) {
            console.error("Error generating batch embeddings:", error);
            return events.map((e) => this.generateFallbackEmbedding(e));
        }
    }
}
exports.OpenAIEmbeddings = OpenAIEmbeddings;
