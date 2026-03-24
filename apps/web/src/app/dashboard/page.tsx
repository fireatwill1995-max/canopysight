"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { SiteCardSkeleton, Skeleton, PageSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { LiveAlertFeed } from "@/components/live-alert-feed";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { isSimulationMode, getMockDashboardStats } from "@/lib/simulation";

export default function DashboardPage() {
  const { addToast } = useToast();
  const canQuery = useCanUseProtectedTrpc();
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);
  const mockStats = simulationOn ? getMockDashboardStats() : null;
  const { data: sites, isLoading: sitesLoading, error: sitesError, refetch: refetchSites, isFetching: sitesFetching } =
    trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });
  const { data: devicesData } = trpc.device.list.useQuery(
    {},
    { enabled: canQuery && !simulationOn, retry: false }
  );
  const { data: activeAlertsData } = trpc.alert.list.useQuery(
    { status: "active", limit: 100 },
    { enabled: canQuery && !simulationOn, retry: false }
  );
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: detectionStats } = trpc.detection.stats.useQuery(
    { startDate: last24h, endDate: new Date() },
    { enabled: canQuery && !simulationOn, retry: false }
  );
  // Use public ping on the dashboard to avoid noisy 401s when running demo/unauth flows.
  // Admin-only `system.health` is still available elsewhere, but shouldn't spam the console.
  trpc.system.ping.useQuery(undefined, {
    retry: false,
    refetchInterval: 30000,
  });

  // Show toast on error
  useEffect(() => {
    if (sitesError) {
      addToast({
        type: "error",
        title: "Failed to load sites",
        description: sitesError.message || "Unable to connect to the API server",
      });
    }
  }, [sitesError, addToast]);

  if (canQuery && sitesLoading) {
    return (
      <main className="canopy-page">
        <PageSkeleton />
      </main>
    );
  }

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Real-time monitoring and system overview</p>
      </div>

      {/* Simulation / demo – visible entry point for buyers */}
      {!sitesLoading && !sitesError && (
        <Card className="mb-6 border border-border bg-muted/60 dark:bg-muted/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <span className="text-2xl">🎬</span>
              Show buyers how it works (Simulation)
            </CardTitle>
            <CardDescription>
              Open a site’s live view with a demo camera feed and sample rail-safety alerts—no real devices required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sites && sites.length > 0 ? (
              <>
                <Link href={`/sites/${sites[0].id}?tab=live&simulation=1`}>
                  <Button
                    className="bg-primary text-primary-foreground hover:opacity-90 min-h-[44px] touch-manipulation"
                  >
                    Open live simulation →
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2">
                  Uses site &quot;{sites[0].name}&quot;. You can pick any site from the list below and use the simulation toggle there.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a site first, then open it and use the <strong>Enable simulation mode</strong> toggle on the site page to see the demo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="card-gradient card-hover animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📍</span>
              Sites
            </CardTitle>
            <CardDescription>Total monitoring sites</CardDescription>
          </CardHeader>
          <CardContent>
            {simulationOn && mockStats ? (
              <p className="text-3xl font-bold text-foreground">{mockStats.sites}</p>
            ) : !canQuery ? (
              <p className="text-3xl font-bold text-foreground">—</p>
            ) : sitesLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{sites?.length ?? 0}</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📡</span>
              Devices
            </CardTitle>
            <CardDescription>Total devices</CardDescription>
          </CardHeader>
          <CardContent>
            {simulationOn && mockStats ? (
              <p className="text-3xl font-bold text-foreground">{mockStats.devices}</p>
            ) : !canQuery ? (
              <p className="text-3xl font-bold text-foreground">—</p>
            ) : devicesData === undefined ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{devicesData?.length ?? 0}</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              Active Alerts
            </CardTitle>
            <CardDescription>Unresolved alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {simulationOn && mockStats ? (
              <p className="text-3xl font-bold text-destructive">{mockStats.activeAlerts}</p>
            ) : !canQuery ? (
              <p className="text-3xl font-bold text-destructive">—</p>
            ) : activeAlertsData === undefined ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold text-destructive">{activeAlertsData?.items?.length ?? 0}</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Recent Events
            </CardTitle>
            <CardDescription>Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            {simulationOn && mockStats ? (
              <p className="text-3xl font-bold text-foreground">{mockStats.recentEvents}</p>
            ) : !canQuery ? (
              <p className="text-3xl font-bold text-foreground">—</p>
            ) : detectionStats === undefined ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{detectionStats?.total ?? 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="card-gradient animate-slide-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  Sites
                </CardTitle>
                <CardDescription>All monitoring sites</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchSites()}
                disabled={sitesFetching}
                className="min-h-[32px]"
                title="Refresh sites"
                aria-label="Refresh sites"
              >
                {sitesFetching ? "…" : "🔄"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sitesLoading ? (
              <div className="space-y-3">
                <SiteCardSkeleton count={3} />
              </div>
            ) : sitesError ? (
              <div className="canopy-panel p-4">
                <p className="text-foreground text-sm font-medium mb-1">⚠️ Unable to connect to API server</p>
                <p className="text-muted-foreground text-xs">
                  Make sure the API server is running. Run <code className="bg-muted px-1 rounded">npm run dev</code> in the root directory.
                </p>
              </div>
            ) : sites && sites.length > 0 ? (
              <div className="space-y-3">
                {sites.map((site: { id: string; name: string; address?: string | null; latitude?: number; longitude?: number; description?: string | null }, index: number) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}`}
                    className="block p-4 rounded-xl border border-border bg-card/90 dark:bg-card/90 backdrop-blur-md hover:shadow-md hover:border-border transition-all duration-200 animate-fade-in touch-manipulation"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-primary hover:underline">{site.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {site.address || `${site.latitude}, ${site.longitude}`}
                        </p>
                        {site.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{site.description}</p>
                        )}
                      </div>
                      <span className="text-2xl ml-2">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📍</div>
                <p className="text-muted-foreground mb-1 font-medium">No sites configured yet</p>
                <p className="text-sm text-muted-foreground mb-4">Get started by adding your first monitoring site</p>
                <Link href="/sites">
                  <Button variant="gradient" size="sm" className="mt-2">
                    + Add Your First Site
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <LiveAlertFeed />
      </div>
    </main>
  );
}
