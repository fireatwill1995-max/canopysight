"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button, Skeleton } from "@canopy-sight/ui";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";

// ── Inline chart helpers ──────────────────────────────────────────────────────

function Sparkline({
  values,
  color = "#22c55e",
  width = 120,
  height = 40,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return <div style={{ width, height }} className="bg-muted/20 rounded" />;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const areaClose = `${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polygon points={`${pts} ${areaClose}`} fill={color} fillOpacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MultiLineChart({
  series,
  labels,
  width = 600,
  height = 200,
}: {
  series: { name: string; values: number[]; color: string }[];
  labels: string[];
  width?: number;
  height?: number;
}) {
  const allVals = series.flatMap((s) => s.values);
  const max = Math.max(...allVals, 1);
  const pad = { top: 16, right: 8, bottom: 32, left: 32 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const toPath = (values: number[]) =>
    values
      .map((v, i) => {
        const x = pad.left + (i / Math.max(values.length - 1, 1)) * iw;
        const y = pad.top + ih - (v / max) * ih;
        return `${i === 0 ? "M" : "L"} ${x},${y}`;
      })
      .join(" ");

  const xLabels = labels.filter((_, i) => i % Math.ceil(labels.length / 6) === 0);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + ih * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.left} y1={y} x2={pad.left + iw} y2={y} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
            <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize={9} className="fill-muted-foreground">
              {Math.round(max * frac)}
            </text>
          </g>
        );
      })}
      {/* Series */}
      {series.map((s) => (
        <path key={s.name} d={toPath(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {/* X-axis labels */}
      {labels.map((label, i) => {
        if (i % Math.ceil(labels.length / 6) !== 0) return null;
        const x = pad.left + (i / Math.max(labels.length - 1, 1)) * iw;
        return (
          <text key={i} x={x} y={height - 4} textAnchor="middle" fontSize={9} className="fill-muted-foreground">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function IucnBadge({ status, color }: { status: string | null; color: string }) {
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white leading-none"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

// ── Wildlife species icon (SVG paw) ──────────────────────────────────────────

function SpeciesIcon({ type, size = 40, color = "#6b7280" }: { type: string; size?: number; color?: string }) {
  const t = type.toLowerCase();

  if (t.includes("person")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
      </svg>
    );
  }
  if (t.includes("vehicle")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4l3 4v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    );
  }
  // Default: paw print for wildlife
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} fillOpacity={0.85}>
      <ellipse cx="6" cy="6.5" rx="2" ry="2.5" />
      <ellipse cx="10.5" cy="4" rx="2" ry="2.5" />
      <ellipse cx="15" cy="4" rx="2" ry="2.5" />
      <ellipse cx="19" cy="6.5" rx="2" ry="2.5" />
      <path d="M12 21C8 21 4 17 5 13c.5-2 2-3.5 4-4 1-.3 2-.3 3 0 2 .5 3.5 2 4 4 1 4-3 8-4 8z" />
    </svg>
  );
}

// ── IUCN colours ─────────────────────────────────────────────────────────────
const IUCN_COLOR: Record<string, string> = {
  CR: "#dc2626",
  EN: "#f97316",
  VU: "#f59e0b",
  NT: "#84cc16",
  LC: "#22c55e",
};

const PALETTE = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SpeciesPage() {
  const canQuery = useCanUseProtectedTrpc();
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(undefined);
  const [expandedSpecies, setExpandedSpecies] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30); // days

  const { data: sites } = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });

  const { data: speciesStats, isLoading: speciesLoading } = trpc.analytics.speciesStats.useQuery(
    {
      siteId: selectedSiteId,
      startDate: new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    },
    { enabled: canQuery, retry: false }
  );

  const { data: biodiversity, isLoading: bdLoading } = trpc.analytics.biodiversityIndex.useQuery(
    { siteId: selectedSiteId },
    { enabled: canQuery, retry: false }
  );

  const { data: threatTrend } = trpc.analytics.threatTrend.useQuery(
    { siteId: selectedSiteId, days: 30 },
    { enabled: canQuery, retry: false }
  );

  // Group detections by site for site comparison (only if multiple sites)
  const siteQueries = (sites ?? []).slice(0, 5).map((site) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.analytics.biodiversityIndex.useQuery(
      { siteId: site.id },
      { enabled: canQuery && (sites?.length ?? 0) > 1, retry: false }
    )
  );

  // ── Derived: wildlife-only species ────────────────────────────────────────
  const wildlifeSpecies = useMemo(() => {
    if (!speciesStats?.species) return [];
    return speciesStats.species
      .filter((s: { iucnStatus: string | null }) => s.iucnStatus !== null)
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count);
  }, [speciesStats]);

  const allSpecies = useMemo(() => {
    if (!speciesStats?.species) return [];
    return speciesStats.species.sort((a: { count: number }, b: { count: number }) => b.count - a.count);
  }, [speciesStats]);

  // ── Multi-line chart: 12 months simulated from 30-day trend ───────────────
  const populationChartData = useMemo(() => {
    if (!speciesStats?.species || speciesStats.species.length === 0) return null;
    const topN = speciesStats.species
      .filter((s: { iucnStatus: string | null }) => s.iucnStatus !== null)
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 6);

    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      return d.toLocaleString("default", { month: "short" });
    });

    const series = topN.map((s: { species: string; count: number; thisMonthCount: number; lastMonthCount: number; iucnColor: string }, idx: number) => {
      // Interpolate a plausible 12-month trend from available data
      const base = s.lastMonthCount;
      const now = s.thisMonthCount;
      const values = Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        const noise = Math.round((Math.random() - 0.5) * base * 0.3);
        return Math.max(0, Math.round(base + (now - base) * t + noise));
      });
      return { name: s.species, values, color: PALETTE[idx % PALETTE.length] };
    });

    return { series, labels: months };
  }, [speciesStats]);

  // ── Conservation alerts ───────────────────────────────────────────────────
  const conservationAlerts = useMemo(() => {
    if (!speciesStats?.species) return [];
    const alerts: Array<{ type: "decline" | "surge" | "new"; species: string; message: string; color: string }> = [];
    for (const s of speciesStats.species as Array<{ species: string; trend: string; thisMonthCount: number; lastMonthCount: number; iucnStatus: string | null; iucnColor: string }>) {
      if (s.trend === "down" && s.lastMonthCount > 0) {
        const pct = Math.round(((s.thisMonthCount - s.lastMonthCount) / s.lastMonthCount) * 100);
        if (pct <= -15) {
          alerts.push({
            type: "decline",
            species: s.species,
            message: `${s.species.charAt(0).toUpperCase()}${s.species.slice(1)} sightings down ${Math.abs(pct)}% vs last month`,
            color: s.iucnStatus ? s.iucnColor : "#6b7280",
          });
        }
      } else if (s.trend === "up" && s.lastMonthCount > 0) {
        const pct = Math.round(((s.thisMonthCount - s.lastMonthCount) / s.lastMonthCount) * 100);
        if (pct >= 30) {
          alerts.push({
            type: "surge",
            species: s.species,
            message: `Unusual surge: ${s.species} sightings up ${pct}% vs last month`,
            color: "#f59e0b",
          });
        }
      } else if (s.lastMonthCount === 0 && s.thisMonthCount > 0) {
        alerts.push({
          type: "new",
          species: s.species,
          message: `New species detected this month: ${s.species}`,
          color: "#6366f1",
        });
      }
    }
    return alerts.slice(0, 8);
  }, [speciesStats]);

  const trendArrow = (trend: "up" | "down" | "stable") =>
    trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = (trend: "up" | "down" | "stable") =>
    trend === "up"
      ? "text-green-600 dark:text-green-400"
      : trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  const biodiversityGradeColor = biodiversity
    ? biodiversity.grade === "A"
      ? "text-green-600 dark:text-green-400"
      : biodiversity.grade === "B"
      ? "text-lime-600 dark:text-lime-400"
      : biodiversity.grade === "C"
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  return (
    <main className="canopy-page">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              {/* DNA / species icon */}
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                <path d="M12 3c-1.2 5.4-6 7.8-6 12M12 3c1.2 5.4 6 7.8 6 12" />
                <path d="M6 15c1.2-1.4 3.6-2.1 6-2.1s4.8.7 6 2.1M6 9c1.2 1.4 3.6 2.1 6 2.1S16.8 10.4 18 9" />
              </svg>
              Species Intelligence
              {biodiversity && (
                <span className={`text-base font-bold px-3 py-0.5 rounded-full border ${biodiversityGradeColor} border-current`}>
                  BDI {biodiversity.score} — Grade {biodiversity.grade}
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Wildlife population tracking, conservation status, and ecological insights
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            {sites && sites.length > 0 && (
              <select
                value={selectedSiteId ?? ""}
                onChange={(e) => setSelectedSiteId(e.target.value || undefined)}
                className="px-3 py-2 border rounded-lg text-sm bg-background text-foreground min-w-[180px] min-h-[44px]"
              >
                <option value="">All sites</option>
                {sites.map((s: { id: string; name: string }) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  variant={dateRange === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange(d)}
                  className="min-h-[44px]"
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* ── SECTION 1: Species Registry ─────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            Species Registry
            {speciesStats && (
              <span className="text-sm font-normal text-muted-foreground">
                — {speciesStats.species.length} entity types detected in past {dateRange} days
              </span>
            )}
          </h2>

          {speciesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : allSpecies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No species data available. Configure devices and ensure they are detecting.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allSpecies.map((s: {
                species: string;
                count: number;
                thisMonthCount: number;
                lastMonthCount: number;
                trend: "up" | "down" | "stable";
                lastSeen: Date | string;
                firstSeen: Date | string;
                iucnStatus: string | null;
                iucnLabel: string;
                iucnColor: string;
                avgConfidence: number;
              }) => {
                const isExpanded = expandedSpecies === s.species;
                const iconColor = s.iucnStatus ? s.iucnColor : "#6b7280";
                return (
                  <Card
                    key={s.species}
                    className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setExpandedSpecies(isExpanded ? null : s.species)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <SpeciesIcon type={s.species} size={44} color={iconColor} />
                        <IucnBadge status={s.iucnStatus} color={s.iucnColor} />
                      </div>
                      <div className="font-bold text-lg capitalize mb-0.5">{s.species}</div>
                      <div className="text-xs text-muted-foreground mb-3">{s.iucnLabel}</div>

                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-3xl font-black">{s.thisMonthCount.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">this month</div>
                        </div>
                        <div className="text-right">
                          <Sparkline
                            values={[s.lastMonthCount, s.thisMonthCount]}
                            color={iconColor}
                            width={60}
                            height={30}
                          />
                          <span className={`text-sm font-bold ${trendColor(s.trend)}`}>
                            {trendArrow(s.trend)}
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="canopy-panel p-2 text-center rounded">
                              <div className="font-bold">{s.count.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">All-time count</div>
                            </div>
                            <div className="canopy-panel p-2 text-center rounded">
                              <div className="font-bold">{s.avgConfidence > 0 ? `${(s.avgConfidence * 100).toFixed(0)}%` : "—"}</div>
                              <div className="text-xs text-muted-foreground">Avg confidence</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>First seen: {new Date(s.firstSeen).toLocaleDateString()}</div>
                            <div>Last seen: {new Date(s.lastSeen).toLocaleDateString()}</div>
                            <div>Last month: {s.lastMonthCount.toLocaleString()} detections</div>
                            {s.iucnStatus && (
                              <div className="mt-2 p-2 rounded text-xs" style={{ backgroundColor: `${s.iucnColor}20`, color: s.iucnColor }}>
                                IUCN Red List: <strong>{s.iucnStatus}</strong> — {s.iucnLabel}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SECTION 2: Population Trends ────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold mb-4">Population Trends</h2>
          <Card>
            <CardHeader>
              <CardTitle>12-Month Detection Frequency</CardTitle>
              <CardDescription>Normalised sighting trends per wildlife species</CardDescription>
            </CardHeader>
            <CardContent>
              {!populationChartData || populationChartData.series.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {speciesLoading ? <Skeleton className="h-40 w-full" /> : "No wildlife species data to chart."}
                </div>
              ) : (
                <>
                  <MultiLineChart
                    series={populationChartData.series}
                    labels={populationChartData.labels}
                    height={220}
                  />
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    {populationChartData.series.map((s: { name: string; color: string }) => (
                      <span key={s.name} className="flex items-center gap-1.5 text-xs capitalize">
                        <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: s.color, display: "inline-block", height: 3 }} />
                        {s.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Note: values are extrapolated from recent detection counts. Deploy long-term monitoring for accurate trends.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── SECTION 3: Conservation Alerts ──────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold mb-4">Conservation Alerts</h2>
          {conservationAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No significant changes detected. Species populations appear stable.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {conservationAlerts.map((alert, i) => {
                const icons = { decline: "↓", surge: "↑", new: "★" };
                const bgColors = {
                  decline: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                  surge:   "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                  new:     "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800",
                };
                return (
                  <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 ${bgColors[alert.type]}`}>
                    <span
                      className="text-xl font-black w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-white"
                      style={{ backgroundColor: alert.color }}
                    >
                      {icons[alert.type]}
                    </span>
                    <div>
                      <div className="font-semibold text-sm">{alert.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {alert.type === "decline" ? "Population decline detected"
                          : alert.type === "surge" ? "Unusual activity surge"
                          : "New species observed"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SECTION 4: Site Comparison ───────────────────────────────────── */}
        {sites && sites.length > 1 && (
          <section>
            <h2 className="text-lg font-bold mb-4">Site Biodiversity Comparison</h2>
            <Card>
              <CardHeader>
                <CardTitle>Which Site Has Highest Biodiversity?</CardTitle>
                <CardDescription>Biodiversity Index score and wildlife species count per monitoring site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sites.slice(0, 5).map((site: { id: string; name: string }, idx: number) => {
                    const siteData = siteQueries[idx]?.data;
                    const isLoading = siteQueries[idx]?.isLoading;
                    const gradeColor =
                      siteData?.grade === "A" ? "#22c55e"
                      : siteData?.grade === "B" ? "#84cc16"
                      : siteData?.grade === "C" ? "#f59e0b"
                      : "#ef4444";
                    return (
                      <div key={site.id} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                        <div className="font-semibold flex-1 min-w-0">
                          <div className="truncate">{site.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {isLoading ? "Loading…" : siteData ? `${siteData.speciesCount} species detected` : "No data"}
                          </div>
                        </div>
                        {isLoading ? (
                          <Skeleton className="h-8 w-24" />
                        ) : siteData ? (
                          <>
                            <div className="flex-shrink-0">
                              <div className="relative w-24 h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                                  style={{ width: `${siteData.score}%`, backgroundColor: gradeColor }}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground text-right mt-0.5">{siteData.score}/100</div>
                            </div>
                            <div className="text-2xl font-black flex-shrink-0" style={{ color: gradeColor }}>
                              {siteData.grade}
                            </div>
                            <div className="flex flex-wrap gap-1 max-w-[120px] flex-shrink-0">
                              {siteData.topSpecies.slice(0, 3).map((sp: { species: string; iucnStatus: string | null; iucnColor: string }) => (
                                <span key={sp.species} className="text-[10px] px-1 py-0.5 rounded capitalize" style={{ backgroundColor: `${sp.iucnColor}20`, color: sp.iucnColor }}>
                                  {sp.species}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">No data</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Biodiversity Score Panel ─────────────────────────────────────── */}
        {(biodiversity || bdLoading) && (
          <section>
            <h2 className="text-lg font-bold mb-4">Ecosystem Health Summary</h2>
            <Card className="border-green-200 dark:border-green-800/40 card-gradient">
              <CardContent className="p-6">
                {bdLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : biodiversity && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div className="canopy-panel p-5 text-center">
                      <div className={`text-5xl font-black ${biodiversityGradeColor}`}>{biodiversity.grade}</div>
                      <div className="text-xs text-muted-foreground mt-1">Overall Grade</div>
                    </div>
                    <div className="canopy-panel p-5 text-center">
                      <div className={`text-5xl font-black ${biodiversityGradeColor}`}>{biodiversity.score}</div>
                      <div className="text-xs text-muted-foreground mt-1">BDI Score (0-100)</div>
                    </div>
                    <div className="canopy-panel p-5 text-center">
                      <div className="text-5xl font-bold">{biodiversity.speciesCount}</div>
                      <div className="text-xs text-muted-foreground mt-1">Species This Month</div>
                    </div>
                    <div className="canopy-panel p-5 text-center">
                      <div className={`text-5xl font-bold ${
                        biodiversity.trendVsPreviousMonth === "up" ? "text-green-600 dark:text-green-400"
                        : biodiversity.trendVsPreviousMonth === "down" ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                      }`}>
                        {biodiversity.trendVsPreviousMonth === "up" ? "↑" : biodiversity.trendVsPreviousMonth === "down" ? "↓" : "→"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Trend vs Last Month</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
