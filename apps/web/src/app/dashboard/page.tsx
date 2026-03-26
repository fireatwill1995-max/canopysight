"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { SiteCardSkeleton, Skeleton, PageSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { LiveAlertFeed } from "@/components/live-alert-feed";
import { ThreatScoreGauge } from "@/components/threat-score-gauge";
import { ShiftBriefingPanel } from "@/components/shift-briefing-panel";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { isSimulationMode, getMockDashboardStats } from "@/lib/simulation";

// ─── Mock AI Insights (demo fallback) ────────────────────────────────────────
const MOCK_AI_INSIGHTS = [
  {
    id: "ins-1",
    icon: "🔴",
    label: "Zone B · Elevated Risk",
    body: "5 high-confidence detections in last 60 min. Patrol recommended.",
    time: "8 min ago",
    severity: "critical" as const,
  },
  {
    id: "ins-2",
    icon: "🐘",
    label: "Elephant herd approaching perimeter",
    body: "6 individuals detected 0.8 km north. Trending toward Zone A boundary.",
    time: "23 min ago",
    severity: "warning" as const,
  },
  {
    id: "ins-3",
    icon: "📷",
    label: "Camera CS-04 offline",
    body: "Coverage gap in Zone C east. Maintenance required to restore full surveillance.",
    time: "1 h ago",
    severity: "advisory" as const,
  },
];

// Compute threat score from real or mock data
function computeThreatScore(params: {
  activeAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  totalDetections: number;
  devicesOffline: number;
}): { score: number; trend: "rising" | "falling" | "stable"; factors: string[] } {
  const { activeAlerts, criticalAlerts, warningAlerts, totalDetections, devicesOffline } = params;

  let score = 0;
  const factors: string[] = [];

  if (criticalAlerts > 0) {
    score += Math.min(criticalAlerts * 20, 40);
    factors.push(`${criticalAlerts} critical alert${criticalAlerts > 1 ? "s" : ""} unresolved`);
  }
  if (warningAlerts > 0) {
    score += Math.min(warningAlerts * 8, 24);
    factors.push(`${warningAlerts} warning alert${warningAlerts > 1 ? "s" : ""} active`);
  }
  if (totalDetections > 20) {
    score += Math.min(Math.floor((totalDetections - 20) / 5) * 3, 20);
    factors.push(`${totalDetections} detections in last 24h (above baseline)`);
  }
  if (devicesOffline > 0) {
    score += Math.min(devicesOffline * 5, 15);
    factors.push(`${devicesOffline} device${devicesOffline > 1 ? "s" : ""} offline — coverage gap`);
  }
  if (activeAlerts === 0 && totalDetections <= 10 && devicesOffline === 0) {
    factors.push("All systems nominal");
    factors.push("No unresolved alerts");
    factors.push("Detection activity within baseline");
  }

  const finalScore = Math.min(100, Math.max(0, score));
  // Simple heuristic for trend
  const trend: "rising" | "falling" | "stable" =
    criticalAlerts > 0 ? "rising" : finalScore < 25 ? "falling" : "stable";

  return { score: finalScore, trend, factors: factors.slice(0, 3) };
}

function ThreatSeverityBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}
    >
      {label}
    </span>
  );
}

