"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { AlertCardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { useState, useMemo, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertItem = {
  id: string;
  title: string;
  message: string;
  site: { name: string };
  severity: string;
  status: string;
  createdAt: Date | string;
  [key: string]: unknown;
};

type TimeRange = "1h" | "6h" | "24h" | "7d" | "all";
type ViewMode = "list" | "timeline";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "Last 1h",
  "6h": "Last 6h",
  "24h": "Last 24h",
  "7d": "Last 7 days",
  all: "All time",
};

function getTimeRangeMs(range: TimeRange): number | null {
  switch (range) {
    case "1h": return 60 * 60 * 1000;
    case "6h": return 6 * 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d": return 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// ─── Response time badge ──────────────────────────────────────────────────────
function ResponseTimeBadge({ createdAt, status }: { createdAt: Date | string; status: string }) {
  if (status !== "active") return null;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const isOverdue = ageMin > 15;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
        isOverdue
          ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800"
          : "bg-muted text-muted-foreground border-border"
      }`}
      title={`Unacknowledged for ${ageMin} minute${ageMin !== 1 ? "s" : ""}`}
    >
      {isOverdue && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
      {ageMin < 60
        ? `${ageMin}m unacknowledged`
        : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m unacknowledged`}
    </span>
  );
}

// ─── Correlation badge ────────────────────────────────────────────────────────
function CorrelationBadge({ alerts, currentId }: { alerts: AlertItem[]; currentId: string }) {
  // Group alerts with the same title as "correlated"
  const self = alerts.find((a) => a.id === currentId);
  if (!self) return null;
  const related = alerts.filter((a) => a.id !== currentId && a.title === self.title);
  if (related.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800">
      Correlated: {related.length + 1} events
    </span>
  );
}

