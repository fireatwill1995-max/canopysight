import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

/**
 * LangChain chains for various AI tasks
 */
export class LangChainChains {
  private anthropic: ChatAnthropic;
  private openai: ChatOpenAI;

  constructor() {
    this.anthropic = new ChatAnthropic({
      modelName: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // NOTE: LangChain OpenAI constructor options have changed across versions.
    // We keep this as a best-effort optional dependency (advanced AI is explicitly deferred in v1).
    this.openai = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.5,
      openAIApiKey: process.env.OPENAI_API_KEY,
    } as any);
  }

  /**
   * Event summarization chain using GPT-4o-mini
   */
  createSummarizationChain() {
    const prompt = PromptTemplate.fromTemplate(`
Summarize the following detection event in a clear, concise alert description:

Event Type: {type}
Confidence: {confidence}
Risk Score: {riskScore}
Zones: {zones}
Timestamp: {timestamp}
Metadata: {metadata}

Provide a brief, actionable summary suitable for an alert notification.
`);

    return RunnableSequence.from([prompt as any, this.openai as any, new StringOutputParser() as any]) as any;
  }

  /**
   * Anomaly detection chain
   */
  createAnomalyDetectionChain() {
    const prompt = PromptTemplate.fromTemplate(`
Analyze the following detection events and identify any anomalies or unusual patterns:

Events: {events}

Consider:
1. Unusual timing patterns
2. Unexpected locations
3. Abnormal behavior sequences
4. Risk score inconsistencies

Provide a detailed analysis of any anomalies found.
`);

    return RunnableSequence.from([prompt as any, this.anthropic as any, new StringOutputParser() as any]) as any;
  }

  /**
   * Natural language query chain
   */
  createQueryChain() {
    const prompt = PromptTemplate.fromTemplate(`
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

    return RunnableSequence.from([prompt as any, this.anthropic as any, new StringOutputParser() as any]) as any;
  }

  /**
   * Compliance checker chain
   */
  createComplianceChain() {
    const prompt = PromptTemplate.fromTemplate(`
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

    return RunnableSequence.from([prompt as any, this.anthropic as any, new StringOutputParser() as any]) as any;
  }

  /**
   * Predictive analytics chain
   */
  createPredictiveChain() {
    const prompt = PromptTemplate.fromTemplate(`
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

    return RunnableSequence.from([prompt as any, this.anthropic as any, new StringOutputParser() as any]) as any;
  }
}
