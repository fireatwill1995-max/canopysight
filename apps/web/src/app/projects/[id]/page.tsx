"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { Skeleton, CardSkeleton } from "@canopy-sight/ui";
import Link from "next/link";
import { FileUpload } from "@/components/file-upload";
import { MissionMap } from "@/components/mission-map";

const TABS = ["Overview", "Files", "Missions", "Detections", "Settings"] as const;
type Tab = (typeof TABS)[number];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

// Demo data
const DEMO_PROJECT = {
  id: "p1",
  name: "Rail Corridor North",
  description: "Monitoring rail crossings along the northern corridor for safety compliance.",
  status: "active",
  location: "Portland, OR",
  createdAt: "2025-12-01T00:00:00Z",
  memberCount: 4,
  detectionCount: 1284,
  missionCount: 12,
  fileCount: 847,
};

const DEMO_ACTIVITY = [
  { id: "a1", text: "New detection: Person near track crossing", time: "2 hours ago" },
  { id: "a2", text: "Mission 'Corridor Sweep 12' completed", time: "5 hours ago" },
  { id: "a3", text: "3 new files uploaded from drone DJI-M30", time: "1 day ago" },
  { id: "a4", text: "Alert resolved: false positive near gate 4", time: "1 day ago" },
  { id: "a5", text: "Mission 'Night patrol' started", time: "2 days ago" },
];

const DEMO_MISSIONS = [
  { id: "m1", name: "Corridor Sweep 12", status: "completed", drone: "DJI-M30", startTime: "2026-03-22T08:00:00Z", endTime: "2026-03-22T09:30:00Z", detectionCount: 47 },
  { id: "m2", name: "Night Patrol", status: "active", drone: "DJI-M30", startTime: "2026-03-23T22:00:00Z", endTime: null, detectionCount: 12 },
  { id: "m3", name: "Thermal Check #5", status: "planned", drone: "Matrice 350", startTime: "2026-03-25T06:00:00Z", endTime: null, detectionCount: 0 },
];

const DEMO_DETECTIONS = [
  { id: "d1", label: "Person", confidence: 0.94, timestamp: "2026-03-23T14:22:00Z", location: "Crossing A" },
  { id: "d2", label: "Vehicle", confidence: 0.87, timestamp: "2026-03-23T13:10:00Z", location: "Gate 2" },
  { id: "d3", label: "Animal", confidence: 0.62, timestamp: "2026-03-23T11:45:00Z", location: "Section 4" },
  { id: "d4", label: "Person", confidence: 0.91, timestamp: "2026-03-22T16:30:00Z", location: "Crossing B" },
  { id: "d5", label: "Debris", confidence: 0.45, timestamp: "2026-03-22T09:15:00Z", location: "Track mile 12" },
];

const DEMO_FILES = [
  { id: "f1", name: "corridor_001.jpg", type: "image", size: "4.2MB", date: "2026-03-22" },
  { id: "f2", name: "thermal_scan.mp4", type: "video", size: "128MB", date: "2026-03-22" },
  { id: "f3", name: "crossing_a_overview.jpg", type: "image", size: "3.8MB", date: "2026-03-21" },
  { id: "f4", name: "night_patrol_clip.mp4", type: "video", size: "256MB", date: "2026-03-21" },
  { id: "f5", name: "gate2_detection.jpg", type: "image", size: "2.1MB", date: "2026-03-20" },
  { id: "f6", name: "panorama_north.jpg", type: "image", size: "8.5MB", date: "2026-03-20" },
];

export default function ProjectDetailPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [isLoading] = useState(false);
  const project = DEMO_PROJECT;

  if (isLoading) {
    return (
      <main className="canopy-page">
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="space-y-2 mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="canopy-page">
      {/* Back link */}
      <Link
        href="/projects"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← Back to Projects
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {project.name}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[project.status]}`}>
              {project.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{project.description}</p>
        </div>
        <Button variant="outline" className="min-h-[44px] touch-manipulation">
          Edit Project
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "Overview" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Detections", value: project.detectionCount.toLocaleString(), icon: "🎯" },
              { label: "Missions", value: project.missionCount, icon: "🚁" },
              { label: "Files", value: project.fileCount, icon: "📁" },
              { label: "Members", value: project.memberCount, icon: "👥" },
            ].map((stat) => (
              <Card key={stat.label} className="card-gradient">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{stat.icon} {stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent activity */}
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {DEMO_ACTIVITY.map((item) => (
                    <div key={item.id} className="flex justify-between items-start gap-3 text-sm">
                      <p className="text-foreground">{item.text}</p>
                      <p className="text-muted-foreground text-xs whitespace-nowrap">{item.time}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Map preview */}
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>Mission Map</CardTitle>
                <CardDescription>Latest flight paths and detections</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionMap
                  center={{ lat: 45.5152, lng: -122.6784 }}
                  flightPath={[
                    { lat: 45.515, lng: -122.680 },
                    { lat: 45.517, lng: -122.678 },
                    { lat: 45.518, lng: -122.675 },
                    { lat: 45.516, lng: -122.672 },
                  ]}
                  drones={[{ id: "d1", position: { lat: 45.516, lng: -122.672 }, label: "DJI-M30" }]}
                  detections={[
                    { id: "det1", position: { lat: 45.517, lng: -122.677 }, label: "Person", confidence: 0.94 },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "Files" && (
        <div className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
              <CardDescription>Add images or video from missions</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload maxSizeMB={500} maxFiles={50} />
            </CardContent>
          </Card>

          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>Project Files</CardTitle>
              <CardDescription>{DEMO_FILES.length} files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {DEMO_FILES.map((file) => (
                  <div key={file.id} className="border border-border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow cursor-pointer">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <span className="text-3xl">{file.type === "image" ? "🖼️" : "🎬"}</span>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{file.size} - {file.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "Missions" && (
        <div className="space-y-4">
          {DEMO_MISSIONS.map((mission) => (
            <Card key={mission.id} className="card-gradient card-hover">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground">{mission.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[mission.status] || "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                        {mission.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      🚁 {mission.drone} | 🎯 {mission.detectionCount} detections
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(mission.startTime).toLocaleString()}
                      {mission.endTime ? ` - ${new Date(mission.endTime).toLocaleString()}` : " - In progress"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {mission.status === "planned" && (
                      <Button size="sm" className="min-h-[36px]">Start</Button>
                    )}
                    {mission.status === "active" && (
                      <Button size="sm" variant="destructive" className="min-h-[36px]">Stop</Button>
                    )}
                    <Button size="sm" variant="outline" className="min-h-[36px]">View</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "Detections" && (
        <div className="space-y-4">
          <Card className="card-gradient">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">Label</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Confidence</th>
                    <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Location</th>
                    <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_DETECTIONS.map((det) => (
                    <tr key={det.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="p-3 font-medium text-foreground">{det.label}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          det.confidence >= 0.8 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                          det.confidence >= 0.5 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {(det.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground hidden sm:table-cell">{det.location}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{new Date(det.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "Settings" && (
        <Card className="card-gradient">
          <CardHeader>
            <CardTitle>Project Settings</CardTitle>
            <CardDescription>Configure project parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Project Name</label>
                <input
                  type="text"
                  defaultValue={project.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea
                  defaultValue={project.description}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                <input
                  type="text"
                  defaultValue={project.location}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select
                  defaultValue={project.status}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit">Save Changes</Button>
                <Button type="button" variant="destructive">Delete Project</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
