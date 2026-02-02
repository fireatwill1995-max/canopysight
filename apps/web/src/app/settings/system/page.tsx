"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";

const SYSTEM_SETTINGS_KEY = "canopy_system_settings";

type LiveViewLayout = "single" | "multi" | "auto";

interface SystemSettings {
  liveViewLayout: LiveViewLayout;
  autoFocusOnAlerts: boolean;
  playSoundOnCritical: boolean;
  wsAutoConnect: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  liveViewLayout: "auto",
  autoFocusOnAlerts: true,
  playSoundOnCritical: true,
  wsAutoConnect: true,
};

export default function SystemSettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(SYSTEM_SETTINGS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SystemSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      // Silently use defaults if localStorage fails
    }
  }, []);

  const persist = (next: SystemSettings) => {
    setSettings(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(next));
      }
      addToast({
        type: "success",
        title: "Settings saved",
        description: "System configuration has been updated locally for this browser.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Unable to save",
        description: "We couldn't persist your settings. Check browser storage permissions.",
      });
    }
  };

  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    persist({ ...settings, [key]: value });
  };

  return (
    <main className="canopy-page space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          System Configuration
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Control global behavior for live views, alert handling, and connectivity. These settings are stored locally in
          this browser for the current demo environment.
        </p>
      </div>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Live View Layout</CardTitle>
          <CardDescription>Choose how camera views are arranged on monitoring screens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Default layout</label>
            <select
              className="w-full px-3 py-2 border rounded-lg min-h-[44px]"
              value={settings.liveViewLayout}
              onChange={(e) => update("liveViewLayout", e.target.value as LiveViewLayout)}
            >
              <option value="auto">Auto (smart)</option>
              <option value="single">Single focus</option>
              <option value="multi">Multi-view grid</option>
            </select>
            <p className="text-xs text-gray-500">
              Auto chooses single focus on smaller screens and multi-view on larger displays.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Alert Handling</CardTitle>
          <CardDescription>How the UI should react when new alerts are raised.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.autoFocusOnAlerts}
              onChange={(e) => update("autoFocusOnAlerts", e.target.checked)}
            />
            <div>
              <div className="font-medium text-sm">Auto-focus camera on alert</div>
              <p className="text-xs text-gray-500">
                When enabled, live views on a site automatically switch focus to the device that raised the alert.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.playSoundOnCritical}
              onChange={(e) => update("playSoundOnCritical", e.target.checked)}
            />
            <div>
              <div className="font-medium text-sm">Play sound for critical alerts</div>
              <p className="text-xs text-gray-500">
                In a future build this will trigger an audible chime when a critical alert is raised.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Connectivity</CardTitle>
          <CardDescription>Control WebSocket behavior in this browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.wsAutoConnect}
              onChange={(e) => update("wsAutoConnect", e.target.checked)}
            />
            <div>
              <div className="font-medium text-sm">Auto-connect to WebSocket server</div>
              <p className="text-xs text-gray-500">
                When disabled, the app will avoid opening WebSocket connections automatically. Useful for debugging or
                low-bandwidth links.
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

