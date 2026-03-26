"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button, CardSkeleton, Skeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import dynamic from "next/dynamic";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";

// Lazy load heavy visualization components
const FilterPanel = dynamic(
  () => import("@/components/filter-panel").then((mod) => ({ default: mod.FilterPanel })),
  { loading: () => <CardSkeleton />, ssr: false }
);

const HeatmapVisualization = dynamic(
  () => import("@/components/heatmap-visualization").then((mod) => ({ default: mod.HeatmapVisualization })),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
);

const DetectionTimeline = dynamic(
  () => import("@/components/detection-timeline").then((mod) => ({ default: mod.DetectionTimeline })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);

const ReportGenerator = dynamic(
  () => import("@/components/report-generator").then((mod) => ({ default: mod.ReportGenerator })),
  { loading: () => <CardSkeleton />, ssr: false }
);

// ── Inline micro-chart helpers (no external chart lib required) ─────────────

function Sparkline({ values, color = "#22c55e", height = 32 }: { values: number[]; color?: string; height?: number }) {
  if (!values || values.length < 2) return <div style={{ height }} />;
  const max = Math.max(...values, 1);
  const w = 80;
  const h = height;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MiniBarChart({ data, labelKey, valueKey, color = "#6366f1" }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((d, i) => {
        const pct = (Number(d[valueKey]) / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color, opacity: 0.8 }}
              className="w-full rounded-sm transition-all group-hover:opacity-100"
            />
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground hidden group-hover:block whitespace-nowrap bg-background border px-1 rounded z-10">
              {String(d[labelKey])}: {String(d[valueKey])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ThreatBand({ level }: { level: "low" | "medium" | "high" | "critical" }) {
  const colors = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444", critical: "#7f1d1d" };
  return (
    <span
      className="inline-block w-3 h-3 rounded-sm mr-1"
      style={{ backgroundColor: colors[level], display: "inline-block" }}
    />
  );
}

function IucnBadge({ status, label, color }: { status: string | null; label: string; color: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">{label}</span>;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white leading-none"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type DetectionType = "person" | "vehicle" | "animal" | "unknown";
type DetectionItem = {
  id: string;
  type: string;
  timestamp: Date | string;
  confidence?: number;
  riskScore?: number | null;
  site?: { name?: string };
  device?: { name?: string };
  [key: string]: unknown;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const canQuery = useCanUseProtectedTrpc();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreatDay, setSelectedThreatDay] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "species" | "threats" | "coverage">("overview");

  const [filters, setFilters] = useState({
    siteId: undefined as string | undefined,
    deviceId: undefined as string | undefined,
    types: [] as DetectionType[],
    minRiskScore: undefined as number | undefined,
    maxRiskScore: undefined as number | undefined,
    minConfidence: undefined as number | undefined,
    maxConfidence: undefined as number | undefined,
    zones: [] as string[],
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: heatmapData } = trpc.analytics.heatmap.useQuery(
    { siteId: filters.siteId as string, startDate: filters.startDate, endDate: filters.endDate },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  const { data: apiDetections } = trpc.detection.list.useQuery(
    {
      siteId: filters.siteId,
      deviceId: filters.deviceId,
      types: filters.types.length > 0 ? (filters.types as DetectionType[]) : undefined,
      minRiskScore: filters.minRiskScore,
      zones: filters.zones.length > 0 ? filters.zones : undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: 100,
    },
    { enabled: canQuery, retry: false }
  );
  const detections = apiDetections;

  const { data: behavioralPatterns } = trpc.analytics.behavioralPatterns.useQuery(
    { siteId: filters.siteId, startDate: filters.startDate, endDate: filters.endDate },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  const { data: occupancyByZone } = trpc.analytics.occupancyByZone.useQuery(
    { siteId: filters.siteId as string, startDate: filters.startDate, endDate: filters.endDate },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  const { data: timeOfDayPressure } = trpc.analytics.timeOfDayPressure.useQuery(
    { siteId: filters.siteId, startDate: filters.startDate, endDate: filters.endDate },
    { enabled: canQuery, retry: false }
  );

  const { data: speciesStats } = trpc.analytics.speciesStats.useQuery(
    {
      siteId: filters.siteId,
      startDate: filters.startDate.toISOString(),
      endDate: filters.endDate.toISOString(),
    },
    { enabled: canQuery, retry: false }
  );

  const { data: threatTrend } = trpc.analytics.threatTrend.useQuery(
    { siteId: filters.siteId, days: 30 },
    { enabled: canQuery, retry: false }
  );

  const { data: biodiversity } = trpc.analytics.biodiversityIndex.useQuery(
    { siteId: filters.siteId },
    { enabled: canQuery, retry: false }
  );

  const { data: hotspots } = trpc.analytics.incidentHotspots.useQuery(
    { siteId: filters.siteId, days: 90 },
    { enabled: canQuery, retry: false }
  );

  const { data: patrolCoverage } = trpc.analytics.patrolCoverage.useQuery(
    { siteId: filters.siteId as string, date: new Date().toISOString().split("T")[0] },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  const { data: sites }   = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });
  const { data: devices } = trpc.device.list.useQuery({ siteId: filters.siteId }, { enabled: canQuery });
  const { data: zones }   = trpc.zone.list.useQuery({ siteId: filters.siteId }, { enabled: canQuery && !!filters.siteId, retry: false });

  // ── Client-side filtering ────────────────────────────────────────────────
  const rawDetections = detections?.items;
  const detectionItems = useMemo((): DetectionItem[] => {
    let items: DetectionItem[] = (rawDetections ?? []) as DetectionItem[];
    if (filters.maxRiskScore !== undefined)
      items = items.filter((item) => item.riskScore == null || item.riskScore <= filters.maxRiskScore!);
    if (filters.maxConfidence !== undefined)
      items = items.filter((item: DetectionItem) => (item.confidence as number | undefined) === undefined || (item.confidence as number) <= filters.maxConfidence!);
    if (filters.minConfidence !== undefined)
      items = items.filter((item: DetectionItem) => (item.confidence as number | undefined) === undefined || (item.confidence as number) >= filters.minConfidence!);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) =>
        item.type?.toLowerCase().includes(query) ||
        item.site?.name?.toLowerCase().includes(query) ||
        item.device?.name?.toLowerCase().includes(query) ||
        item.id?.toLowerCase().includes(query)
      );
    }
    return items;
  }, [rawDetections, filters.maxRiskScore, filters.minConfidence, filters.maxConfidence, searchQuery]);

  const trends = {
    totalEvents: detectionItems.length || 0,
    byType: detectionItems.reduce((acc: Record<string, number>, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}),
    byDay: detectionItems.reduce((acc: Record<string, number>, event) => {
      const day = new Date(event.timestamp).toLocaleDateString();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {}),
  };

  const { addToast } = useToast();

  const handleExport = () => {
    try {
      const data = detectionItems.map((item: DetectionItem) => ({
        id: item.id,
        type: item.type,
        timestamp: new Date(item.timestamp).toISOString(),
        confidence: item.confidence,
        riskScore: item.riskScore,
        site: item.site?.name,
        device: item.device?.name,
      }));
      if (data.length === 0) {
        addToast({ type: "warning", title: "No data to export", description: "Please select filters that return detection data" });
        return;
      }
      const csv = [
        ["ID", "Type", "Timestamp", "Confidence", "Risk Score", "Site", "Device"],
        ...data.map((item) => [
          item.id, item.type, item.timestamp,
          item.confidence?.toFixed(2) || "", item.riskScore || "",
          item.site || "", item.device || "",
        ]),
      ]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast({ type: "success", title: "Export successful", description: `Exported ${data.length} detection events to CSV` });
    } catch (error) {
      addToast({ type: "error", title: "Export failed", description: error instanceof Error ? error.message : "Failed to export data" });
    }
  };

  // ── IUCN breakdown from species stats ────────────────────────────────────
  const iucnBreakdown = useMemo(() => {
    if (!speciesStats?.species) return { CR: 0, EN: 0, VU: 0, LC: 0, NT: 0, human: 0 };
    const counts = { CR: 0, EN: 0, VU: 0, LC: 0, NT: 0, human: 0 };
    for (const s of speciesStats.species) {
      if (!s.iucnStatus) counts.human += s.count;
      else if (s.iucnStatus === "CR") counts.CR += s.count;
      else if (s.iucnStatus === "EN") counts.EN += s.count;
      else if (s.iucnStatus === "VU") counts.VU += s.count;
      else if (s.iucnStatus === "NT") counts.NT += s.count;
      else counts.LC += s.count;
    }
    return counts;
  }, [speciesStats]);

  // ── Biodiversity donut data ───────────────────────────────────────────────
  const donutData = [
    { label: "CR", value: iucnBreakdown.CR, color: "#dc2626" },
    { label: "EN", value: iucnBreakdown.EN, color: "#f97316" },
    { label: "VU", value: iucnBreakdown.VU, color: "#f59e0b" },
    { label: "NT", value: iucnBreakdown.NT, color: "#84cc16" },
    { label: "LC", value: iucnBreakdown.LC, color: "#22c55e" },
  ].filter((d) => d.value > 0);

  function DonutChart({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <div style={{ width: size, height: size }} className="rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">No data</div>;
    let offset = 0;
    const r = size / 2 - 8;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const slices = data.map((d) => {
      const fraction = d.value / total;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const rotation = offset * 360 - 90;
      offset += fraction;
      return { ...d, dash, gap, rotation };
    });
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={14}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={0}
            transform={`rotate(${s.rotation} ${cx} ${cy})`}
            className="transition-all"
          />
        ))}
        <circle cx={cx} cy={cy} r={r - 10} fill="transparent" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-foreground font-bold" fontSize={size / 8}>
          {data.length}
        </text>
        <text x={cx} y={cy + size / 10} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" fontSize={size / 12}>
          spp.
        </text>
      </svg>
    );
  }

  const biodiversityGradeColor = biodiversity
    ? biodiversity.grade === "A" ? "text-green-600 dark:text-green-400"
    : biodiversity.grade === "B" ? "text-lime-600 dark:text-lime-400"
    : biodiversity.grade === "C" ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  const trendArrow = (trend: "up" | "down" | "stable") =>
    trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = (trend: "up" | "down" | "stable") =>
    trend === "up" ? "text-green-600 dark:text-green-400"
    : trend === "down" ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  const hotspotRiskBadge = (level: "low" | "medium" | "high" | "critical") => {
    const map = {
      low:      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      medium:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      high:     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      critical: "bg-red-900 text-red-100 dark:bg-red-900 dark:text-red-100",
    };
    return map[level];
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="canopy-page">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
              Analytics
              {biodiversity && (
                <span className={`text-base font-bold px-3 py-0.5 rounded-full border ${biodiversityGradeColor} border-current`}>
                  BDI {biodiversity.score} — {biodiversity.grade}
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Advanced insights, species intelligence &amp; threat analysis</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial sm:min-w-[250px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search detections..."
                aria-label="Search detections"
                className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Button onClick={handleExport} variant="outline" className="min-h-[44px] touch-manipulation whitespace-nowrap" disabled={detectionItems.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border pb-0 mt-4 overflow-x-auto">
          {(["overview", "species", "threats", "coverage"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "species" && "Species Intelligence"}
              {tab === "threats" && "Threat Timeline"}
              {tab === "coverage" && "Coverage & Hotspots"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="lg:col-span-1">
          <FilterPanel
            sites={sites || []}
            devices={devices || []}
            filters={filters}
            availableZones={zones || []}
            onFiltersChange={(next) =>
              setFilters((prev) => ({
                ...prev,
                ...next,
                types: (next.types as DetectionType[] | undefined) ?? prev.types,
                zones: next.zones ?? prev.zones,
                startDate: next.startDate ?? prev.startDate,
                endDate: next.endDate ?? prev.endDate,
              }))
            }
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {/* Search banner */}
          {searchQuery && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Found <strong>{detectionItems.length}</strong> result{detectionItems.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="min-h-[32px]">Clear</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════════════════════ OVERVIEW TAB ════════════════════════ */}
          {activeTab === "overview" && (
            <>
              {/* Biodiversity Intelligence Panel */}
              <Card className="card-gradient border-green-200 dark:border-green-800/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Biodiversity Intelligence</CardTitle>
                      <CardDescription>Ecosystem health &amp; species richness score</CardDescription>
                    </div>
                    {biodiversity && (
                      <span className={`text-4xl font-black ${biodiversityGradeColor}`}>{biodiversity.grade}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!biodiversity ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                      <div className="flex flex-col items-center gap-2">
                        <DonutChart data={donutData} size={120} />
                        <div className="flex flex-wrap gap-1 justify-center max-w-[140px]">
                          {donutData.map((d) => (
                            <span key={d.label} className="flex items-center gap-1 text-[10px]">
                              <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: d.color }} />
                              {d.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="canopy-panel p-4 text-center">
                          <div className={`text-4xl font-black ${biodiversityGradeColor}`}>{biodiversity.score}</div>
                          <div className="text-xs text-muted-foreground mt-1">BDI Score (0-100)</div>
                          <div className={`text-sm font-semibold mt-1 ${trendColor(biodiversity.trendVsPreviousMonth)}`}>
                            {trendArrow(biodiversity.trendVsPreviousMonth)} vs last month
                          </div>
                        </div>
                        <div className="canopy-panel p-4 text-center">
                          <div className="text-4xl font-bold text-foreground">{biodiversity.speciesCount}</div>
                          <div className="text-xs text-muted-foreground mt-1">Species Detected</div>
                        </div>
                        <div className="canopy-panel p-4">
                          <div className="text-xs font-semibold text-muted-foreground mb-2">Top Species</div>
                          <div className="space-y-1">
                            {biodiversity.topSpecies.slice(0, 4).map((s) => (
                              <div key={s.species} className="flex items-center justify-between text-xs">
                                <span className="capitalize font-medium">{s.species}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">{s.count}</span>
                                  {s.iucnStatus && (
                                    <span className="px-1 rounded text-[9px] font-bold text-white" style={{ backgroundColor: s.iucnColor }}>
                                      {s.iucnStatus}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trends Card */}
              <Card className="card-gradient">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Trends &amp; Statistics</CardTitle>
                      <CardDescription>Detection statistics and insights</CardDescription>
                    </div>
                    {detectionItems.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleExport} className="min-h-[32px]">Export CSV</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {detections === undefined ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : detectionItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No detection data available for the selected filters</p>
                      <p className="text-sm mt-2">Try adjusting your date range or filters</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="canopy-panel p-4">
                          <div className="text-3xl font-bold text-foreground">{trends.totalEvents}</div>
                          <div className="text-sm text-muted-foreground mt-1">Total Events</div>
                        </div>
                        <div className="canopy-panel p-4">
                          <div className="text-3xl font-bold text-foreground">{Object.keys(trends.byType).length}</div>
                          <div className="text-sm text-muted-foreground mt-1">Event Types</div>
                        </div>
                        <div className="canopy-panel p-4">
                          <div className="text-3xl font-bold text-foreground">{Object.keys(trends.byDay).length}</div>
                          <div className="text-sm text-muted-foreground mt-1">Active Days</div>
                        </div>
                      </div>
                      {/* Mini bar chart of events by type */}
                      {Object.keys(trends.byType).length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-muted-foreground mb-2">Events by type</div>
                          <MiniBarChart
                            data={Object.entries(trends.byType).map(([type, count]) => ({ type, count }))}
                            labelKey="type"
                            valueKey="count"
                            color="#6366f1"
                          />
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(trends.byType).map(([type, count]) => (
                              <span key={type} className="text-xs text-muted-foreground capitalize">{type}: {count}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Heatmap */}
              {!filters.siteId ? (
                <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20">
                  <CardHeader>
                    <CardTitle>Heatmap</CardTitle>
                    <CardDescription>Spatial distribution of detections for a site</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="font-medium text-foreground">Select a site to view the heatmap</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">Choose a site in the filters to load spatial analytics.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : heatmapData ? (
                <HeatmapVisualization
                  data={heatmapData.data?.map((p: { x: number; y: number; intensity?: number }) => ({ x: p.x, y: p.y, intensity: p.intensity || 1 })) || []}
                />
              ) : (
                <Card><CardContent className="p-8"><Skeleton className="h-64 w-full rounded-lg" /><p className="text-sm text-muted-foreground mt-2">Loading heatmap…</p></CardContent></Card>
              )}

              {/* Detection Timeline */}
              {detectionItems.length > 0 && (
                <DetectionTimeline
                  events={detectionItems.map((d) => ({ id: d.id, type: d.type, timestamp: d.timestamp, confidence: d.confidence ?? 0 }))}
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                />
              )}

              {/* Behavioral Patterns */}
              {behavioralPatterns && (
                <Card className="card-gradient">
                  <CardHeader>
                    <CardTitle>Behavioral Patterns</CardTitle>
                    <CardDescription>AI-detected patterns and anomalies</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {behavioralPatterns.patterns && behavioralPatterns.patterns.length > 0 ? (
                        behavioralPatterns.patterns.map((pattern, idx: number) => (
                          <div key={idx} className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-base">{pattern.type}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{pattern.description}</div>
                              </div>
                              <div className="ml-4 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                <div className="text-xs font-medium text-blue-700 dark:text-blue-300">{Math.round(pattern.confidence * 100)}% confidence</div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No patterns detected</p>
                          <p className="text-sm mt-1">Patterns will appear here when AI detects behavioral anomalies</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Occupancy by zone */}
              {filters.siteId && occupancyByZone && (
                <Card>
                  <CardHeader>
                    <CardTitle>Occupancy by Zone</CardTitle>
                    <CardDescription>Overcrowding, pinch points, clustering in waiting areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {occupancyByZone.byZone && occupancyByZone.byZone.length > 0 ? (
                      <div className="space-y-2">
                        {occupancyByZone.byZone.map((row: { zoneId: string; count: number }) => (
                          <div key={row.zoneId} className="flex items-center gap-4 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                            <span className="font-mono text-sm">{row.zoneId}</span>
                            <span className="font-semibold">{row.count}</span>
                            <span className="text-sm text-muted-foreground">detections</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No zone occupancy data in this period</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Time-of-day pressure */}
              {timeOfDayPressure && (
                <Card>
                  <CardHeader>
                    <CardTitle>Time-of-day Pressure</CardTitle>
                    <CardDescription>Rush hours, out-of-hours activity, lone worker context</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {timeOfDayPressure.byHour && timeOfDayPressure.byHour.some((h: { count: number }) => h.count > 0) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {timeOfDayPressure.byHour.map((row: { hour: number; count: number; label: string }) => (
                          <div
                            key={row.hour}
                            className={`p-2 rounded text-center text-sm ${
                              row.label === "Out-of-hours"
                                ? "bg-amber-100 dark:bg-amber-900/30"
                                : row.label === "Peak"
                                ? "bg-orange-100 dark:bg-orange-900/30"
                                : "bg-gray-100 dark:bg-gray-800/50"
                            }`}
                          >
                            <div className="font-semibold">{row.hour}:00</div>
                            <div className="text-muted-foreground">{row.count}</div>
                            <div className="text-xs mt-1">{row.label}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No time-of-day data in this period</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <ReportGenerator siteId={filters.siteId} startDate={filters.startDate} endDate={filters.endDate} />
            </>
          )}

          {/* ════════════════════════ SPECIES TAB ════════════════════════ */}
          {activeTab === "species" && (
            <>
              {/* Species Tracking Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Species Detection Registry</CardTitle>
                  <CardDescription>All detected entities with IUCN conservation status, trends, and confidence</CardDescription>
                </CardHeader>
                <CardContent>
                  {!speciesStats ? (
                    <div className="space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : speciesStats.species.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No species data. Select a site or extend the date range.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-2 font-semibold">Species / Type</th>
                            <th className="pb-2 font-semibold text-right">Count</th>
                            <th className="pb-2 font-semibold text-center">Trend</th>
                            <th className="pb-2 font-semibold">Last Seen</th>
                            <th className="pb-2 font-semibold">IUCN</th>
                            <th className="pb-2 font-semibold text-right">Confidence</th>
                            <th className="pb-2 font-semibold">7-day</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {speciesStats.species
                            .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
                            .map((s: {
                              species: string;
                              count: number;
                              trend: "up" | "down" | "stable";
                              lastSeen: Date | string;
                              iucnStatus: string | null;
                              iucnLabel: string;
                              iucnColor: string;
                              avgConfidence: number;
                              thisMonthCount: number;
                              lastMonthCount: number;
                            }) => (
                            <tr key={s.species} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 pr-4 font-medium capitalize">{s.species}</td>
                              <td className="py-3 text-right font-mono">{s.count.toLocaleString()}</td>
                              <td className="py-3 text-center">
                                <span className={`font-bold text-base ${trendColor(s.trend)}`}>
                                  {trendArrow(s.trend)}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">
                                  {s.lastMonthCount > 0
                                    ? `${Math.abs(Math.round(((s.thisMonthCount - s.lastMonthCount) / s.lastMonthCount) * 100))}%`
                                    : "—"}
                                </span>
                              </td>
                              <td className="py-3 text-muted-foreground text-xs">
                                {new Date(s.lastSeen).toLocaleDateString()}
                              </td>
                              <td className="py-3">
                                <IucnBadge status={s.iucnStatus} label={s.iucnLabel} color={s.iucnColor} />
                              </td>
                              <td className="py-3 text-right font-mono text-xs">
                                {s.avgConfidence > 0 ? `${(s.avgConfidence * 100).toFixed(0)}%` : "—"}
                              </td>
                              <td className="py-3">
                                <Sparkline
                                  values={[
                                    s.lastMonthCount,
                                    Math.round(s.lastMonthCount * 0.9),
                                    Math.round(s.lastMonthCount * 1.1),
                                    Math.round(s.thisMonthCount * 0.8),
                                    Math.round(s.thisMonthCount * 0.9),
                                    s.thisMonthCount,
                                    s.count,
                                  ]}
                                  color={s.iucnColor}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* IUCN Status Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Conservation Status Breakdown</CardTitle>
                  <CardDescription>Detection events by IUCN Red List category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { key: "CR", label: "Critically Endangered", color: "#dc2626", count: iucnBreakdown.CR },
                      { key: "EN", label: "Endangered",             color: "#f97316", count: iucnBreakdown.EN },
                      { key: "VU", label: "Vulnerable",             color: "#f59e0b", count: iucnBreakdown.VU },
                      { key: "NT", label: "Near Threatened",        color: "#84cc16", count: iucnBreakdown.NT },
                      { key: "LC", label: "Least Concern",          color: "#22c55e", count: iucnBreakdown.LC },
                      { key: "—",  label: "Human/Vehicle",          color: "#6b7280", count: iucnBreakdown.human },
                    ].map((item) => (
                      <div key={item.key} className="canopy-panel p-4 flex items-center gap-3">
                        <div className="w-3 h-10 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <div>
                          <div className="text-2xl font-bold">{item.count.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{item.label}</div>
                          <div className="text-xs font-bold mt-0.5" style={{ color: item.color }}>{item.key}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ════════════════════════ THREATS TAB ════════════════════════ */}
          {activeTab === "threats" && (
            <>
              {/* 30-day Threat Intelligence Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>30-Day Threat Intelligence Timeline</CardTitle>
                  <CardDescription>Daily threat level — click a bar to inspect that day</CardDescription>
                </CardHeader>
                <CardContent>
                  {!threatTrend ? (
                    <Skeleton className="h-48 w-full" />
                  ) : threatTrend.trend.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No threat data for the past 30 days.</p>
                  ) : (
                    <>
                      {/* Color band chart */}
                      <div className="relative" style={{ height: 160 }}>
                        <div className="flex items-end h-full gap-0.5">
                          {threatTrend.trend.map((day: {
                            date: Date | string;
                            avgRiskScore: number;
                            alertCount: number;
                            detectionCount: number;
                            threatLevel: "low" | "medium" | "high" | "critical";
                          }, i: number) => {
                            const barH = Math.max(4, (day.avgRiskScore / 100) * 140);
                            const colors = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444", critical: "#7f1d1d" };
                            const dateStr = new Date(day.date).toISOString().split("T")[0];
                            return (
                              <div
                                key={i}
                                className="flex-1 flex flex-col justify-end cursor-pointer group relative"
                                style={{ height: "100%" }}
                                onClick={() => setSelectedThreatDay(selectedThreatDay === dateStr ? null : dateStr)}
                              >
                                <div
                                  style={{
                                    height: barH,
                                    backgroundColor: colors[day.threatLevel],
                                    opacity: selectedThreatDay === dateStr ? 1 : 0.7,
                                    border: selectedThreatDay === dateStr ? "2px solid currentColor" : "none",
                                  }}
                                  className="w-full rounded-t-sm transition-all group-hover:opacity-100"
                                />
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                  <div className="bg-background border rounded shadow-lg p-2 text-xs whitespace-nowrap">
                                    <div className="font-semibold">{new Date(day.date).toLocaleDateString()}</div>
                                    <div>Risk: {day.avgRiskScore.toFixed(1)}</div>
                                    <div>Detections: {day.detectionCount}</div>
                                    <div>Alerts: {day.alertCount}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Y axis labels */}
                        <div className="absolute right-0 inset-y-0 flex flex-col justify-between pointer-events-none text-[10px] text-muted-foreground pr-1">
                          <span>100</span>
                          <span>50</span>
                          <span>0</span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                        {(["low","medium","high","critical"] as const).map((lvl) => (
                          <span key={lvl} className="flex items-center gap-1 capitalize">
                            <ThreatBand level={lvl} />{lvl}
                          </span>
                        ))}
                      </div>

                      {/* Selected day detail */}
                      {selectedThreatDay && (() => {
                        const day = threatTrend.trend.find(
                          (d: { date: Date | string }) => new Date(d.date).toISOString().split("T")[0] === selectedThreatDay
                        );
                        if (!day) return null;
                        return (
                          <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                            <div className="font-semibold mb-2">
                              {new Date(day.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-2xl font-bold">{day.avgRiskScore.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">Avg Risk Score</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold">{day.detectionCount}</div>
                                <div className="text-xs text-muted-foreground">Detections</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-red-600">{day.alertCount}</div>
                                <div className="text-xs text-muted-foreground">High-risk Alerts</div>
                              </div>
                            </div>
                            <div className={`mt-2 text-xs font-semibold capitalize px-2 py-1 rounded inline-block ${hotspotRiskBadge(day.threatLevel)}`}>
                              Threat Level: {day.threatLevel}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Threat summary stats */}
              {threatTrend && threatTrend.trend.length > 0 && (() => {
                const total = threatTrend.trend.reduce((s: number, d: { avgRiskScore: number }) => s + d.avgRiskScore, 0);
                const avg = total / threatTrend.trend.length;
                const maxDay = threatTrend.trend.reduce(
                  (best, d) => d.avgRiskScore > best.avgRiskScore ? d : best
                );
                const critDays = threatTrend.trend.filter((d: { threatLevel: string }) => d.threatLevel === "critical" || d.threatLevel === "high").length;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="canopy-panel">
                      <CardContent className="p-4">
                        <div className="text-3xl font-bold">{avg.toFixed(1)}</div>
                        <div className="text-sm text-muted-foreground mt-1">30-day Avg Risk</div>
                      </CardContent>
                    </Card>
                    <Card className="canopy-panel">
                      <CardContent className="p-4">
                        <div className="text-3xl font-bold text-red-600">{critDays}</div>
                        <div className="text-sm text-muted-foreground mt-1">High/Critical Days</div>
                      </CardContent>
                    </Card>
                    <Card className="canopy-panel">
                      <CardContent className="p-4">
                        <div className="text-3xl font-bold">{maxDay.avgRiskScore.toFixed(1)}</div>
                        <div className="text-sm text-muted-foreground mt-1">Peak Risk Score</div>
                        <div className="text-xs text-muted-foreground">{new Date(maxDay.date).toLocaleDateString()}</div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
            </>
          )}

          {/* ════════════════════════ COVERAGE TAB ════════════════════════ */}
          {activeTab === "coverage" && (
            <>
              {/* Incident Hotspot Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Incident Hotspot Analysis</CardTitle>
                  <CardDescription>Zones with the highest concentration of high-risk detections (past 90 days)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!hotspots ? (
                    <div className="space-y-2">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : hotspots.hotspots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No hotspot data. High-risk incidents will appear here.</p>
                  ) : (
                    <div className="space-y-3">
                      {hotspots.hotspots.slice(0, 5).map((h: {
                        zone: string;
                        incidentCount: number;
                        lastIncident: Date | string;
                        riskLevel: "low" | "medium" | "high" | "critical";
                        maxRisk: number;
                      }, i: number) => (
                        <div key={h.zone} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                          <div className="text-2xl font-black text-muted-foreground w-8 flex-shrink-0">#{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate capitalize">{h.zone === "unzoned" ? "Unzoned Area" : h.zone}</div>
                            <div className="text-xs text-muted-foreground">Last incident: {new Date(h.lastIncident).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl font-bold">{h.incidentCount}</div>
                            <div className="text-xs text-muted-foreground">incidents</div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${hotspotRiskBadge(h.riskLevel)}`}>
                              {h.riskLevel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coverage Gap Analysis */}
              {filters.siteId ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Coverage Gap Analysis</CardTitle>
                    <CardDescription>Today&apos;s monitoring coverage based on device activity and detection data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!patrolCoverage ? (
                      <Skeleton className="h-40 w-full" />
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                          <div className="canopy-panel p-4 text-center">
                            <div className={`text-4xl font-black ${
                              patrolCoverage.coveragePercent >= 80 ? "text-green-600 dark:text-green-400"
                              : patrolCoverage.coveragePercent >= 50 ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                            }`}>
                              {patrolCoverage.coveragePercent}%
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Device Coverage</div>
                          </div>
                          <div className="canopy-panel p-4 text-center">
                            <div className="text-4xl font-bold">
                              {patrolCoverage.activeDevices}/{patrolCoverage.totalDevices}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Active Devices Today</div>
                          </div>
                          <div className="canopy-panel p-4 text-center">
                            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                              {patrolCoverage.coveredHours}/24
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Hours with Detections</div>
                          </div>
                        </div>

                        {/* 24-hour coverage timeline */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2">24-hour Coverage Timeline</div>
                          <div className="grid grid-cols-12 sm:grid-cols-24 gap-0.5">
                            {Array.from({ length: 24 }, (_, h) => {
                              const isGap = patrolCoverage.gaps.some((g: { hour: number }) => g.hour === h);
                              return (
                                <div
                                  key={h}
                                  title={`${h.toString().padStart(2, "0")}:00 — ${isGap ? "No coverage" : "Covered"}`}
                                  className={`h-8 rounded-sm flex items-center justify-center text-[9px] font-mono cursor-default transition-colors ${
                                    isGap
                                      ? "bg-red-200 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                                      : "bg-green-200 dark:bg-green-900/50 text-green-700 dark:text-green-400"
                                  }`}
                                >
                                  {h}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/50 inline-block" /> Covered
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/50 inline-block" /> Gap
                            </span>
                          </div>
                        </div>

                        {patrolCoverage.gaps.length > 0 && (
                          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                            <div className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-1">
                              {patrolCoverage.gaps.length} coverage gap{patrolCoverage.gaps.length !== 1 ? "s" : ""} detected
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {patrolCoverage.gaps.slice(0, 12).map((g: { hour: number; label: string }) => (
                                <span key={g.hour} className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-mono">
                                  {g.label}
                                </span>
                              ))}
                              {patrolCoverage.gaps.length > 12 && (
                                <span className="text-xs text-muted-foreground">+{patrolCoverage.gaps.length - 12} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20">
                  <CardHeader>
                    <CardTitle>Coverage Gap Analysis</CardTitle>
                    <CardDescription>Select a site to view coverage data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground py-4 text-center">Choose a site from the filters to see device coverage gaps.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
