import { LangChainChains } from "./langchain/chains";

/**
 * Natural language query interface
 * Converts user queries to structured database queries
 */
export class NaturalLanguageQuery {
  private chains: LangChainChains;

  constructor() {
    this.chains = new LangChainChains();
  }

  /**
   * Parse natural language query into structured filters
   */
  async parseQuery(query: string): Promise<{
    siteId?: string;
    deviceId?: string;
    startDate?: Date;
    endDate?: Date;
    types?: Array<"person" | "vehicle" | "animal" | "unknown">;
    minRiskScore?: number;
    zones?: string[];
  }> {
    const chain = this.chains.createQueryChain();
    
    try {
      const result = await chain.invoke({ query });
      const parsed = JSON.parse(result);
      
      // Convert date strings to Date objects
      if (parsed.startDate) {
        parsed.startDate = new Date(parsed.startDate);
      }
      if (parsed.endDate) {
        parsed.endDate = new Date(parsed.endDate);
      }
      
      return parsed;
    } catch (error) {
      console.error("Failed to parse natural language query:", error);
      throw new Error("Could not understand query. Please try rephrasing.");
    }
  }

  /**
   * Example queries:
   * - "Show me all trespass events this week"
   * - "Find high-risk detections at site X in the last 24 hours"
   * - "What vehicles were detected near the crossing zone yesterday?"
   */
}
