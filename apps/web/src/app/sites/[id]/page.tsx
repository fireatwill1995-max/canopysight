"use client";

import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { DetailPageSkeleton, Skeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  isSimulationMode,
  setSimulationMode,
  getMockHazardsForLiveFeed,
  HAZARD_REF_WIDTH,
  HAZARD_REF_HEIGHT,
  DEMO_VIDEO_YOUTUBE_ID,
} from "@/lib/simulation";
import type { HazardOverlay } from "@/components/live-video-feed";

// Lazy load heavy components - only load when needed
const LiveVideoFeed = dynamic(() => import("@/components/live-video-feed").then(mod => ({ default: mod.LiveVideoFeed })), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});

const LiveAlertFeed = dynamic(() => import("@/components/live-alert-feed").then(mod => ({ default: mod.LiveAlertFeed })), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});

const ZoneEditor = dynamic(() => import("@/components/zone-editor").then(mod => ({ default: mod.ZoneEditor })), {
  loading: () => <Skeleton className="h-96 w-full" />,
  ssr: false,
});

const MeshTopologyView = dynamic(() => import("@/components/mesh-topology-view").then(mod => ({ default: mod.MeshTopologyView })), {
  loading: () => <Skeleton className="h-96 w-full" />,
  ssr: false,
});

interface ZoneEntry {
  id: string;
  name: string;
  type: string;
  points: unknown;
  isActive: boolean;
}