function QuickActionButton({
  icon,
  label,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-border bg-card/60 hover:bg-accent hover:border-primary/30 hover:shadow-sm transition-all duration-150 text-center touch-manipulation min-h-[70px]";

  if (href) {
    return (
      <Link href={href} className={cls}>
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground leading-tight">{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium text-muted-foreground leading-tight">{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  const { addToast } = useToast();
  const canQuery = useCanUseProtectedTrpc();
  const [simulationOn, setSimulationOn] = useState(false);
  const [lastScanTime] = useState(() => new Date());

  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);

  const mockStats = simulationOn ? getMockDashboardStats() : null;

  const {
    data: sites,
    isLoading: sitesLoading,
    error: sitesError,
    refetch: refetchSites,
    isFetching: sitesFetching,
  } = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });

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

  // Computed stats
  const totalDevices = simulationOn ? (mockStats?.devices ?? 0) : (devicesData?.length ?? 0);
  const onlineDevices = simulationOn ? totalDevices : Math.max(0, totalDevices - 1); // -1 for offline CS-04 in demo
  const activeAlertCount = simulationOn
    ? (mockStats?.activeAlerts ?? 0)
    : (activeAlertsData?.items?.length ?? 0);
  const detectionTotal = simulationOn
    ? (mockStats?.recentEvents ?? 0)
    : (detectionStats?.total ?? 0);

  // Severity breakdown (best-effort from real data or mock)
  type AlertItem = { severity: string; [k: string]: unknown };
  const alertItems: AlertItem[] = (activeAlertsData?.items as AlertItem[] | undefined) ?? [];
  const criticalCount = simulationOn
    ? 0
    : alertItems.filter((a) => a.severity === "critical").length;
  const warningCount = simulationOn
    ? mockStats?.activeAlerts ?? 0
    : alertItems.filter((a) => a.severity === "warning").length;

  // Threat score
  const threat = useMemo(
    () =>
      computeThreatScore({
        activeAlerts: activeAlertCount,
        criticalAlerts: criticalCount,
        warningAlerts: warningCount,
        totalDetections: detectionTotal,
        devicesOffline: simulationOn ? 1 : Math.max(0, totalDevices - onlineDevices),
      }),
    [
      activeAlertCount,
      criticalCount,
      warningCount,
      detectionTotal,
      simulationOn,
      totalDevices,
      onlineDevices,
    ]
  );

  // Species detected (mocked for now — backend can provide this later)
  const speciesCount = simulationOn ? 4 : 0;

  // Area under surveillance — rough estimate from site count
  const siteCount = simulationOn ? (mockStats?.sites ?? 0) : (sites?.length ?? 0);
  const surveillanceAreaKm2 = siteCount * 12; // demo heuristic

  if (canQuery && sitesLoading) {
    return (
      <main className="canopy-page">
        <PageSkeleton />
      </main>
    );
  }

  return (
    <main className="canopy-page">
      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Real-time monitoring and system overview
        </p>
      </div>

      {/* ─── Threat Intelligence Header ──────────────────────────────────── */}
      <Card className="mb-6 sm:mb-8 card-gradient border border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-stretch gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center px-6 py-6 min-w-[180px]">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Threat Score
              </p>
              {(canQuery && activeAlertsData === undefined && !simulationOn) ? (
                <Skeleton className="w-[160px] h-[80px] rounded-xl" />
              ) : (
                <ThreatScoreGauge score={threat.score} size="md" showLabel trend={threat.trend} />
              )}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>vs yesterday</span>
                <span
                  className={
                    threat.trend === "rising"
                      ? "text-red-500 font-bold"
                      : threat.trend === "falling"
                      ? "text-emerald-500 font-bold"
                      : "text-muted-foreground"
                  }
                >
                  {threat.trend === "rising" ? "↑ Rising" : threat.trend === "falling" ? "↓ Falling" : "→ Stable"}
                </span>
              </div>
            </div>

            {/* Top threat factors */}
            <div className="flex-1 px-6 py-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Top Threat Factors
              </p>
              <div className="space-y-2.5">
                {threat.factors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No significant threats detected</p>
                ) : (
                  threat.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                          i === 0
                            ? "bg-red-500"
                            : i === 1
                            ? "bg-amber-500"
                            : "bg-blue-400"
                        }`}
                      />
                      <p className="text-sm text-foreground leading-snug">{f}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Alert severity breakdown */}
            <div className="px-6 py-6 min-w-[160px]">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Alert Breakdown
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <ThreatSeverityBadge
                    label="Critical"
                    color="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400"
                  />
                  <span className="text-lg font-bold text-foreground">{criticalCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <ThreatSeverityBadge
                    label="Warning"
                    color="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                  />
                  <span className="text-lg font-bold text-foreground">{warningCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <ThreatSeverityBadge
                    label="Advisory"
                    color="bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
                  />
                  <span className="text-lg font-bold text-foreground">
                    {Math.max(0, activeAlertCount - criticalCount - warningCount)}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/alerts">
                  <Button variant="outline" size="sm" className="w-full min-h-[36px] text-xs">
                    View All Alerts →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Live Stats Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {/* Sites */}
        <Card className="card-gradient card-hover animate-fade-in">
          <CardContent className="p-4">
            <div className="text-2xl mb-1">📍</div>
            <p className="text-2xl font-bold text-foreground">
              {simulationOn && mockStats ? (
                mockStats.sites
              ) : !canQuery ? (
                "—"
              ) : sitesLoading ? (
                <Skeleton className="h-7 w-10 inline-block" />
              ) : (
                sites?.length ?? 0
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Sites</p>
          </CardContent>
        </Card>

        {/* Devices Online */}
        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <CardContent className="p-4">
            <div className="text-2xl mb-1">📡</div>
            <p className="text-2xl font-bold text-foreground">
              {!canQuery && !simulationOn ? (
                "—"
              ) : devicesData === undefined && !simulationOn ? (
                <Skeleton className="h-7 w-12 inline-block" />
              ) : (
                <span>
                  <span className="text-emerald-500">{onlineDevices}</span>
                  <span className="text-muted-foreground text-base font-normal">/{totalDevices}</span>
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Devices Online</p>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <CardContent className="p-4">
            <div className="text-2xl mb-1">🚨</div>
            <p className={`text-2xl font-bold ${activeAlertCount > 0 ? "text-destructive" : "text-foreground"}`}>
              {!canQuery && !simulationOn ? (
                "—"
              ) : activeAlertsData === undefined && !simulationOn ? (
                <Skeleton className="h-7 w-10 inline-block" />
              ) : (
                activeAlertCount
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Active Alerts</p>
          </CardContent>
        </Card>

        {/* Detections Today */}
        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <CardContent className="p-4">
            <div className="text-2xl mb-1">📊</div>
            <p className="text-2xl font-bold text-foreground">
              {!canQuery && !simulationOn ? (
                "—"
              ) : detectionStats === undefined && !simulationOn ? (
                <Skeleton className="h-7 w-10 inline-block" />
              ) : (
                detectionTotal
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Detections Today</p>
          </CardContent>
        </Card>

        {/* Species Detected */}
        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <CardContent className="p-4">
            <div className="text-2xl mb-1">🦁</div>
            <p className="text-2xl font-bold text-foreground">
              {speciesCount > 0 ? speciesCount : <span className="text-muted-foreground text-base">—</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Species Today</p>
          </CardContent>
        </Card>

        {/* Surveillance Area */}
        <Card className="card-gradient card-hover animate-fade-in" style={{ animationDelay: "0.25s" }}>
          <CardContent className="p-4">
            <div className="text-2xl mb-1">🗺️</div>
            <p className="text-2xl font-bold text-foreground">
              {surveillanceAreaKm2 > 0 ? (
                <span>{surveillanceAreaKm2}<span className="text-sm font-normal text-muted-foreground"> km²</span></span>
              ) : (
                <span className="text-muted-foreground text-base">—</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Under Surveillance</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Quick Actions Panel ──────────────────────────────────────────── */}
      <Card className="mb-6 sm:mb-8 card-gradient">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>⚡</span>
            Quick Actions
          </CardTitle>
          <CardDescription>Common operations — one click away</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickActionButton icon="📋" label="Generate Shift Brief" href="/dashboard#briefing" />
            <QuickActionButton icon="🗺️" label="Command Map" href="/sites" />
            <QuickActionButton icon="📦" label="Export Evidence" href="/playback" />
            <QuickActionButton
              icon="🤖"
              label="Run AI Analysis"
              href="/analytics"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Simulation / Demo entry point ───────────────────────────────── */}
      {!sitesLoading && !sitesError && (
        <Card className="mb-6 border border-border bg-muted/60 dark:bg-muted/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <span className="text-2xl">🎬</span>
              Show buyers how it works (Simulation)
            </CardTitle>
            <CardDescription>
              Open a site&apos;s live view with a demo camera feed and sample rail-safety
              alerts—no real devices required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sites && sites.length > 0 ? (
              <>
                <Link href={`/sites/${sites[0].id}?tab=live&simulation=1`}>
                  <Button className="bg-primary text-primary-foreground hover:opacity-90 min-h-[44px] touch-manipulation">
                    Open live simulation →
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2">
                  Uses site &quot;{sites[0].name}&quot;. You can pick any site from the list below
                  and use the simulation toggle there.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a site first, then open it and use the{" "}
                <strong>Enable simulation mode</strong> toggle on the site page to see the demo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── AI Insights + Live Alerts ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Recent AI Insights */}
        <Card className="card-gradient animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              Recent AI Insights
            </CardTitle>
            <CardDescription>
              Latest AI-generated recommendations — updated every analysis cycle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_AI_INSIGHTS.map((insight, idx) => (
                <div
                  key={insight.id}
                  className="flex gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{insight.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{insight.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.body}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 mt-0.5">{insight.time}</span>
                </div>
              ))}
              {/* Last AI scan time */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Last AI scan</span>
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                  {lastScanTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Alert Feed */}
        <LiveAlertFeed />
      </div>

      {/* ─── Sites List + Shift Briefing ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Sites */}
        <Card className="card-gradient animate-slide-up" id="sites">
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
                <p className="text-foreground text-sm font-medium mb-1">
                  ⚠️ Unable to connect to API server
                </p>
                <p className="text-muted-foreground text-xs">
                  Make sure the API server is running. Run{" "}
                  <code className="bg-muted px-1 rounded">npm run dev</code> in the root directory.
                </p>
              </div>
            ) : sites && sites.length > 0 ? (
              <div className="space-y-3">
                {sites.map(
                  (
                    site: {
                      id: string;
                      name: string;
                      address?: string | null;
                      latitude?: number;
                      longitude?: number;
                      description?: string | null;
                    },
                    index: number
                  ) => (
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
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {site.description}
                            </p>
                          )}
                        </div>
                        <span className="text-2xl ml-2">→</span>
                      </div>
                    </Link>
                  )
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📍</div>
                <p className="text-muted-foreground mb-1 font-medium">No sites configured yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by adding your first monitoring site
                </p>
                <Link href="/sites">
                  <Button variant="gradient" size="sm" className="mt-2">
                    + Add Your First Site
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shift Briefing Panel */}
        <div id="briefing">
          <ShiftBriefingPanel />
        </div>
      </div>
    </main>
  );
}
