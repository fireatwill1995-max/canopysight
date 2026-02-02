import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

interface DetectionEventData {
  id: string;
  type: string;
  confidence: number;
  timestamp: Date;
  riskScore?: number;
  [key: string]: unknown;
}

interface AlertData {
  id: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  [key: string]: unknown;
}

export async function analyzeIncident(incidentData: {
  detectionEvents: DetectionEventData[];
  alerts: AlertData[];
  context: string;
}): Promise<string> {
  const prompt = `Analyze the following rail safety incident data and provide insights:

Detection Events: ${JSON.stringify(incidentData.detectionEvents, null, 2)}
Alerts: ${JSON.stringify(incidentData.alerts, null, 2)}
Context: ${incidentData.context}

Provide a detailed analysis including:
1. Risk assessment
2. Pattern identification
3. Recommendations
4. Compliance considerations`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

interface EventData {
  id: string;
  type: string;
  timestamp: Date;
  [key: string]: unknown;
}

export async function generateReport(data: {
  siteId: string;
  startDate: Date;
  endDate: Date;
  events: EventData[];
}): Promise<string> {
  const prompt = `Generate a comprehensive rail safety monitoring report:

Site ID: ${data.siteId}
Period: ${data.startDate.toISOString()} to ${data.endDate.toISOString()}
Events: ${data.events.length} total events

Create a professional report with:
1. Executive summary
2. Event statistics
3. Risk analysis
4. Recommendations
5. Compliance status`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