export default function SiteDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [activeTab, setActiveTab] = useState<"overview" | "live" | "zones" | "mesh">("overview");
  const [focusedDeviceId, setFocusedDeviceId] = useState<string | null>(null);
  const [simulationOn, setSimulationOn] = useState(false);
  const [hazardTimeSeed, setHazardTimeSeed] = useState(0);

  // Sync simulation state from sessionStorage and from URL (?simulation=1 & ?tab=live)
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);

  // Animate mock hazard positions so the symbol moves with the person/car in simulation
  useEffect(() => {
    if (!simulationOn) return;
    const id = setInterval(() => setHazardTimeSeed((t) => t + 1), 350);
    return () => clearInterval(id);
  }, [simulationOn]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const sim = searchParams.get("simulation");
    if (tab === "live") setActiveTab("live");
    if (sim === "1" || sim === "true") {
      setSimulationMode(true);
      setSimulationOn(true);
    }
  }, [searchParams]);

  const { data: site, isLoading, error } = trpc.site.byId.useQuery({ id: siteId });
  const { data: zones } = trpc.zone.list.useQuery({ siteId });
  const { data: devices } = trpc.device.list.useQuery({ siteId });
  const { data: detectionsData } = trpc.detection.list.useQuery(
    { siteId, limit: 40 },
    { enabled: !!siteId && !simulationOn, refetchInterval: 12000 }
  );

  type DetectionItem = {
    id: string;
    type: string;
    boundingBox: unknown;
    confidence?: number;
    riskScore?: number | null;
    device?: { id: string };
  };
  const detections: DetectionItem[] = (detectionsData?.items ?? []) as DetectionItem[];

  const toHazard = (d: DetectionItem): HazardOverlay => ({
    id: d.id,
    type: d.type,
    boundingBox:
      typeof d.boundingBox === "object" &&
      d.boundingBox != null &&
      "x" in d.boundingBox &&
      "y" in d.boundingBox &&
      "width" in d.boundingBox &&
      "height" in d.boundingBox
        ? (d.boundingBox as { x: number; y: number; width: number; height: number })
        : { x: 0, y: 0, width: 50, height: 50 },
    confidence: d.confidence,
    riskScore: d.riskScore ?? undefined,
  });

  const hazardsForDevice = (deviceId: string): HazardOverlay[] =>
    simulationOn
      ? getMockHazardsForLiveFeed(hazardTimeSeed * 400)
      : detections.filter((d) => d.device?.id === deviceId).map(toHazard);

  const { addToast } = useToast();
  const createZoneMutation = trpc.zone.create.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Zone created",
        description: "The detection zone has been successfully created",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to create zone",
        description: error.message || "An error occurred",
      });
    },
  });

  const utils = trpc.useUtils();
  const deleteZoneMutation = trpc.zone.delete.useMutation({
    onSuccess: () => {
      utils.zone.list.invalidate({ siteId });
      addToast({
        type: "success",
        title: "Zone deleted",
        description: "The detection zone has been removed",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to delete zone",
        description: error.message || "An error occurred",
      });
    },
  });

  const handleSaveZone = async (zone: { name: string; points: Array<{ x: number; y: number }>; type: string }) => {
    createZoneMutation.mutate({
      siteId,
      name: zone.name,
      type: zone.type as any,
      points: zone.points,
      isActive: true,
    });
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  const focusedDevice = focusedDeviceId
    ? devices?.find((d: { id: string }) => d.id === focusedDeviceId) ?? devices?.[0]
    : devices?.[0];

  if (error || !site) {
    return (
      <div className="container mx-auto p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">Error loading site: {error?.message || "Site not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="canopy-page">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          {site.name}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">{site.description || "No description"}</p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
          Location: {site.latitude}, {site.longitude}
        </p>
      </div>

      {/* Simulation toggle – visible on every tab so users can find it */}
      <div className="mb-4 p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/20">
        <label className="flex flex-wrap items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={simulationOn}
            onChange={(e) => {
              const on = e.target.checked;
              setSimulationMode(on);
              setSimulationOn(on);
            }}
            className="rounded border-amber-500 w-5 h-5 accent-amber-600"
          />
          <span className="font-semibold text-amber-900 dark:text-amber-100">Enable simulation mode</span>
          <span className="text-sm text-amber-800 dark:text-amber-200">
            – Demo video and sample alerts in <button type="button" onClick={() => setActiveTab("live")} className="underline font-medium">Live Feed</button>
          </span>
        </label>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
          Show buyers how the app works with a mock camera feed and rail-safety alerts. Turn on, then open the Live Feed tab.
        </p>
      </div>

      <div className="mb-4 border-b overflow-x-auto">
        <div className="flex gap-2 sm:gap-4 min-w-max">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 sm:px-4 py-2 font-medium text-sm sm:text-base whitespace-nowrap touch-manipulation min-h-[44px] ${
              activeTab === "overview"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("live")}
            className={`px-3 sm:px-4 py-2 font-medium text-sm sm:text-base whitespace-nowrap touch-manipulation min-h-[44px] ${
              activeTab === "live"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            Live Feed
          </button>
          <button
            onClick={() => setActiveTab("zones")}
            className={`px-3 sm:px-4 py-2 font-medium text-sm sm:text-base whitespace-nowrap touch-manipulation min-h-[44px] ${
              activeTab === "zones"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            Zones
          </button>
          <button
            onClick={() => setActiveTab("mesh")}
            className={`px-3 sm:px-4 py-2 font-medium text-sm sm:text-base whitespace-nowrap touch-manipulation min-h-[44px] ${
              activeTab === "mesh"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            Mesh Network
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>Connected edge devices</CardDescription>
            </CardHeader>
            <CardContent>
              {devices && devices.length > 0 ? (
                <div className="space-y-2">
                  {devices.map((device: { id: string; name: string; status: string }) => (
                    <div key={device.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{device.name}</h3>
                          <p className="text-sm text-gray-600">Status: {device.status}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            device.status === "online"
                              ? "bg-green-100 text-green-800"
                              : device.status === "offline"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {device.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No devices configured</p>
              )}
            </CardContent>
          </Card>

          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>🎯 Zones</CardTitle>
              <CardDescription>Detection zones configured</CardDescription>
            </CardHeader>
            <CardContent>
              {zones && zones.length > 0 ? (
                <div className="space-y-3">
                  {(zones as ZoneEntry[]).map((zone) => (
                    <div key={zone.id} className="p-4 border rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{zone.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Type: <span className="capitalize">{zone.type}</span>
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Points: {(zone.points as Array<{ x: number; y: number }>)?.length || 0}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            zone.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {zone.isActive ? "✅ Active" : "❌ Inactive"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-3xl mb-2">🎯</div>
                  <p className="text-sm">No zones configured</p>
                  <p className="text-xs mt-1">Switch to the Zones tab to create one</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "live" && (
        <div className="space-y-6">
          {/* Simulation toggle for demos: mock camera + mock alerts */}
          <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10">
            <CardHeader>
              <CardTitle className="text-base">Demo / Simulation</CardTitle>
              <CardDescription>
                Show potential buyers how the app works with a mock camera feed (train station style) and sample alerts—no real devices required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulationOn}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setSimulationMode(on);
                    setSimulationOn(on);
                  }}
                  className="rounded border-gray-300"
                />
                <span className="font-medium">Enable simulation mode</span>
              </label>
              <p className="text-xs text-gray-500 mt-2">
                When on: live view uses a demo video and the alert feed shows sample rail-safety alerts.
              </p>
            </CardContent>
          </Card>

          {/* Alerts for this site that can auto-focus a device */}
          <LiveAlertFeed
            siteIdFilter={siteId}
            deviceIdFilter={focusedDevice?.id}
            simulationMode={simulationOn}
            onAlertFocus={(alert) => {
              if (alert.siteId === siteId && alert.deviceId) {
                setFocusedDeviceId(alert.deviceId);
              }
            }}
          />

          {devices && devices.length > 0 ? (
            <>
              {/* Focused camera */}
              <Card>
                <CardHeader>
                  <CardTitle>Focused Camera</CardTitle>
                  <CardDescription>
                    Select a device to focus on, or let alerts auto-select the source device. Detected potential hazards are circled on the feed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <select
                      value={focusedDevice?.id ?? ""}
                      onChange={(e) => setFocusedDeviceId(e.target.value || null)}
                      className="px-3 py-2 border rounded-lg min-h-[44px]"
                    >
                      {devices.map((d: { id: string; name: string; status: string }) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  {focusedDevice ? (
                    <LiveVideoFeed
                      deviceId={focusedDevice.id}
                      siteId={siteId}
                      streamUrl={(focusedDevice as { streamUrl?: string }).streamUrl}
                      simulationMode={simulationOn}
                      zones={(zones as ZoneEntry[] | undefined)?.map((z: ZoneEntry) => ({
                        id: z.id,
                        name: z.name,
                        points: (z.points as Array<{ x: number; y: number }>) || [],
                        type: z.type,
                      }))}
                      hazards={hazardsForDevice(focusedDevice.id)}
                      hazardRefWidth={HAZARD_REF_WIDTH}
                      hazardRefHeight={HAZARD_REF_HEIGHT}
                    />
                  ) : (
                    <p className="text-gray-500">Select a device to view its live feed.</p>
                  )}
                </CardContent>
              </Card>

              {/* Multi-view of all site cameras/devices */}
              <Card>
                <CardHeader>
                  <CardTitle>Multi-View</CardTitle>
                  <CardDescription>All cameras/devices at this site.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {devices.map((device: { id: string; name?: string; status?: string }) => (
                      <LiveVideoFeed
                        key={device.id}
                        deviceId={device.id}
                        siteId={siteId}
                        streamUrl={(device as { streamUrl?: string }).streamUrl}
                        simulationMode={simulationOn}
                        zones={(zones as ZoneEntry[] | undefined)?.map((z: ZoneEntry) => ({
                          id: z.id,
                          name: z.name,
                          points: (z.points as Array<{ x: number; y: number }>) || [],
                          type: z.type,
                        }))}
                        hazards={hazardsForDevice(device.id)}
                        hazardRefWidth={HAZARD_REF_WIDTH}
                        hazardRefHeight={HAZARD_REF_HEIGHT}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* When no devices: still show simulation feed so buyers can see the app */}
              {simulationOn && (
                <Card>
                  <CardHeader>
                    <CardTitle>Live Feed (Simulation)</CardTitle>
                    <CardDescription>
                      Mock camera view—add devices to this site to see real streams.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LiveVideoFeed
                      deviceId="sim-device-1"
                      siteId={siteId}
                      simulationMode={true}
                      zones={(zones as ZoneEntry[] | undefined)?.map((z: ZoneEntry) => ({
                        id: z.id,
                        name: z.name,
                        points: (z.points as Array<{ x: number; y: number }>) || [],
                        type: z.type,
                      }))}
                      hazards={getMockHazardsForLiveFeed(hazardTimeSeed * 400)}
                      hazardRefWidth={HAZARD_REF_WIDTH}
                      hazardRefHeight={HAZARD_REF_HEIGHT}
                    />
                  </CardContent>
                </Card>
              )}
              {!simulationOn && (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <p>No devices available for live feed</p>
                    <p className="text-sm mt-2">Enable simulation mode above to show a demo feed without devices.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "zones" && (
        <div className="space-y-6">
          {/* Single card: live feed with zone editor drawn directly on it — see exactly where you put the zone */}
          <Card>
            <CardHeader>
              <CardTitle>Live feed — draw zones directly on the stream</CardTitle>
              <CardDescription>
                The video below is the live feed. Click on it to add zone points (min 3) so you can see exactly where the zone is. Choose camera, then draw and save.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {devices && devices.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Camera</label>
                  <select
                    value={focusedDeviceId ?? (devices[0] as { id: string })?.id ?? ""}
                    onChange={(e) => setFocusedDeviceId(e.target.value || null)}
                    className="px-3 py-2 border rounded-lg min-h-[44px] w-full max-w-xs"
                  >
                    {devices.map((d: { id: string; name: string; status?: string }) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.status ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {focusedDevice || simulationOn ? (
                <ZoneEditor
                  streamUrl={
                    ((focusedDevice ?? devices?.[0]) as { streamUrl?: string })?.streamUrl?.trim()
                      ? ((focusedDevice ?? devices?.[0]) as { streamUrl?: string }).streamUrl
                      : simulationOn
                        ? `https://www.youtube.com/watch?v=${DEMO_VIDEO_YOUTUBE_ID}`
                        : undefined
                  }
                  simulationMode={simulationOn}
                  refWidth={HAZARD_REF_WIDTH}
                  refHeight={HAZARD_REF_HEIGHT}
                  existingZones={(zones as ZoneEntry[] | undefined)?.map((z: ZoneEntry) => ({
                    id: z.id,
                    name: z.name,
                    points: (z.points as Array<{ x: number; y: number }>) || [],
                    type: z.type,
                  }))}
                  onSave={handleSaveZone}
                />
              ) : (
                <div className="aspect-video max-h-[50vh] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-400 p-4 text-center">
                  <p>Enable simulation mode above or add a device with a stream URL to see the live feed and draw zones on it.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {zones && zones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Existing zones</CardTitle>
                <CardDescription>{zones.length} zone{zones.length !== 1 ? "s" : ""} configured. Remove any zone with the Delete zone button.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(zones as ZoneEntry[]).map((zone) => (
                    <div key={zone.id} className="p-4 border rounded flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{zone.name}</h3>
                        <p className="text-sm text-gray-600">Type: {zone.type}</p>
                        <p className="text-sm text-gray-500">
                          Points: {(zone.points as Array<{ x: number; y: number }>)?.length || 0}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Delete zone "${zone.name}"?`)) {
                            deleteZoneMutation.mutate({ id: zone.id });
                          }
                        }}
                        disabled={deleteZoneMutation.isPending}
                      >
                        {deleteZoneMutation.isPending ? "Deleting…" : "Delete zone"}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "mesh" && (
        <div className="space-y-6">
          <MeshTopologyView siteId={siteId} />
        </div>
      )}
    </main>
  );
}
