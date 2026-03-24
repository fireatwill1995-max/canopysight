"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangChainChains = void 0;
const anthropic_1 = require("@langchain/anthropic");
const openai_1 = require("@langchain/openai");
const prompts_1 = require("@langchain/core/prompts");
const runnables_1 = require("@langchain/core/runnables");
const output_parsers_1 = require("@langchain/core/output_parsers");
/**
 * LangChain chains for various AI tasks
 */
class LangChainChains {
    anthropic;
    openai;
    constructor() {
        this.anthropic = new anthropic_1.ChatAnthropic({
            modelName: "claude-3-5-sonnet-20241022",
            temperature: 0.7,
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        // NOTE: LangChain OpenAI constructor options have changed across versions.
        // We keep this as a best-effort optional dependency (advanced AI is explicitly deferred in v1).
        this.openai = new openai_1.ChatOpenAI({
            modelName: "gpt-4o-mini",
            temperature: 0.5,
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }
    /**
     * Event summarization chain using GPT-4o-mini
     */
    createSummarizationChain() {
        const prompt = prompts_1.PromptTemplate.fromTemplate(`
Summarize the following detection event in a clear, concise alert description:

Event Type: {type}
Confidence: {confidence}
Risk Score: {riskScore}
Zones: {zones}
Timestamp: {timestamp}
Metadata: {metadata}

Provide a brief, actionable summary suitable for an alert notification.
`);
        return runnables_1.RunnableSequence.from([prompt, this.openai, new output_parsers_1.StringOutputParser()]);
    }
    /**
     * Anomaly detection chain
     */
    createAnomalyDetectionChain() {
        const prompt = prompts_1.PromptTemplate.fromTemplate(`
Analyze the following detection events and identify any anomalies or unusual patterns:

Events: {events}

Consider:
1. Unusual timing patterns
2. Unexpected locations
3. Abnormal behavior sequences
4. Risk score inconsistencies

Provide a detailed analysis of any anomalies found.
`);
        return runnables_1.RunnableSequence.from([prompt, this.anthropic, new output_parsers_1.StringOutputParser()]);
    }
    /**
     * Natural language query chain
     */
    createQueryChain() {
        const prompt = prompts_1.PromptTemplate.fromTemplate(`
Convert the following natural language query into structured database query parameters:

User Query: {query}

Available filters:
- siteId: string
- deviceId: string
- startDate: date
- endDate: date
- types: array of "person" | "vehicle" | "animal" | "unknown"
- minRiskScore: number (0-100)
- zones: array of zone IDs

Return a JSON object with the appropriate filters. If the query is ambiguous, return the most likely interpretation.

Example:
Query: "Show me all trespass events this week"
Response: {{"types": ["person"], "startDate": "2024-01-15", "endDate": "2024-01-22"}}
`);
        return runnables_1.RunnableSequence.from([prompt, this.anthropic, new output_parsers_1.StringOutputParser()]);
    }
    /**
     * Compliance checker chain
     */
    createComplianceChain() {
        const prompt = prompts_1.PromptTemplate.fromTemplate(`
Review the following rail safety monitoring data and validate compliance with rail safety standards:

Sites: {sites}
Devices: {devices}
Recent Events: {events}
Alerts: {alerts}

Check for:
1. Adequate monitoring coverage
2. Alert response times
3. Incident reporting completeness
4. Device uptime requirements
5. Data retention compliance

Provide a compliance report with any issues or recommendations.
`);
        return runnables_1.RunnableSequence.from([prompt, this.anthropic, new output_parsers_1.StringOutputParser()]);
    }
    /**
     * Predictive analytics chain
     */
    createPredictiveChain() {
        const prompt = prompts_1.PromptTemplate.fromTemplate(`
Analyze historical detection patterns and predict potential future risks:

Historical Events: {events}
Time Patterns: {patterns}
Site Characteristics: {sites}

Provide predictions for:
1. High-risk time periods
2. Likely incident locations
3. Recommended preventive measures
4. Resource allocation suggestions
`);
        return runnables_1.RunnableSequence.from([prompt, this.anthropic, new output_parsers_1.StringOutputParser()]);
    }
}
exports.LangChainChains = LangChainChains;
