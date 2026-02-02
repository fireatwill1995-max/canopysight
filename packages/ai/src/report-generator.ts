import { generateReport } from "./claude";

interface EventData {
  id: string;
  type: string;
  timestamp: Date;
  [key: string]: unknown;
}

export interface ReportData {
  siteId: string;
  startDate: Date;
  endDate: Date;
  events: EventData[];
}

export async function generateSafetyReport(data: ReportData): Promise<string> {
  try {
    // Validate input
    if (!data.siteId || !data.startDate || !data.endDate) {
      throw new Error("Missing required report data");
    }

    if (data.endDate < data.startDate) {
      throw new Error("End date must be after start date");
    }

    return await generateReport(data);
  } catch (error) {
    console.error("Error generating safety report:", error);
    throw error instanceof Error ? error : new Error("Failed to generate report");
  }
}
