"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";

const USER_SETTINGS_KEY = "canopy_user_settings";

type LandingPage = "/dashboard" | "/sites" | "/alerts" | "/incidents" | "/analytics";

interface UserSettings {
  landingPage: LandingPage;
  compactMode: boolean;
  reduceMotion: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  landingPage: "/dashboard",
  compactMode: false,
  reduceMotion: false,
};

export default function UserSettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(USER_SETTINGS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      // Silently use defaults if localStorage fails
    }
  }, []);

  const persist = (next: UserSettings) => {
    setSettings(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(next));
      }
      addToast({
        type: "success",
        title: "Preferences saved",
        description: "Your personal preferences have been updated for this browser.",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Unable to save",
        description: "We couldn't persist your preferences. Check browser storage permissions.",
      });
    }
  };

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    persist({ ...settings, [key]: value });
  };

  return (
    <main className="canopy-page space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          User Preferences
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Customize how Canopy Sight looks and behaves for you. These preferences are stored locally in this browser.
        </p>
      </div>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Default Landing Page</CardTitle>
          <CardDescription>Where you land after logging in to the demo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="block text-sm font-medium">Start on</label>
          <select
            className="w-full px-3 py-2 border rounded-lg min-h-[44px]"
            value={settings.landingPage}
            onChange={(e) => update("landingPage", e.target.value as LandingPage)}
          >
            <option value="/dashboard">Dashboard</option>
            <option value="/sites">Sites</option>
            <option value="/alerts">Alerts</option>
            <option value="/incidents">Incidents</option>
            <option value="/analytics">Analytics</option>
          </select>
          <p className="text-xs text-gray-500">
            A future iteration can use this to redirect immediately after demo sign-in.
          </p>
        </CardContent>
      </Card>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
          <CardDescription>Tune the UI density and motion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.compactMode}
              onChange={(e) => update("compactMode", e.target.checked)}
            />
            <div>
              <div className="font-medium text-sm">Compact mode</div>
              <p className="text-xs text-gray-500">
                Reduce padding and whitespace for denser information on large control-room displays.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.reduceMotion}
              onChange={(e) => update("reduceMotion", e.target.checked)}
            />
            <div>
              <div className="font-medium text-sm">Reduce motion</div>
              <p className="text-xs text-gray-500">
                Tone down animations for operators who are motion-sensitive or for low-power devices.
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

