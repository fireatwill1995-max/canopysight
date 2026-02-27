"use client";

import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button, CardSkeleton, Skeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import dynamic from "next/dynamic";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { isSimulationMode, getMockDetections } from "@/lib/simulation";

// Lazy load heavy visualization components
const FilterPanel = dynamic(() => import("@/components/filter-panel").then(mod => ({ default: mod.FilterPanel })), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

const HeatmapVisualization = dynamic(() => import("@/components/heatmap-visualization").then(mod => ({ default: mod.HeatmapVisualization })), {
  loading: () => <Skeleton className="h-96 w-full" />,
  ssr: false,
});

const DetectionTimeline = dynamic(() => import("@/components/detection-timeline").then(mod => ({ default: mod.DetectionTimeline })), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});

const ReportGenerator = dynamic(() => import("@/components/report-generator").then(mod => ({ default: mod.ReportGenerator })), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

type DetectionType = "person" | "vehicle" | "animal" | "unknown";

export default function AnalyticsPage() {
  const canQuery = useCanUseProtectedTrpc();
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    siteId: undefined as string | undefined,
    deviceId: undefined as string | undefined,
    types: [] as DetectionType[],
    minRiskScore: undefined as number | undefined,
    maxRiskScore: undefined as number | undefined,
    minConfidence: undefined as number | undefined,
    maxConfidence: undefined as number | undefined,
    zones: [] as string[],
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date(),
  });

  const { data: heatmapData } = trpc.analytics.heatmap.useQuery(
    {
      siteId: filters.siteId as string,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
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
      limit: 100, // Maximum allowed by schema
    },
    { enabled: canQuery && !simulationOn, retry: false }
  );
  const detections = simulationOn ? getMockDetections(100) : apiDetections;

  const { data: behavioralPatterns } = trpc.analytics.behavioralPatterns.useQuery(
    {
      siteId: filters.siteId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  const { data: occupancyByZone } = trpc.analytics.occupancyByZone.useQuery(
    {
      siteId: filters.siteId as string,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  const { data: timeOfDayPressure } = trpc.analytics.timeOfDayPressure.useQuery(
    {
      siteId: filters.siteId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    { enabled: canQuery, retry: false }
  );

  const { data: sites } = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });
  const { data: devices } = trpc.device.list.useQuery({ siteId: filters.siteId }, { enabled: canQuery });
  const { data: zones } = trpc.zone.list.useQuery(
    { siteId: filters.siteId },
    { enabled: canQuery && !!filters.siteId, retry: false }
  );

  // Filter detections client-side (API returns riskScore as number | null)
  type DetectionItem = { id: string; type: string; timestamp: Date | string; confidence?: number; riskScore?: number | null; site?: { name?: string }; device?: { name?: string }; [key: string]: unknown };
  const rawDetections = detections?.items;
  const detectionItems = useMemo((): DetectionItem[] => {
    let items: DetectionItem[] = (rawDetections ?? []) as DetectionItem[];

    // Apply maxRiskScore filter (client-side since API doesn't support it)
    if (filters.maxRiskScore !== undefined) {
      items = items.filter((item: DetectionItem) => 
        item.riskScore == null || item.riskScore <= filters.maxRiskScore!
      );
    }

    // Apply maxConfidence filter (client-side)
    if (filters.maxConfidence !== undefined) {
      items = items.filter((item: any) => 
        item.confidence === undefined || item.confidence <= filters.maxConfidence!
      );
    }

    // Apply minConfidence filter (client-side)
    if (filters.minConfidence !== undefined) {
      items = items.filter((item: any) => 
        item.confidence === undefined || item.confidence >= filters.minConfidence!
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item: any) => {
        const typeMatch = item.type?.toLowerCase().includes(query);
        const siteMatch = item.site?.name?.toLowerCase().includes(query);
        const deviceMatch = item.device?.name?.toLowerCase().includes(query);
        const idMatch = item.id?.toLowerCase().includes(query);
        return typeMatch || siteMatch || deviceMatch || idMatch;
      });
    }

    return items;
  }, [rawDetections, filters.maxRiskScore, filters.minConfidence, filters.maxConfidence, searchQuery]);

  // Calculate trends
  const trends = {
    totalEvents: detectionItems.length || 0,
    byType: detectionItems.reduce((acc: Record<string, number>, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byDay: detectionItems.reduce((acc: Record<string, number>, event) => {
      const day = new Date(event.timestamp).toLocaleDateString();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const { addToast } = useToast();

  const handleExport = () => {
    try {
      const data = detectionItems.map((item: any) => ({
        id: item.id,
        type: item.type,
        timestamp: new Date(item.timestamp).toISOString(),
        confidence: item.confidence,
        riskScore: item.riskScore,
        site: item.site?.name,
        device: item.device?.name,
      }));

      if (data.length === 0) {
        addToast({
          type: "warning",
          title: "No data to export",
          description: "Please select filters that return detection data",
        });
        return;
      }

      const csv = [
        ["ID", "Type", "Timestamp", "Confidence", "Risk Score", "Site", "Device"],
        ...data.map((item) => [
          item.id,
          item.type,
          item.timestamp,
          item.confidence?.toFixed(2) || "",
          item.riskScore || "",
          item.site || "",
          item.device || "",
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

      addToast({
        type: "success",
        title: "Export successful",
        description: `Exported ${data.length} detection events to CSV`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export data",
      });
    }
  };

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
              Analytics
              {simulationOn && (
                <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Simulation
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Advanced insights and pattern analysis</p>
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
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <Button
              onClick={handleExport}
              variant="outline"
              className="min-h-[44px] touch-manipulation whitespace-nowrap"
              disabled={detectionItems.length === 0}
            >
              📥 Export CSV
            </Button>
          </div>
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
          {/* Search Results Info */}
          {searchQuery && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Found <strong>{detectionItems.length}</strong> result{detectionItems.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="min-h-[32px] touch-manipulation"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trends Card */}
          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>📊 Trends & Statistics</CardTitle>
                  <CardDescription>Detection statistics and insights</CardDescription>
                </div>
                {detectionItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="min-h-[32px] touch-manipulation"
                  >
                    📥 Export CSV
                  </Button>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              )}
            </CardContent>
          </Card>

          {/* Heatmap */}
          {heatmapData ? (
            <HeatmapVisualization
              data={heatmapData.data?.map((p: { x: number; y: number; intensity?: number }) => ({
                x: p.x,
                y: p.y,
                intensity: p.intensity || 1,
              })) || []}
            />
          ) : filters.siteId ? (
            <Card>
              <CardContent className="p-8">
                <div className="space-y-4">
                  <Skeleton className="h-64 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Timeline */}
          {detectionItems.length > 0 && (
            <DetectionTimeline
              events={detectionItems.map((d: any) => ({
                id: d.id,
                type: d.type,
                timestamp: d.timestamp,
                confidence: d.confidence,
              }))}
              startDate={filters.startDate}
              endDate={filters.endDate}
            />
          )}

          {/* Behavioral Patterns */}
          {behavioralPatterns && (
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>🤖 Behavioral Patterns</CardTitle>
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
                            <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                              {Math.round(pattern.confidence * 100)}% confidence
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-3xl mb-2">🔍</div>
                      <p>No patterns detected</p>
                      <p className="text-sm mt-1">Patterns will appear here when AI detects behavioral anomalies</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Congestion & flow: occupancy by zone */}
          {filters.siteId && occupancyByZone && (
            <Card>
              <CardHeader>
                <CardTitle>Congestion & flow — occupancy by zone</CardTitle>
                <CardDescription>
                  Overcrowding, pinch points, clustering in waiting areas
                </CardDescription>
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

          {/* Time-of-day pressure (rush hours, out-of-hours) */}
          {timeOfDayPressure && (
            <Card>
              <CardHeader>
                <CardTitle>Time-of-day pressure</CardTitle>
                <CardDescription>
                  Rush hours, out-of-hours activity, lone worker context
                </CardDescription>
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

          {/* Report Generator */}
          <ReportGenerator
            siteId={filters.siteId}
            startDate={filters.startDate}
            endDate={filters.endDate}
          />
        </div>
      </div>
    </main>
  );
}
