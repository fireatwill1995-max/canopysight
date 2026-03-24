"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { Skeleton, CardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { trpc } from "@/lib/trpc/client";

type MissionStatus = "planned" | "active" | "completed" | "failed";

interface Mission {
  id: string;
  name: string;
  projectName: string;
  drone: string;
  status: MissionStatus;
  startTime: string;
  endTime: string | null;
  detectionCount: number;
}

const STATUS_CONFIG: Record<MissionStatus, { style: string; icon: string }> = {
  planned: { style: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: "📋" },
  active: { style: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: "🟢" },
  completed: { style: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400", icon: "✅" },
  failed: { style: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: "❌" },
};

// Fallback demo data used when the mission router is not yet available
const DEMO_MISSIONS: Mission[] = [
  { id: "m1", name: "Morning Rail Sweep", projectName: "Rail Corridor North", drone: "DJI-M30", status: "completed", startTime: "2026-03-23T06:00:00Z", endTime: "2026-03-23T07:45:00Z", detectionCount: 23 },
  { id: "m2", name: "Night Patrol Sector A", projectName: "Rail Corridor North", drone: "DJI-M30", status: "active", startTime: "2026-03-23T22:00:00Z", endTime: null, detectionCount: 5 },
  { id: "m3", name: "Solar Panel Inspection", projectName: "Solar Farm Alpha", drone: "Matrice 350", status: "completed", startTime: "2026-03-22T10:00:00Z", endTime: "2026-03-22T12:30:00Z", detectionCount: 31 },
  { id: "m4", name: "Perimeter Check", projectName: "Solar Farm Alpha", drone: "DJI-M30", status: "planned", startTime: "2026-03-25T08:00:00Z", endTime: null, detectionCount: 0 },
  { id: "m5", name: "Pipeline Flyover Q1-3", projectName: "Pipeline Inspection Q1", drone: "Matrice 350", status: "completed", startTime: "2026-03-20T07:00:00Z", endTime: "2026-03-20T11:00:00Z", detectionCount: 14 },
  { id: "m6", name: "Emergency Response Check", projectName: "Rail Corridor North", drone: "DJI-M30", status: "failed", startTime: "2026-03-21T14:00:00Z", endTime: "2026-03-21T14:12:00Z", detectionCount: 0 },
  { id: "m7", name: "Thermal Scan #6", projectName: "Rail Corridor North", drone: "Matrice 350", status: "planned", startTime: "2026-03-26T06:00:00Z", endTime: null, detectionCount: 0 },
];

function formatDuration(start: string, end: string | null): string {
  if (!end) return "In progress";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function mapJobStatus(status: string): MissionStatus {
  switch (status) {
    case "active": return "active";
    case "completed": return "completed";
    case "failed": return "failed";
    case "waiting":
    case "delayed":
    default: return "planned";
  }
}

export default function MissionsPage() {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | MissionStatus>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [useFallback, setUseFallback] = useState(false);

  // TODO: Replace with trpc.mission.list.useQuery() when mission router is added to appRouter
  // For now, attempt to fetch jobs as a proxy for mission data
  const { data: jobsData, isLoading, error } = trpc.job.list.useQuery(
    { limit: 50 },
    { retry: false }
  );

  // Map jobs to missions if available, otherwise fall back to demo data
  useEffect(() => {
    if (error) setUseFallback(true);
  }, [error]);

  const missions: Mission[] = useMemo(() => {
    if (useFallback || !jobsData) return DEMO_MISSIONS;

    // If the API returned jobs, map them into Mission shape
    if (jobsData.length === 0) return DEMO_MISSIONS;

    return jobsData.map((job: { id: string; queue: string; status: string; data: unknown; createdAt: Date | string; updatedAt: Date | string }) => ({
      id: job.id,
      name: `Job ${job.id.slice(0, 8)}`,
      projectName: (job.data as Record<string, string>)?.projectName ?? job.queue,
      drone: "Assigned",
      status: mapJobStatus(job.status),
      startTime: typeof job.createdAt === "string" ? job.createdAt : job.createdAt.toISOString(),
      endTime: job.status === "completed" || job.status === "failed"
        ? (typeof job.updatedAt === "string" ? job.updatedAt : job.updatedAt.toISOString())
        : null,
      detectionCount: 0,
    }));
  }, [jobsData, useFallback]);

  // TODO: Wire to trpc.mission.start / trpc.mission.stop when router is available
  const handleStart = (id: string) => {
    addToast({ type: "info", title: "Mission starting", description: `Starting mission ${id}...` });
  };

  const handleStop = (id: string) => {
    addToast({ type: "info", title: "Mission stopping", description: `Stopping mission ${id}...` });
  };

  const projects = Array.from(new Set(missions.map((m) => m.projectName)));

  const filtered = useMemo(() => {
    let list = missions;
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    if (projectFilter !== "all") list = list.filter((m) => m.projectName === projectFilter);
    return list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [missions, statusFilter, projectFilter]);

  if (isLoading) {
    return (
      <main className="canopy-page">
        <div className="space-y-2 mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
              Missions
              {useFallback && (
                <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground ml-2">
                  Demo
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Plan, execute, and review drone missions
            </p>
          </div>
          <Button className="min-h-[44px] touch-manipulation">
            + New Mission
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "planned", "active", "completed", "failed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors capitalize min-h-[36px] ${
                statusFilter === s
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {s === "all" ? "All" : `${STATUS_CONFIG[s as MissionStatus]?.icon || ""} ${s}`}
            </button>
          ))}

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-sm px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[36px]"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {filtered.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border hidden sm:block" />

          <div className="space-y-4">
            {filtered.map((mission, index) => {
              const cfg = STATUS_CONFIG[mission.status];
              return (
                <div key={mission.id} className="relative animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 top-5 w-3 h-3 rounded-full bg-primary border-2 border-background z-10 hidden sm:block" />

                  <Card className="card-gradient card-hover sm:ml-10">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-lg">{cfg.icon}</span>
                            <p className="font-semibold text-foreground">{mission.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${cfg.style}`}>
                              {mission.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm mt-2">
                            <div>
                              <p className="text-muted-foreground text-xs">Project</p>
                              <p className="text-foreground font-medium truncate">{mission.projectName}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Drone</p>
                              <p className="text-foreground font-medium">{mission.drone}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Duration</p>
                              <p className="text-foreground font-medium">{formatDuration(mission.startTime, mission.endTime)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Detections</p>
                              <p className="text-foreground font-medium">{mission.detectionCount}</p>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(mission.startTime).toLocaleString()}
                            {mission.endTime ? ` - ${new Date(mission.endTime).toLocaleString()}` : ""}
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {mission.status === "planned" && (
                            <Button size="sm" className="min-h-[36px]" onClick={() => handleStart(mission.id)}>
                              Start Mission
                            </Button>
                          )}
                          {mission.status === "active" && (
                            <Button size="sm" variant="destructive" className="min-h-[36px]" onClick={() => handleStop(mission.id)}>
                              Stop Mission
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="min-h-[36px]">
                            Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">🚁</div>
            <p className="text-lg font-medium text-foreground mb-1">
              {statusFilter !== "all" || projectFilter !== "all"
                ? "No missions match your filters"
                : "No missions yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter !== "all" || projectFilter !== "all"
                ? "Try adjusting your filter criteria"
                : "Create your first drone mission to begin surveying"}
            </p>
            {statusFilter === "all" && projectFilter === "all" && (
              <Button variant="gradient">
                + Plan Your First Mission
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
