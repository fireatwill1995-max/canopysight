"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { trpc } from "@/lib/trpc/client";

interface ReportGeneratorProps {
  siteId?: string;
  startDate: Date;
  endDate: Date;
}

export function ReportGenerator({ siteId, startDate, endDate }: ReportGeneratorProps) {
  const { addToast } = useToast();
  const generateMutation = trpc.analytics.generateReport.useMutation({
    onSuccess: (_data) => {
      addToast({
        type: "success",
        title: "Report generated",
        description: "Your safety report is ready.",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Report failed",
        description: error.message || "Failed to generate report. Please try again.",
      });
    },
  });

  const report = generateMutation.data?.report ?? null;
  const generating = generateMutation.isPending;

  const handleGenerate = () => {
    if (!siteId) {
      addToast({
        type: "warning",
        title: "Select a site",
        description: "Please select a site to generate a report for.",
      });
      return;
    }
    if (endDate < startDate) {
      addToast({
        type: "warning",
        title: "Invalid date range",
        description: "End date must be on or after start date.",
      });
      return;
    }
    generateMutation.mutate({ siteId, startDate, endDate });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Report</CardTitle>
        <CardDescription>AI-generated compliance and safety report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Period: {startDate.toLocaleDateString()} – {endDate.toLocaleDateString()}</p>
          {siteId ? <p>Site: {siteId}</p> : <p>Select a site in the filters above to generate a report.</p>}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !siteId}
          className="w-full min-h-[44px] touch-manipulation"
        >
          {generating ? "Generating…" : "Generate Report"}
        </Button>

        {report && (
          <div className="mt-4 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg border border-border">
            <h3 className="font-semibold mb-2 text-foreground">Generated Report</h3>
            <pre className="text-sm whitespace-pre-wrap text-foreground/90 max-h-[400px] overflow-y-auto">{report}</pre>
            <Button
              variant="outline"
              className="mt-4 min-h-[44px] touch-manipulation"
              onClick={() => {
                const blob = new Blob([report], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `safety-report-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
