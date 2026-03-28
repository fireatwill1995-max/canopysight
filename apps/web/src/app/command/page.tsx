"use client";

import { trpc } from "@/lib/trpc/client";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { useWebSocket } from "@/hooks/use-websocket";
import { TacticalMap } from "@/components/tactical-map";
import type { AlertItem, DetectionEvent, Device, Zone } from "@/components/tactical-map";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveAlertWS {
  id: string;
  severity: "advisory" | "warning" | "critical";
  title: string;
  message: string;
  siteId: string;
  deviceId?: string;
  timestamp: Date | string;
}

type SeverityFilter = "all" | "critical" | "warning" | "advisory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-900/80 text-red-300 border border-red-700 animate-pulse";
    case "warning":
      return "bg-amber-900/70 text-amber-300 border border-amber-700";
    default:
      return "bg-blue-900/60 text-blue-300 border border-blue-800";
  }
}

function severityDot(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]";
    case "warning":
      return "bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.5)]";
    default:
      return "bg-blue-400";
  }
}

function severityBorderColor(severity: string) {
  switch (severity) {
    case "critical":
      return "border-l-red-500";
    case "warning":
      return "border-l-amber-400";
    default:
      return "border-l-blue-400";
  }
}

function formatTs(ts: Date | string) {
  try {
    return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

function getThreatLevel(index: number): { level: number; label: string; color: string; bgColor: string } {
  if (index >= 80) return { level: 1, label: "CRITICAL", color: "text-red-400", bgColor: "bg-red-900/60 border-red-700" };
  if (index >= 60) return { level: 2, label: "SEVERE", color: "text-orange-400", bgColor: "bg-orange-900/50 border-orange-700" };
  if (index >= 40) return { level: 3, label: "ELEVATED", color: "text-amber-400", bgColor: "bg-amber-900/40 border-amber-700" };
  if (index >= 20) return { level: 4, label: "GUARDED", color: "text-yellow-400", bgColor: "bg-yellow-900/30 border-yellow-800" };
  return { level: 5, label: "NOMINAL", color: "text-green-400", bgColor: "bg-green-900/30 border-green-800" };
}

function getAlertTimeGroup(ts: Date | string): "5min" | "30min" | "older" {
  const now = Date.now();
  const alertTime = new Date(ts).getTime();
  const diffMs = now - alertTime;
  if (diffMs < 5 * 60 * 1000) return "5min";
  if (diffMs < 30 * 60 * 1000) return "30min";
  return "older";
}

// ─── Threat Gauge SVG ─────────────────────────────────────────────────────────

function ThreatGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (clamped / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 40;
  const cx = 50;
  const cy = 50;
  const x = cx - r * Math.cos(rad);
  const y = cy - r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const color = clamped >= 70 ? "#ef4444" : clamped >= 40 ? "#f59e0b" : "#22c55e";

  return (
    <svg viewBox="0 0 100 58" className="w-full max-w-[140px] mx-auto">
      {/* Background arc */}
      <path
        d={`M 10 50 A 40 40 0 0 1 90 50`}
        fill="none"
        stroke="rgba(100,116,139,0.2)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Value arc */}
      {clamped > 0 && (
        <path
          d={`M 10 50 A 40 40 0 ${largeArc} 1 ${x} ${y}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
      )}
      {/* Center value */}
      <text x="50" y="46" textAnchor="middle" fill={color} fontSize="16" fontFamily="monospace" fontWeight="bold">
        {clamped}
      </text>
      <text x="50" y="56" textAnchor="middle" fill="rgb(148,163,184)" fontSize="6" fontFamily="monospace">
        THREAT INDEX
      </text>
    </svg>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function CommandSkeleton() {
  return (
    <div
      className="flex flex-col animate-pulse"
      style={{ minHeight: "calc(100vh - 64px)", background: "#0a0f1a", color: "#e2e8f0" }}
    >
      <div className="flex items-center gap-4 px-4 py-3 border-b" style={{ borderColor: "rgba(22,163,74,0.3)" }}>
        <div className="h-4 w-32 bg-slate-800 rounded" />
        <div className="h-4 w-24 bg-slate-800 rounded" />
        <div className="h-4 w-20 bg-slate-800 rounded" />
        <div className="ml-auto h-4 w-28 bg-slate-800 rounded" />
      </div>
      <div className="flex flex-1">
        <div className="w-[300px] border-r border-slate-800/50 p-3 space-y-2">
          <div className="h-6 w-24 bg-slate-800 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded" />
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="h-6 w-6 rounded-full border-2 border-green-800/50 mx-auto flex items-center justify-center">
              <span className="w-2 h-2 bg-green-900/50 rounded-full" />
            </div>
            <p className="text-slate-700 text-xs font-mono">INITIALIZING TACTICAL GRID...</p>
          </div>
        </div>
        <div className="w-[260px] border-l border-slate-800/50 p-3 space-y-2">
          <div className="h-6 w-20 bg-slate-800 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Command Page ─────────────────────────────────────────────────────────────

export default function CommandPage() {
  const canQuery = useCanUseProtectedTrpc();
  const [pulseTime, setPulseTime] = useState(0);
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(undefined);
  const [focusedAlertId, setFocusedAlertId] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertWS[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [clock, setClock] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const alertFeedRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());

  // Real-time clock
  useEffect(() => {
    const update = () => {
      setClock(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Uptime
  const [uptime, setUptime] = useState("00:00:00");
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      setUptime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animation loop for tactical map pulsing
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      timeRef.current += 1;
      setPulseTime(timeRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // WebSocket for live alerts
  const { connected } = useWebSocket({
    onAlert: (alert: LiveAlertWS) => {
      if (selectedSiteId && alert.siteId !== selectedSiteId) return;
      setLiveAlerts((prev) => [alert, ...prev].slice(0, 60));
      setLastUpdate(new Date());
      setNewAlertIds((prev) => new Set(prev).add(alert.id));
      // Clear "new" indicator after 10 seconds
      setTimeout(() => {
        setNewAlertIds((prev) => {
          const next = new Set(prev);
          next.delete(alert.id);
          return next;
        });
      }, 10000);
    },
    onDetection: () => {
      setLastUpdate(new Date());
    },
  });

  // tRPC queries
  const { data: sites } = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });

  const { data: devicesData, isLoading: devicesLoading } = trpc.device.list.useQuery(
    { siteId: selectedSiteId },
    { enabled: canQuery, retry: false, refetchInterval: 30000 }
  );

  const { data: activeAlertsData, isLoading: alertsLoading, refetch: refetchAlerts } = trpc.alert.list.useQuery(
    { siteId: selectedSiteId, status: "active", limit: 50 },
    { enabled: canQuery, retry: false, refetchInterval: 15000 }
  );

  const thirtyMinAgo = useRef(new Date(Date.now() - 30 * 60 * 1000));
  const { data: detectionsData } = trpc.detection.list.useQuery(
    {
      siteId: selectedSiteId,
      startDate: thirtyMinAgo.current,
      endDate: new Date(),
      limit: 50,
    },
    { enabled: canQuery, retry: false, refetchInterval: 20000 }
  );

  const { data: zonesData } = trpc.zone.list.useQuery(
    { siteId: selectedSiteId },
    { enabled: canQuery && !!selectedSiteId, retry: false }
  );

  // Alert mutations
  const acknowledgeMutation = trpc.alert.acknowledge.useMutation({
    onSuccess: () => { refetchAlerts(); },
  });

  const resolveMutation = trpc.alert.resolve.useMutation({
    onSuccess: () => { refetchAlerts(); },
  });

  const handleAcknowledge = useCallback((id: string) => {
    if (acknowledgeMutation.isPending) return;
    acknowledgeMutation.mutate({ id });
  }, [acknowledgeMutation]);

  const handleResolve = useCallback((id: string) => {
    if (resolveMutation.isPending) return;
    resolveMutation.mutate({ id });
  }, [resolveMutation]);

  // Auto-select first site
  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // Scroll alert feed to top when new alert arrives
  useEffect(() => {
    if (alertFeedRef.current) {
      alertFeedRef.current.scrollTop = 0;
    }
  }, [liveAlerts.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        setFocusedAlertId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Combine tRPC alerts + WebSocket live alerts
  const trpcAlerts: AlertItem[] = (activeAlertsData?.items ?? []).map((a) => ({
    id: a.id,
    severity: a.severity as "advisory" | "warning" | "critical",
    title: a.title,
    message: a.message,
    siteId: a.site?.id ?? "",
    deviceId: a.device?.id ?? null,
    createdAt: a.createdAt,
    site: a.site,
    device: a.device,
  }));

  const wsAlertsMapped: AlertItem[] = liveAlerts.map((a) => ({
    id: a.id,
    severity: a.severity,
    title: a.title,
    message: a.message,
    siteId: a.siteId,
    deviceId: a.deviceId ?? null,
    createdAt: a.timestamp,
  }));

  // Deduplicate: ws alerts take precedence (newer)
  const wsIds = new Set(wsAlertsMapped.map((a) => a.id));
  const mergedAlerts: AlertItem[] = [
    ...wsAlertsMapped,
    ...trpcAlerts.filter((a) => !wsIds.has(a.id)),
  ].slice(0, 60);

  const detections: DetectionEvent[] = (detectionsData?.items ?? []) as DetectionEvent[];
  const devices: Device[] = (devicesData ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
  }));
  const zones: Zone[] = (zonesData ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    type: z.type,
    isActive: z.isActive,
    points: z.points,
  }));

  // Stats
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === "online").length;
  const criticalAlerts = mergedAlerts.filter((a) => a.severity === "critical").length;
  const warningAlerts = mergedAlerts.filter((a) => a.severity === "warning").length;
  const advisoryAlerts = mergedAlerts.filter((a) => a.severity === "advisory").length;
  const totalActiveAlerts = mergedAlerts.length;
  const threatIndex = Math.min(
    100,
    Math.round((criticalAlerts * 30 + (totalActiveAlerts - criticalAlerts) * 10) / Math.max(1, totalDevices) * 5)
  );
  const threat = getThreatLevel(threatIndex);

  // Detection type breakdown
  const detectionBreakdown = useMemo(() => {
    const counts: Record<string, number> = { person: 0, vehicle: 0, animal: 0, drone: 0 };
    for (const d of detections) {
      const t = (d.type ?? "").toLowerCase();
      if (t.includes("person") || t.includes("human")) counts.person++;
      else if (t.includes("vehicle") || t.includes("car") || t.includes("truck")) counts.vehicle++;
      else if (t.includes("animal") || t.includes("wildlife")) counts.animal++;
      else if (t.includes("drone") || t.includes("uav")) counts.drone++;
    }
    return counts;
  }, [detections]);

  const maxDetCount = Math.max(1, ...Object.values(detectionBreakdown));

  const handleAlertClick = useCallback(
    (alertId: string) => {
      setFocusedAlertId(alertId);
      if (alertFeedRef.current) {
        const el = alertFeedRef.current.querySelector(`[data-alert-id="${alertId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    []
  );

  // All alerts for the feed display (ws + trpc, deduplicated)
  const allFeedAlerts: AlertItem[] = [
    ...wsAlertsMapped,
    ...trpcAlerts.filter((ta) => !wsAlertsMapped.find((w) => w.id === ta.id)),
  ].slice(0, 60);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (severityFilter === "all") return allFeedAlerts;
    return allFeedAlerts.filter((a) => a.severity === severityFilter);
  }, [allFeedAlerts, severityFilter]);

  // Group by time
  const groupedAlerts = useMemo(() => {
    const groups: { label: string; key: string; alerts: AlertItem[] }[] = [
      { label: "Last 5 min", key: "5min", alerts: [] },
      { label: "Last 30 min", key: "30min", alerts: [] },
      { label: "Older", key: "older", alerts: [] },
    ];
    for (const alert of filteredAlerts) {
      const group = getAlertTimeGroup(alert.createdAt ?? new Date());
      const target = groups.find((g) => g.key === group);
      if (target) target.alerts.push(alert);
    }
    return groups.filter((g) => g.alerts.length > 0);
  }, [filteredAlerts]);

  // Show loading skeleton
  if (canQuery && alertsLoading && devicesLoading) {
    return <CommandSkeleton />;
  }

  const filterTabs: { key: SeverityFilter; label: string; count: number; color: string }[] = [
    { key: "all", label: "All", count: allFeedAlerts.length, color: "text-slate-300" },
    { key: "critical", label: "Critical", count: criticalAlerts, color: "text-red-400" },
    { key: "warning", label: "Warning", count: warningAlerts, color: "text-amber-400" },
    { key: "advisory", label: "Advisory", count: advisoryAlerts, color: "text-blue-400" },
  ];

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "calc(100vh - 64px)", background: "#0a0f1a", color: "#e2e8f0" }}
    >
      {/* ── Top Status Bar ── */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: "rgba(22,163,74,0.3)", background: "rgba(10,15,26,0.98)" }}
      >
        {/* Branding */}
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: "#22c55e",
              boxShadow: "0 0 8px 2px rgba(34,197,94,0.6)",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            className="text-green-400 font-mono text-sm font-bold tracking-widest uppercase"
            style={{ textShadow: "0 0 12px rgba(34,197,94,0.4)" }}
          >
            CANOPY COMMAND
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700/50" />

        {/* Clock */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">UTC</span>
          <span className="text-sm font-mono text-slate-200 tabular-nums">{clock}</span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700/50" />

        {/* Threat Level */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded border ${threat.bgColor}`}>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">DEFCON</span>
          <span className={`text-base font-bold font-mono ${threat.color}`}>
            {threat.level}
          </span>
          <span className={`text-xs font-mono uppercase tracking-wide ${threat.color}`}>
            {threat.label}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700/50" />

        {/* Active Alerts */}
        <div className="flex items-center gap-2 px-3 py-1 rounded border border-amber-900/50 bg-amber-950/30">
          <span className="text-xs text-amber-400 font-mono uppercase tracking-wider">Alerts</span>
          <span className={`text-base font-bold font-mono ${totalActiveAlerts > 0 ? "text-amber-300" : "text-gray-400"}`}>
            {alertsLoading ? "..." : totalActiveAlerts}
          </span>
        </div>

        {/* Devices */}
        <div className="flex items-center gap-2 px-3 py-1 rounded border border-green-900/50 bg-green-950/20">
          <span className="text-xs text-green-400 font-mono uppercase tracking-wider">Devices</span>
          <span className="text-base font-bold font-mono text-green-300">
            {devicesLoading ? "..." : `${onlineDevices}/${totalDevices}`}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700/50" />

        {/* Network / WS Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-600"}`}
            style={connected ? { boxShadow: "0 0 6px rgba(34,197,94,0.7)" } : {}}
          />
          <span className={`text-xs font-mono ${connected ? "text-green-400" : "text-gray-500"}`}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        {/* Uptime */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Up</span>
          <span className="text-xs font-mono text-slate-400 tabular-nums">{uptime}</span>
        </div>

        {/* Site selector – pushed right */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono uppercase">Site</span>
          <select
            value={selectedSiteId ?? ""}
            onChange={(e) => setSelectedSiteId(e.target.value || undefined)}
            className="text-sm font-mono bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-green-600"
          >
            <option value="">All Sites</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* ── Left Panel: Alert Feed ── */}
        <div
          className="flex flex-col"
          style={{
            width: 320,
            minWidth: 260,
            borderRight: "1px solid rgba(22,163,74,0.2)",
            background: "rgba(10,15,26,0.97)",
            flexShrink: 0,
          }}
        >
          {/* Header */}
          <div
            className="px-3 py-2 flex items-center justify-between border-b"
            style={{ borderColor: "rgba(22,163,74,0.2)" }}
          >
            <span className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase">
              Alert Feed
            </span>
            {newAlertIds.size > 0 && (
              <span className="flex items-center gap-1 text-xs font-mono text-amber-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {newAlertIds.size} new
              </span>
            )}
            {allFeedAlerts.length > 0 && (
              <span className="text-xs font-mono bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded border border-red-800/60">
                {allFeedAlerts.length}
              </span>
            )}
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex border-b" style={{ borderColor: "rgba(22,163,74,0.15)" }}>
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSeverityFilter(tab.key)}
                className={`flex-1 px-2 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors relative ${
                  severityFilter === tab.key
                    ? `${tab.color} bg-slate-800/60`
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${
                    severityFilter === tab.key ? "bg-slate-700/60" : "bg-slate-800/40"
                  }`}>
                    {tab.count}
                  </span>
                )}
                {severityFilter === tab.key && (
                  <motion.div
                    layoutId="severity-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500"
                    style={{ boxShadow: "0 0 6px rgba(34,197,94,0.5)" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Alert List */}
          <div
            ref={alertFeedRef}
            className="flex-1 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            <AnimatePresence initial={false}>
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-green-800/60 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(22,163,74)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-green-500 text-sm font-mono font-bold tracking-widest">ALL CLEAR</p>
                  <p className="text-slate-600 text-xs font-mono text-center">
                    {severityFilter === "all" ? "No active alerts detected" : `No ${severityFilter} alerts`}
                  </p>
                  <p className="text-slate-700 text-xs font-mono text-center">Systems operating within normal parameters</p>
                </div>
              ) : (
                groupedAlerts.map((group) => (
                  <div key={group.key}>
                    <div className="px-3 py-1 sticky top-0 z-10" style={{ background: "rgba(10,15,26,0.95)" }}>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        {group.label}
                      </span>
                    </div>
                    {group.alerts.map((alert) => (
                      <motion.div
                        key={alert.id}
                        data-alert-id={alert.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => setFocusedAlertId(focusedAlertId === alert.id ? null : alert.id)}
                        className={`mx-2 my-1 p-2 rounded cursor-pointer border-l-2 border transition-all ${severityBorderColor(alert.severity)} ${
                          focusedAlertId === alert.id
                            ? "border-green-600 bg-green-950/40"
                            : "border-transparent hover:border-slate-700 hover:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${severityDot(alert.severity)}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-mono uppercase tracking-wide ${severityBadge(alert.severity)}`}>
                                {alert.severity}
                              </span>
                              {newAlertIds.has(alert.id) && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-amber-900/50 text-amber-300 font-mono animate-pulse">
                                  NEW
                                </span>
                              )}
                              <span className="text-xs text-slate-400 font-mono truncate">
                                {formatTs(alert.createdAt ?? new Date())}
                              </span>
                            </div>
                            <p className="text-sm font-semibold mt-0.5 text-slate-200 leading-tight truncate">
                              {alert.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">
                              {alert.message}
                            </p>
                            {alert.device && (
                              <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                                {alert.device.name}
                              </p>
                            )}
                            {/* Quick Actions */}
                            <div className="flex gap-1.5 mt-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id); }}
                                disabled={acknowledgeMutation.isPending}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                              >
                                ACK
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleResolve(alert.id); }}
                                disabled={resolveMutation.isPending}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-800/50 hover:bg-green-900/60 transition-colors disabled:opacity-50"
                              >
                                RESOLVE
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Center: Tactical Map ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-1.5 border-b text-xs font-mono text-slate-500"
            style={{ borderColor: "rgba(22,163,74,0.15)" }}
          >
            <span className="text-green-600 uppercase tracking-widest">Tactical Grid</span>
            {selectedSiteId && sites && (
              <motion.span
                key={selectedSiteId}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-slate-400"
              >
                {sites.find((s) => s.id === selectedSiteId)?.name ?? selectedSiteId}
              </motion.span>
            )}
            <span className="ml-auto text-slate-600">
              {detections.length} detections · {zones.length} zones · {devices.length} devices
            </span>
          </div>

          <div className="flex-1 overflow-hidden">
            <TacticalMap
              siteId={selectedSiteId}
              detections={detections}
              zones={zones}
              devices={devices}
              alerts={mergedAlerts}
              onAlertClick={handleAlertClick}
              pulseTime={pulseTime}
            />
          </div>
        </div>

        {/* ── Right Panel: Stats & Devices ── */}
        <div
          className="flex flex-col gap-0"
          style={{
            width: 280,
            minWidth: 220,
            borderLeft: "1px solid rgba(22,163,74,0.2)",
            background: "rgba(10,15,26,0.97)",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          {/* Threat Gauge */}
          <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(22,163,74,0.2)" }}>
            <ThreatGauge value={threatIndex} />
          </div>

          {/* Active Stats */}
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: "rgba(22,163,74,0.2)" }}
          >
            <p className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
              Active Stats
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Critical", value: criticalAlerts, color: "text-red-400" },
                { label: "Warnings", value: warningAlerts, color: "text-amber-400" },
                { label: "Advisory", value: advisoryAlerts, color: "text-blue-400" },
                { label: "Detections", value: detections.length, color: "text-green-400" },
                { label: "Zones", value: zones.length, color: "text-purple-400" },
                { label: "Sites", value: sites?.length ?? 0, color: "text-slate-300" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-900/60 rounded p-2 border border-slate-800/60">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">{s.label}</p>
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detection Breakdown */}
          <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(22,163,74,0.2)" }}>
            <p className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
              Detection Types
            </p>
            <div className="space-y-1.5">
              {[
                { label: "Persons", key: "person", color: "bg-blue-500" },
                { label: "Vehicles", key: "vehicle", color: "bg-amber-500" },
                { label: "Animals", key: "animal", color: "bg-green-500" },
                { label: "Drones", key: "drone", color: "bg-red-500" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono w-16 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 h-3 bg-slate-800/60 rounded-sm overflow-hidden">
                    <motion.div
                      className={`h-full ${item.color} rounded-sm`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(detectionBreakdown[item.key] / maxDetCount) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono w-5 text-right">{detectionBreakdown[item.key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(22,163,74,0.2)" }}>
            <p className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
              System Health
            </p>
            <div className="space-y-1.5">
              {[
                { label: "API Server", status: canQuery ? "operational" : "degraded" },
                { label: "WebSocket", status: connected ? "operational" : "disconnected" },
                { label: "Database", status: canQuery ? "operational" : "unknown" },
              ].map((sys) => (
                <div key={sys.label} className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/40 border border-slate-800/30">
                  <span className="text-xs font-mono text-slate-300">{sys.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sys.status === "operational"
                          ? "bg-green-500"
                          : sys.status === "degraded"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={sys.status === "operational" ? { boxShadow: "0 0 4px rgba(34,197,94,0.5)" } : {}}
                    />
                    <span className={`text-[10px] font-mono uppercase ${
                      sys.status === "operational" ? "text-green-400" : sys.status === "degraded" ? "text-amber-400" : "text-red-400"
                    }`}>
                      {sys.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device List */}
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: "rgba(22,163,74,0.2)" }}
          >
            <p className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
              Devices
            </p>
            {devicesLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-slate-800/50 rounded animate-pulse" />
                ))}
              </div>
            ) : devices.length === 0 ? (
              <p className="text-slate-600 text-xs font-mono">No devices</p>
            ) : (
              <div className="space-y-1">
                {devices.slice(0, 10).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-900/50 border border-slate-800/40"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          device.status === "online"
                            ? "bg-green-500"
                            : device.status === "offline"
                              ? "bg-gray-600"
                              : "bg-amber-500"
                        }`}
                        style={device.status === "online" ? { boxShadow: "0 0 5px rgba(34,197,94,0.6)" } : {}}
                      />
                      <span className="text-xs font-mono text-slate-300 truncate">{device.name}</span>
                    </div>
                    <span
                      className={`text-xs font-mono px-1 rounded ${
                        device.status === "online"
                          ? "text-green-400 bg-green-950/50"
                          : "text-gray-500 bg-slate-800/50"
                      }`}
                    >
                      {device.status}
                    </span>
                  </div>
                ))}
                {devices.length > 10 && (
                  <p className="text-xs text-slate-600 font-mono text-center pt-1">
                    +{devices.length - 10} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2">
            <p className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
              Quick Actions
            </p>
            <div className="space-y-1.5">
              <button className="w-full text-xs font-mono px-3 py-2 rounded bg-red-900/30 text-red-300 border border-red-800/40 hover:bg-red-900/50 transition-colors text-left flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                LOCKDOWN MODE
              </button>
              <button className="w-full text-xs font-mono px-3 py-2 rounded bg-amber-900/30 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50 transition-colors text-left flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
                SILENT ALERT
              </button>
              <button className="w-full text-xs font-mono px-3 py-2 rounded bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-800/70 transition-colors text-left flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                GENERATE REPORT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
