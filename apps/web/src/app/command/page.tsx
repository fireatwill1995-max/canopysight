"use client";

import { trpc } from "@/lib/trpc/client";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { useWebSocket } from "@/hooks/use-websocket";
import { TacticalMap } from "@/components/tactical-map";
import type { AlertItem, DetectionEvent, Device, Zone } from "@/components/tactical-map";
import { useEffect, useRef, useState, useCallback } from "react";
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

function formatTs(ts: Date | string) {
  try {
    return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

// ─── Command Page ─────────────────────────────────────────────────────────────

export default function CommandPage() {
  const canQuery = useCanUseProtectedTrpc();
  const [pulseTime, setPulseTime] = useState(0);
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(undefined);
  const [focusedAlertId, setFocusedAlertId] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertWS[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const alertFeedRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);

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

  const { data: activeAlertsData, isLoading: alertsLoading } = trpc.alert.list.useQuery(
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
  const totalActiveAlerts = mergedAlerts.length;
  const threatIndex = Math.min(
    100,
    Math.round((criticalAlerts * 30 + (totalActiveAlerts - criticalAlerts) * 10) / Math.max(1, totalDevices) * 5)
  );

  const handleAlertClick = useCallback(
    (alertId: string) => {
      setFocusedAlertId(alertId);
      // Scroll to alert in feed
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

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "calc(100vh - 64px)", background: "#0a0f1a", color: "#e2e8f0" }}
    >
      {/* ── Top Status Bar ── */}
      <div
        className="flex flex-wrap items-center gap-4 px-4 py-2 border-b"
        style={{ borderColor: "rgba(22,163,74,0.3)", background: "rgba(10,15,26,0.98)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: "#22c55e",
              boxShadow: "0 0 8px 2px rgba(34,197,94,0.6)",
              animation: "pulse 2s infinite",
            }}
          />
          <span className="text-green-400 font-mono text-sm font-bold tracking-widest uppercase">
            COMMAND
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-4">
          {/* Threat Index */}
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-red-900/60 bg-red-950/40">
            <span className="text-xs text-red-400 font-mono uppercase tracking-wider">Threat Index</span>
            <span
              className={`text-base font-bold font-mono ${
                threatIndex >= 60 ? "text-red-400" : threatIndex >= 30 ? "text-amber-400" : "text-green-400"
              }`}
            >
              {threatIndex}
            </span>
            <span className="text-xs text-red-600">/100</span>
          </div>

          {/* Active Alerts */}
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-amber-900/50 bg-amber-950/30">
            <span className="text-xs text-amber-400 font-mono uppercase tracking-wider">Active Alerts</span>
            <span className={`text-base font-bold font-mono ${totalActiveAlerts > 0 ? "text-amber-300" : "text-gray-400"}`}>
              {alertsLoading ? "…" : totalActiveAlerts}
            </span>
          </div>

          {/* Devices */}
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-green-900/50 bg-green-950/20">
            <span className="text-xs text-green-400 font-mono uppercase tracking-wider">Devices</span>
            <span className="text-base font-bold font-mono text-green-300">
              {devicesLoading ? "…" : `${onlineDevices}/${totalDevices}`}
            </span>
            <span className="text-xs text-green-700">online</span>
          </div>

          {/* Last Update */}
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-slate-700/50 bg-slate-900/30">
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Updated</span>
            <span className="text-sm font-mono text-slate-300">{formatTs(lastUpdate)}</span>
          </div>

          {/* WS Connection */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-600"}`}
              style={connected ? { boxShadow: "0 0 6px rgba(34,197,94,0.7)" } : {}}
            />
            <span className={`text-xs font-mono ${connected ? "text-green-400" : "text-gray-500"}`}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Site selector */}
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
            width: 300,
            minWidth: 240,
            borderRight: "1px solid rgba(22,163,74,0.2)",
            background: "rgba(10,15,26,0.97)",
            flexShrink: 0,
          }}
        >
          <div
            className="px-3 py-2 flex items-center justify-between border-b"
            style={{ borderColor: "rgba(22,163,74,0.2)" }}
          >
            <span className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase">
              Alert Feed
            </span>
            {allFeedAlerts.length > 0 && (
              <span className="text-xs font-mono bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded border border-red-800/60">
                {allFeedAlerts.length}
              </span>
            )}
          </div>

          <div
            ref={alertFeedRef}
            className="flex-1 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 160px)" }}
          >
            <AnimatePresence initial={false}>
              {allFeedAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <div className="w-8 h-8 rounded-full border-2 border-green-800 flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-600 rounded-full" />
                  </div>
                  <p className="text-slate-500 text-xs font-mono text-center">No active alerts</p>
                  <p className="text-slate-600 text-xs font-mono text-center">System nominal</p>
                </div>
              ) : (
                allFeedAlerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    data-alert-id={alert.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setFocusedAlertId(focusedAlertId === alert.id ? null : alert.id)}
                    className={`mx-2 my-1 p-2 rounded cursor-pointer border transition-all ${
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
                      </div>
                    </div>
                  </motion.div>
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
              <span className="text-slate-400">
                {sites.find((s) => s.id === selectedSiteId)?.name ?? selectedSiteId}
              </span>
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
            width: 260,
            minWidth: 200,
            borderLeft: "1px solid rgba(22,163,74,0.2)",
            background: "rgba(10,15,26,0.97)",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
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
                { label: "Warnings", value: mergedAlerts.filter((a) => a.severity === "warning").length, color: "text-amber-400" },
                { label: "Advisory", value: mergedAlerts.filter((a) => a.severity === "advisory").length, color: "text-blue-400" },
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

          {/* Recent Detections */}
          <div className="px-3 py-2">
            <p className="text-green-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
              Recent Detections
            </p>
            {detections.length === 0 ? (
              <p className="text-slate-600 text-xs font-mono">No recent detections</p>
            ) : (
              <div className="space-y-1">
                {detections.slice(0, 8).map((d) => {
                  const risk = typeof d.riskScore === "number" ? d.riskScore : 0;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 py-1 px-2 rounded bg-slate-900/40 border border-slate-800/30"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          risk >= 70 ? "bg-red-500" : risk >= 40 ? "bg-amber-400" : "bg-green-400"
                        }`}
                      />
                      <span className="text-xs font-mono text-slate-300 truncate flex-1">{d.type}</span>
                      {d.confidence != null && (
                        <span className="text-xs text-slate-500 font-mono flex-shrink-0">
                          {Math.round((d.confidence as number) * 100)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
