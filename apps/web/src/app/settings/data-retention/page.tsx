"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";

const DATA_RETENTION_KEY = "canopy_data_retention_settings";

type RetentionPeriod = "7" | "30" | "90" | "365";

interface DataRetentionSettings {
  detectionRetentionDays: RetentionPeriod;
  videoRetentionDays: RetentionPeriod;
  keepCriticalIncidentsForever: boolean;
}

const DEFAULT_SETTINGS: DataRetentionSettings = {
  detectionRetentionDays: "90",
  videoRetentionDays: "30",
  keepCriticalIncidentsForever: true,
};

export default function DataRetentionSettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<DataRetentionSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DATA_RETENTION_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DataRetentionSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      // Silently use defaults if localStorage fails
      // This is expected in some browser configurations
    }
  }, []);

  const persist = (next: DataRetentionSettings) => {
    setSettings(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DATA_RETENTION_KEY, JSON.stringify(next));
      }
      addToast({
        type: "success",
        title: "Retention updated",
        description: "Retention preferences saved for this demo environment.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Unable to save",
        description: "We couldn't persist your settings. Check browser storage permissions.",
      });
    }
  };

  const update = <K extends keyof DataRetentionSettings>(key: K, value: DataRetentionSettings[K]) => {
    persist({ ...settings, [key]: value });
  };

  const renderRetentionSelect = (label: string, value: RetentionPeriod, onChange: (v: RetentionPeriod) => void) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <select
        className="w-full px-3 py-2 border rounded-lg min-h-[44px]"
        value={value}
        onChange={(e) => onChange(e.target.value as RetentionPeriod)}
      >
        <option value="7">7 days</option>
        <option value="30">30 days</option>
        <option value="90">90 days</option>
        <option value="365">365 days</option>
      </select>
    </div>
  );

  return (
    <main className="canopy-page space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          Data Retention
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Define how long detections, incidents, and video clips are retained in this demo environment.
        </p>
      </div>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Retention policies</CardTitle>
          <CardDescription>
            These values represent desired policies. In production, they should be enforced via database and storage
            lifecycle rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderRetentionSelect("Detection & analytics data", settings.detectionRetentionDays, (v) =>
            update("detectionRetentionDays", v),
          )}
          {renderRetentionSelect("Video clips", settings.videoRetentionDays, (v) =>
            update("videoRetentionDays", v),
          )}

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.keepCriticalIncidentsForever}
              onChange={(e) => update("keepCriticalIncidentsForever", e.target.checked)}
            />
            <div>
              <div className="font-medium text-sm">Keep critical incidents indefinitely</div>
              <p className="text-xs text-gray-500">
                When enabled, critical incident reports are never auto-purged, even if older than the standard
                retention window.
              </p>
            </div>
          </label>

          <Button
            variant="outline"
            className="min-h-[44px] touch-manipulation"
            onClick={() => persist(DEFAULT_SETTINGS)}
          >
            Reset to defaults
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

