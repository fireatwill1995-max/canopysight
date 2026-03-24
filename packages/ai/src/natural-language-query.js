"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaturalLanguageQuery = void 0;
const chains_1 = require("./langchain/chains");
/**
 * Natural language query interface
 * Converts user queries to structured database queries
 */
class NaturalLanguageQuery {
    chains;
    constructor() {
        this.chains = new chains_1.LangChainChains();
    }
    /**
     * Parse natural language query into structured filters
     */
    async parseQuery(query) {
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
        }
        catch (error) {
            console.error("Failed to parse natural language query:", error);
            throw new Error("Could not understand query. Please try rephrasing.");
        }
    }
}
exports.NaturalLanguageQuery = NaturalLanguageQuery;
