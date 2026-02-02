"use client";

import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button, Skeleton, CardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { EventPlayback } from "@/components/event-playback";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { isSimulationMode, getMockPlaybackEvents } from "@/lib/simulation";

type PlaybackEvent = {
  id: string;
  type: string;
  confidence: number;
  timestamp: Date;
  boundingBox: { x: number; y: number; width: number; height: number };
  videoClipUrl?: string;
};

export default function PlaybackPage() {
  const { addToast } = useToast();
  const canQuery = useCanUseProtectedTrpc();
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);
  const { data: sites, isLoading: sitesLoading } = trpc.site.list.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
  });

  const [siteId, setSiteId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const historyQuery = trpc.model.history.useQuery(
    {
      siteId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    { enabled: canQuery && !!siteId && !simulationOn, retry: false }
  );

  const playbackEvents: PlaybackEvent[] = useMemo(() => {
    if (simulationOn) return getMockPlaybackEvents();
    const detections = historyQuery.data?.series?.detections ?? [];
    return detections.map((d: { id: string; type: string; confidence?: number; timestamp: string; boundingBox?: unknown }) => ({
      id: d.id,
      type: d.type,
      confidence: typeof d.confidence === "number" ? d.confidence : 0,
      timestamp: new Date(d.timestamp),
      boundingBox: (d.boundingBox as { x: number; y: number; width: number; height: number }) ?? { x: 0, y: 0, width: 0, height: 0 },
      videoClipUrl: undefined,
    }));
  }, [simulationOn, historyQuery.data]);

  const selected = playbackEvents.find((e) => e.id === selectedEventId) ?? null;

  if (canQuery && sitesLoading) {
    return (
      <main className="canopy-page">
        <div className="mb-6 sm:mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <div className="lg:col-span-2 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
          Playback
          {simulationOn && (
            <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Simulation
            </span>
          )}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Time-based playback (“what changed”) for a single environment
        </p>
      </div>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>🎬 Playback Controls</CardTitle>
          <CardDescription>Select a site and date range to view historical events</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Site</label>
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setSelectedEventId(null);
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
              disabled={sitesLoading}
            >
              <option value="">{sitesLoading ? "Loading..." : "Select a site"}</option>
              {(sites || []).map((s: { id: string; name: string }) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>
              {historyQuery.isFetching
                ? "Loading…"
                : siteId
                  ? `${playbackEvents.length} detections`
                  : "Pick a site to load events"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!siteId ? (
              <p className="text-gray-500">Select a site to begin.</p>
            ) : historyQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 border border-border rounded-lg flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : historyQuery.error ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-300">Error loading history: {historyQuery.error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => historyQuery.refetch()}
                  className="mt-2 min-h-[32px] touch-manipulation"
                >
                  Retry
                </Button>
              </div>
            ) : playbackEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-3xl mb-2">🔍</div>
                <p className="text-sm">No detections found in this range</p>
                <p className="text-xs mt-1">Try adjusting the date range or select a different site</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {playbackEvents
                  .slice()
                  .reverse()
                  .map((e: { id: string; type: string; timestamp: Date; confidence: number }) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEventId(e.id)}
                      className={`w-full text-left p-3 rounded border transition-colors ${
                        selectedEventId === e.id
                          ? "border-primary bg-muted"
                          : "border-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="font-semibold capitalize">{e.type}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {e.timestamp.toLocaleString()} • {(e.confidence * 100).toFixed(0)}%
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {selected ? (
            <EventPlayback event={selected} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>🎬 Playback Viewer</CardTitle>
                <CardDescription>Select an event from the list to view details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📹</div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">No event selected</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Choose an event from the list to view playback
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedEventId(playbackEvents.at(-1)?.id ?? null)}
                    disabled={playbackEvents.length === 0}
                    className="w-full min-h-[44px] touch-manipulation"
                  >
                    📍 Select Most Recent Event
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

