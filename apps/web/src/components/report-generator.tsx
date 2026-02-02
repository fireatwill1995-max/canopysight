"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface ReportGeneratorProps {
  siteId?: string;
  startDate: Date;
  endDate: Date;
}

export function ReportGenerator({ siteId, startDate, endDate }: ReportGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const generateReport = async () => {
    setGenerating(true);
    try {
      // This would call a tRPC endpoint for report generation
      // For now, placeholder
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setReport("Report generation would happen here via AI");
    } catch (error) {
      // Error handling - in production would show toast
      setReport("Error generating report. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Report</CardTitle>
        <CardDescription>AI-generated compliance and safety report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Period: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</p>
          {siteId && <p>Site: {siteId}</p>}
        </div>

        <Button onClick={generateReport} disabled={generating} className="w-full">
          {generating ? "Generating..." : "Generate Report"}
        </Button>

        {report && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded border text-gray-900 dark:text-gray-100">
            <h3 className="font-semibold mb-2">Generated Report</h3>
            <pre className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-200">{report}</pre>
            <Button variant="outline" className="mt-4" onClick={() => {
              const blob = new Blob([report], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `report-${Date.now()}.txt`;
              a.click();
            }}>
              Download Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
