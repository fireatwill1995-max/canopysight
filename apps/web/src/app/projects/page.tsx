"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { Skeleton, CardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function ProjectsPage() {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Fetch projects from API (using site.list as the closest existing router)
  // TODO: Replace with trpc.project.list.useQuery() when project router is added
  const { data: sites, isLoading, error, refetch } = trpc.site.list.useQuery(undefined, {
    retry: false,
  });

  // Map sites to project shape for display
  const projects = useMemo(() => {
    if (!sites) return [];
    return sites.map((site: { id: string; name: string; description?: string | null; address?: string | null; createdAt: Date | string }) => ({
      id: site.id,
      name: site.name,
      description: site.description ?? undefined,
      status: "active" as const,
      location: site.address ?? undefined,
      createdAt: typeof site.createdAt === "string" ? site.createdAt : site.createdAt.toISOString(),
      memberCount: 0,
      detectionCount: 0,
    }));
  }, [sites]);

  const createMutation = trpc.site.create.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Project created", description: `"${newName}" has been created.` });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewLocation("");
      refetch();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to create project";
      addToast({ type: "error", title: "Failed to create project", description: message });
    },
  });

  useEffect(() => {
    if (error) {
      addToast({ type: "error", title: "Failed to load projects", description: error.message });
    }
  }, [error, addToast]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, search, statusFilter]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    // TODO: Replace with trpc.project.create when project router is added
    createMutation.mutate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      address: newLocation.trim() || undefined,
      latitude: 0,
      longitude: 0,
    } as Parameters<typeof createMutation.mutate>[0]);
  };

  if (isLoading) {
    return (
      <main className="canopy-page">
        <div className="space-y-2 mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
              Projects
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage and monitor your sensing projects
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="min-h-[44px] touch-manipulation"
          >
            + New Project
          </Button>
        </div>

        {/* Search and filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name, description, or location..."
              className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            {["all", "active", "archived", "draft"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors capitalize min-h-[36px] ${
                  statusFilter === s
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create project dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <Card className="relative z-10 w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Project</CardTitle>
              <CardDescription>Set up a new sensing project</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Project name"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="What is this project about?"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="City, State or coordinates"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <p className="text-foreground text-sm font-medium mb-1">Unable to connect to API server</p>
            <p className="text-muted-foreground text-xs">
              Make sure the API server is running. Run <code className="bg-muted px-1 rounded">npm run dev</code> in the root directory.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Project grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filtered.map((project, index) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <Card className="card-gradient card-hover h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[project.status] || STATUS_STYLES.active}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Location</p>
                      <p className="font-medium text-foreground truncate">{project.location || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Members</p>
                      <p className="font-medium text-foreground">{project.memberCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Detections</p>
                      <p className="font-medium text-foreground">{project.detectionCount.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : !error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-lg font-medium text-foreground mb-1">
              {search || statusFilter !== "all" ? "No projects match your filters" : "No projects yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Create your first project to get started with Canopy Sight"}
            </p>
            {!search && statusFilter === "all" && (
              <Button onClick={() => setShowCreate(true)} variant="gradient">
                + Create Your First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
