"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { AlertCardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { useState, useMemo, useEffect } from "react";
import { isSimulationMode, getMockAlertsForList } from "@/lib/simulation";

export default function AlertsPage() {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "advisory">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "acknowledged" | "resolved">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "severity">("newest");
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);

  const { data: apiData, isLoading, error, refetch } = trpc.alert.list.useQuery(
    { limit: 100 },
    { enabled: !simulationOn }
  );
  const data = simulationOn ? getMockAlertsForList(100) : apiData;

  const acknowledgeMutation = trpc.alert.acknowledge.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Alert acknowledged",
        description: "The alert has been marked as acknowledged",
      });
      refetch();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to acknowledge alert";
      addToast({
        type: "error",
        title: "Failed to acknowledge alert",
        description: errorMessage,
      });
    },
  });
  const resolveMutation = trpc.alert.resolve.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Alert resolved",
        description: "The alert has been marked as resolved",
      });
      refetch();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to resolve alert";
      addToast({
        type: "error",
        title: "Failed to resolve alert",
        description: errorMessage,
      });
    },
  });

  const handleAcknowledge = (id: string) => {
    if (acknowledgeMutation.isPending || simulationOn) return;
    acknowledgeMutation.mutate({ id });
  };

  const handleResolve = (id: string) => {
    if (resolveMutation.isPending || simulationOn) return;
    resolveMutation.mutate({ id });
  };

  // Filter and sort alerts (type assertion to avoid deep tRPC instantiation)
  type AlertItem = { id: string; title: string; message: string; site: { name: string }; severity: string; status: string; createdAt: Date | string; [key: string]: unknown };
  const rawItems: AlertItem[] | undefined = data?.items;
  const filteredAlerts = useMemo((): AlertItem[] => {
    const items = rawItems ?? [];
    if (items.length === 0) return [];

    let filtered = [...items];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (alert) =>
          alert.title.toLowerCase().includes(query) ||
          alert.message.toLowerCase().includes(query) ||
          alert.site.name.toLowerCase().includes(query)
      );
    }

    // Apply severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter((alert) => alert.severity === severityFilter);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((alert) => alert.status === statusFilter);
    }

    // Apply sorting (filtered is AlertItem[])
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "severity":
          const severityOrder = { critical: 3, warning: 2, advisory: 1 };
          return (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
                 (severityOrder[a.severity as keyof typeof severityOrder] || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [rawItems, searchQuery, severityFilter, statusFilter, sortBy]);

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
              Alerts
              {simulationOn && (
                <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Simulation
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Real-time safety alerts and notifications</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="min-h-[44px] touch-manipulation"
              title="Refresh alerts"
            >
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alerts by title, message, or site..."
              className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="advisory">Advisory</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="severity">By Severity</option>
            </select>

            {(searchQuery || severityFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSeverityFilter("all");
                  setStatusFilter("all");
                }}
                className="min-h-[44px] touch-manipulation"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {searchQuery && (
            <div className="text-sm text-gray-600">
              Showing {filteredAlerts.length} of {data?.items.length || 0} alerts
            </div>
          )}
        </div>
      </div>

      {!simulationOn && isLoading ? (
        <div className="space-y-4">
          <AlertCardSkeleton count={3} />
        </div>
      ) : !simulationOn && error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">Error loading alerts: {error.message}</p>
        </div>
      ) : filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="card-gradient card-hover">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {alert.severity === "critical" && (
                        <span className="text-2xl">🔴</span>
                      )}
                      {alert.severity === "warning" && (
                        <span className="text-2xl">🟠</span>
                      )}
                      {alert.severity === "advisory" && (
                        <span className="text-2xl">🟡</span>
                      )}
                      {alert.title}
                    </CardTitle>
                    <CardDescription className="mt-2 text-base">{alert.message}</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {alert.status === "active" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          className="border-blue-200 text-blue-700 hover:bg-blue-50 min-h-[44px] touch-manipulation"
                        >
                          Acknowledge
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolve(alert.id)}
                          className="border-green-200 text-green-700 hover:bg-green-50 min-h-[44px] touch-manipulation"
                        >
                          Resolve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Site:</span>
                      <p className="font-medium text-primary break-words">{alert.site.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className="font-medium capitalize">{alert.status}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p className="font-medium break-words">{new Date(alert.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
              {searchQuery || severityFilter !== "all" || statusFilter !== "all"
                ? "No alerts match your filters"
                : "No alerts found"}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery || severityFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Alerts will appear here when detected"}
            </p>
            {(searchQuery || severityFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSeverityFilter("all");
                  setStatusFilter("all");
                }}
                className="min-h-[44px] touch-manipulation"
              >
                Clear All Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