// ─── Timeline view ────────────────────────────────────────────────────────────
function TimelineView({
  alerts,
  onAcknowledge,
  onResolve,
  pendingAckId,
  pendingResolveId,
}: {
  alerts: AlertItem[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  pendingAckId: string | null;
  pendingResolveId: string | null;
}) {
  if (alerts.length === 0) return null;

  const severityColor = (s: string) =>
    s === "critical"
      ? "bg-red-500"
      : s === "warning"
      ? "bg-orange-400"
      : "bg-yellow-400";

  const severityBorder = (s: string) =>
    s === "critical"
      ? "border-red-300 dark:border-red-700"
      : s === "warning"
      ? "border-orange-300 dark:border-orange-700"
      : "border-yellow-300 dark:border-yellow-700";

  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />

      {alerts.map((alert, idx) => (
        <div key={alert.id} className="relative pb-5">
          {/* Timeline dot */}
          <div
            className={`absolute left-0 top-1 w-5 h-5 rounded-full border-2 border-background ${severityColor(alert.severity)} -translate-x-[2px] shadow`}
          />

          <div
            className={`ml-4 p-4 rounded-xl border bg-card/80 backdrop-blur-sm hover:shadow-sm transition-shadow animate-fade-in ${severityBorder(alert.severity)}`}
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{alert.site.name}</span>
                  <span>·</span>
                  <span>{new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <ResponseTimeBadge createdAt={alert.createdAt} status={alert.status} />
                </div>
              </div>
              {alert.status === "active" && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={pendingAckId === alert.id || pendingResolveId === alert.id}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 min-h-[32px] text-xs"
                  >
                    {pendingAckId === alert.id ? "…" : "Ack"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve(alert.id)}
                    disabled={pendingResolveId === alert.id || pendingAckId === alert.id}
                    className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 min-h-[32px] text-xs"
                  >
                    {pendingResolveId === alert.id ? "…" : "Resolve"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "advisory">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "acknowledged" | "resolved">("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "severity">("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAckId, setPendingAckId] = useState<string | null>(null);
  const [pendingResolveId, setPendingResolveId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const { data, isLoading, error, refetch } = trpc.alert.list.useQuery({ limit: 100 });

  const acknowledgeMutation = trpc.alert.acknowledge.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Alert acknowledged", description: "Marked as acknowledged" });
      refetch();
    },
    onError: (error: unknown) => {
      addToast({
        type: "error",
        title: "Failed to acknowledge",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const resolveMutation = trpc.alert.resolve.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Alert resolved", description: "Marked as resolved" });
      refetch();
    },
    onError: (error: unknown) => {
      addToast({
        type: "error",
        title: "Failed to resolve",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const handleAcknowledge = (id: string) => {
    if (acknowledgeMutation.isPending) return;
    setPendingAckId(id);
    acknowledgeMutation.mutate({ id }, { onSettled: () => setPendingAckId(null) });
  };

  const handleResolve = (id: string) => {
    if (resolveMutation.isPending) return;
    setPendingResolveId(id);
    resolveMutation.mutate({ id }, { onSettled: () => setPendingResolveId(null) });
  };

  // ─── Filter & Sort ─────────────────────────────────────────────────────────
  const rawItems: AlertItem[] | undefined = data?.items as AlertItem[] | undefined;

  const filteredAlerts = useMemo((): AlertItem[] => {
    const items = rawItems ?? [];
    if (items.length === 0) return [];

    let filtered = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.site.name.toLowerCase().includes(q) ||
          a.severity.toLowerCase().includes(q)
      );
    }

    if (severityFilter !== "all") {
      filtered = filtered.filter((a) => a.severity === severityFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    const rangeMs = getTimeRangeMs(timeRange);
    if (rangeMs !== null) {
      const cutoff = Date.now() - rangeMs;
      filtered = filtered.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "severity": {
          const order = { critical: 3, warning: 2, advisory: 1 };
          return (order[b.severity as keyof typeof order] || 0) -
                 (order[a.severity as keyof typeof order] || 0);
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [rawItems, searchQuery, severityFilter, statusFilter, timeRange, sortBy]);

  // ─── Bulk selection ────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map((a) => a.id)));
    }
  }, [selectedIds.size, filteredAlerts]);

  const handleBulkAcknowledge = useCallback(async () => {
    if (bulkPending) return;
    setBulkPending(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await new Promise<void>((res) => {
        acknowledgeMutation.mutate({ id }, { onSettled: () => res() });
      });
    }
    setSelectedIds(new Set());
    setBulkPending(false);
  }, [bulkPending, selectedIds, acknowledgeMutation]);

  const handleBulkResolve = useCallback(async () => {
    if (bulkPending) return;
    setBulkPending(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await new Promise<void>((res) => {
        resolveMutation.mutate({ id }, { onSettled: () => res() });
      });
    }
    setSelectedIds(new Set());
    setBulkPending(false);
  }, [bulkPending, selectedIds, resolveMutation]);

  const handleBulkExport = useCallback(() => {
    const selected = filteredAlerts.filter((a) => selectedIds.has(a.id));
    const csv = [
      "ID,Title,Message,Site,Severity,Status,Created",
      ...selected.map(
        (a) =>
          `"${a.id}","${a.title.replace(/"/g, '""')}","${a.message.replace(/"/g, '""')}","${a.site.name}","${a.severity}","${a.status}","${new Date(a.createdAt).toISOString()}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canopy-alerts-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAlerts, selectedIds]);

  const hasFilters =
    searchQuery || severityFilter !== "all" || statusFilter !== "all" || timeRange !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSeverityFilter("all");
    setStatusFilter("all");
    setTimeRange("all");
  };

  return (
    <main className="canopy-page">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
              Alerts
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Real-time safety alerts and notifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="List view"
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
                  viewMode === "timeline"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="Timeline view"
              >
                ⏱ Timeline
              </button>
            </div>

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

        {/* ─── Search and Filters ────────────────────────────────────────── */}
        <div className="space-y-3 mb-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, message, site or type…"
              className="w-full px-4 py-2.5 pl-10 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/50 min-h-[44px] text-sm"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Time range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 min-h-[40px] text-sm"
            >
              {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((k) => (
                <option key={k} value={k}>{TIME_RANGE_LABELS[k]}</option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as "all" | "critical" | "warning" | "advisory")}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 min-h-[40px] text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="advisory">Advisory</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "acknowledged" | "resolved")}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 min-h-[40px] text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "severity")}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 min-h-[40px] text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="severity">By Severity</option>
            </select>

            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="min-h-[40px] touch-manipulation"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Results count */}
          {hasFilters && (
            <div className="text-sm text-muted-foreground">
              Showing {filteredAlerts.length} of {data?.items.length || 0} alerts
            </div>
          )}
        </div>

        {/* ─── Bulk Actions Bar ──────────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-4 rounded-xl border border-primary/30 bg-primary/5 animate-fade-in">
            <span className="text-sm font-semibold text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkAcknowledge}
              disabled={bulkPending}
              className="min-h-[36px] border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 text-xs"
            >
              {bulkPending ? "Processing…" : "Acknowledge Selected"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkResolve}
              disabled={bulkPending}
              className="min-h-[36px] border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 text-xs"
            >
              Resolve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkExport}
              className="min-h-[36px] text-xs"
            >
              Export Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-[36px] text-xs text-muted-foreground"
            >
              Deselect all
            </Button>
          </div>
        )}
      </div>

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          <AlertCardSkeleton count={3} />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-800 dark:text-red-400 text-sm">
            Error loading alerts: {error.message}
          </p>
        </div>
      ) : filteredAlerts.length > 0 ? (
        <>
          {/* Timeline view */}
          {viewMode === "timeline" ? (
            <div className="pt-2">
              <TimelineView
                alerts={filteredAlerts}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
                pendingAckId={pendingAckId}
                pendingResolveId={pendingResolveId}
              />
            </div>
          ) : (
            /* List view */
            <div className="space-y-3">
              {/* Select-all row */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-primary rounded"
                  aria-label="Select all alerts"
                />
                <span className="text-xs text-muted-foreground">Select all</span>
              </div>

              {filteredAlerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={`card-gradient card-hover transition-all ${
                    selectedIds.has(alert.id) ? "ring-2 ring-primary/40 border-primary/40" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-3">
                      {/* Checkbox + Title */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(alert.id)}
                          onChange={() => toggleSelect(alert.id)}
                          className="w-4 h-4 accent-primary rounded mt-1 flex-shrink-0"
                          aria-label={`Select alert: ${alert.title}`}
                        />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                            {alert.severity === "critical" && <span className="text-xl">🔴</span>}
                            {alert.severity === "warning" && <span className="text-xl">🟠</span>}
                            {alert.severity === "advisory" && <span className="text-xl">🟡</span>}
                            <span className="break-words">{alert.title}</span>
                          </CardTitle>
                          <CardDescription className="mt-1">{alert.message}</CardDescription>
                          {/* Badges */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <ResponseTimeBadge createdAt={alert.createdAt} status={alert.status} />
                            <CorrelationBadge alerts={filteredAlerts} currentId={alert.id} />
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        {alert.status === "active" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledge(alert.id)}
                              disabled={pendingAckId === alert.id || pendingResolveId === alert.id}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 min-h-[40px] touch-manipulation text-xs"
                              title="Acknowledge"
                            >
                              {pendingAckId === alert.id ? "Acknowledging…" : "Acknowledge"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolve(alert.id)}
                              disabled={pendingResolveId === alert.id || pendingAckId === alert.id}
                              className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 min-h-[40px] touch-manipulation text-xs"
                              title="Resolve"
                            >
                              {pendingResolveId === alert.id ? "Resolving…" : "Resolve"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Site</span>
                        <p className="font-medium text-primary break-words mt-0.5">{alert.site.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Status</span>
                        <p className="font-medium capitalize mt-0.5">{alert.status}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Created</span>
                        <p className="font-medium break-words mt-0.5">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-lg font-medium text-muted-foreground mb-1">
              {hasFilters ? "No alerts match your filters" : "No alerts found"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {hasFilters
                ? "Try adjusting your search or filter criteria"
                : "Alerts will appear here when detected"}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
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
