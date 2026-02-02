"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";

export default function ExportSettingsPage() {
  const { addToast } = useToast();
  const [isExporting, setIsExporting] = useState<"incidents" | "alerts" | "detections" | null>(null);

  const simulateExport = (what: "incidents" | "alerts" | "detections") => {
    setIsExporting(what);
    setTimeout(() => {
      setIsExporting(null);
      addToast({
        type: "success",
        title: "Export requested",
        description: `A mock ${what} export has been generated in this demo environment.`,
      });
    }, 800);
  };

  return (
    <main className="canopy-page space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          Export & Backup
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Trigger exports for incidents, alerts, and detections. In this demo, exports are simulated to illustrate the
          workflow without moving real data.
        </p>
      </div>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>CSV Exports</CardTitle>
          <CardDescription>Generate CSV snapshots for analysis in external tools.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            className="min-h-[44px] touch-manipulation w-full"
            onClick={() => simulateExport("incidents")}
            disabled={isExporting !== null}
          >
            {isExporting === "incidents" ? "Exporting…" : "Export Incidents CSV"}
          </Button>
          <Button
            className="min-h-[44px] touch-manipulation w-full"
            onClick={() => simulateExport("alerts")}
            disabled={isExporting !== null}
          >
            {isExporting === "alerts" ? "Exporting…" : "Export Alerts CSV"}
          </Button>
          <Button
            className="min-h-[44px] touch-manipulation w-full"
            onClick={() => simulateExport("detections")}
            disabled={isExporting !== null}
          >
            {isExporting === "detections" ? "Exporting…" : "Export Detections CSV"}
          </Button>
        </CardContent>
      </Card>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Backup strategy (guidance)</CardTitle>
          <CardDescription>How backups should be handled in a production deployment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <ul className="list-disc list-inside space-y-1">
            <li>Schedule full database backups at least daily and before schema migrations.</li>
            <li>Use object storage lifecycle rules for video clips (versioning + retention policies).</li>
            <li>Test restore procedures regularly to ensure backups are actually usable.</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

