"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import Link from "next/link";
import { useState, useEffect } from "react";
import { isSimulationMode } from "@/lib/simulation";

export default function SettingsPage() {
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);
  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
          Settings
          {simulationOn && (
            <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Simulation
            </span>
          )}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">System configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="card-gradient card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🔔</span>
              Notifications
            </CardTitle>
            <CardDescription>Configure alert routing and preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/notifications">
              <Button className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
                Manage Notifications
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              System Configuration
            </CardTitle>
            <CardDescription>System-wide settings and preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/system">
              <Button className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
                Open System Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">👤</span>
              User Preferences
            </CardTitle>
            <CardDescription>Personal settings and preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/user">
              <Button className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
                Open User Preferences
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🔑</span>
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys and integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/api-keys">
              <Button className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
                View API Key Setup
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">💾</span>
              Data Retention
            </CardTitle>
            <CardDescription>Configure data retention policies</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/data-retention">
              <Button className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
                Open Data Retention
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">📥</span>
              Export & Backup
            </CardTitle>
            <CardDescription>Export data and configure backups</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/export">
              <Button className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
                Open Export & Backup
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
