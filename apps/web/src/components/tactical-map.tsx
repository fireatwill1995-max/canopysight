"use client";

import { useEffect, useRef, useCallback } from "react";

export interface DetectionEvent {
  id: string;
  type: string;
  confidence?: number | null;
  riskScore?: number | null;
  timestamp?: Date | string;
  boundingBox?: { x: number; y: number; width: number; height: number } | null | unknown;
  device?: { id: string; name?: string } | null;
  site?: { id: string; name?: string; latitude?: number | null; longitude?: number | null } | null;
}

export interface Zone {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  points: unknown;
}

export interface Device {
  id: string;
  name: string;
  status: string;
  type?: string;
}

export interface AlertItem {
  id: string;
  severity: "advisory" | "warning" | "critical";
  title: string;
  message: string;
  siteId?: string;
  deviceId?: string | null;
  createdAt?: Date | string;
  site?: { id: string; name?: string; latitude?: number | null; longitude?: number | null } | null;
  device?: { id: string; name?: string; status?: string } | null;
}

export interface TacticalMapProps {
  siteId?: string;
  detections?: DetectionEvent[];
  zones?: Zone[];
  devices?: Device[];
  alerts?: AlertItem[];
  onAlertClick?: (alertId: string) => void;
  /** Fixed pixel height. If omitted the canvas fills the container's available height. */
  height?: number;
  pulseTime?: number; // increments to drive pulse animation
}

// Deterministic pseudo-random position from an id string
function hashToPos(id: string, maxW: number, maxH: number, margin = 40): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  const h2 = (h * 1664525 + 1013904223) | 0;
  const x = margin + (Math.abs(h) % (maxW - margin * 2));
  const y = margin + (Math.abs(h2) % (maxH - margin * 2));
  return { x, y };
}

const ZONE_COLORS: Record<string, string> = {
  exclusion: "rgba(239,68,68,0.18)",
  approach: "rgba(251,191,36,0.18)",
  crossing: "rgba(59,130,246,0.18)",
  custom: "rgba(139,92,246,0.18)",
};

const ZONE_BORDER: Record<string, string> = {
  exclusion: "rgba(239,68,68,0.7)",
  approach: "rgba(251,191,36,0.7)",
  crossing: "rgba(59,130,246,0.7)",
  custom: "rgba(139,92,246,0.7)",
};

export function TacticalMap({
  detections = [],
  zones = [],
  devices = [],
  alerts = [],
  onAlertClick,
  height,
  pulseTime = 0,
}: TacticalMapProps) {
  const resolvedHeight = height ?? 520;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const t = pulseTime;

    // Background
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    const gridStep = 40;
    ctx.strokeStyle = "rgba(30,60,90,0.55)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Crosshairs at center
    ctx.strokeStyle = "rgba(22,163,74,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Outer border
    ctx.strokeStyle = "rgba(22,163,74,0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Corner tick marks (tactical style)
    const tick = 16;
    ctx.strokeStyle = "rgba(22,163,74,0.9)";
    ctx.lineWidth = 2;
    for (const [cx, cy, dx, dy] of [
      [4, 4, 1, 1],
      [W - 4, 4, -1, 1],
      [4, H - 4, 1, -1],
      [W - 4, H - 4, -1, -1],
    ] as [number, number, number, number][]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * tick, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + dy * tick);
      ctx.stroke();
    }

    // Zones as polygon overlays
    zones.forEach((zone) => {
      const pts = Array.isArray(zone.points)
        ? (zone.points as Array<{ x: number; y: number }>)
        : [];
      if (pts.length < 3) {
        // Fall back to bounding rect derived from hash
        const pos = hashToPos(zone.id, W, H, 60);
        const zW = 80 + (zone.id.charCodeAt(0) % 60);
        const zH = 50 + (zone.id.charCodeAt(1) % 40);
        const fill = ZONE_COLORS[zone.type] ?? "rgba(100,100,200,0.15)";
        const border = ZONE_BORDER[zone.type] ?? "rgba(100,100,200,0.6)";
        ctx.fillStyle = fill;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.fillRect(pos.x - zW / 2, pos.y - zH / 2, zW, zH);
        ctx.strokeRect(pos.x - zW / 2, pos.y - zH / 2, zW, zH);
        ctx.setLineDash([]);
        ctx.fillStyle = border;
        ctx.font = "bold 10px monospace";
        ctx.fillText(zone.name.slice(0, 14), pos.x - zW / 2 + 4, pos.y - zH / 2 + 14);
        return;
      }
      // Draw actual polygon
      const fill = ZONE_COLORS[zone.type] ?? "rgba(100,100,200,0.15)";
      const border = ZONE_BORDER[zone.type] ?? "rgba(100,100,200,0.6)";
      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * W, pts[0].y * H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      // Label
      const cx = pts.reduce((a, p) => a + p.x * W, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y * H, 0) / pts.length;
      ctx.fillStyle = border;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(zone.name.slice(0, 14), cx, cy);
      ctx.textAlign = "left";
    });

    // Recent detections as fading blips
    const now = Date.now();
    detections.slice(0, 30).forEach((d) => {
      const pos = hashToPos(d.id, W, H, 50);
      const ts = d.timestamp ? new Date(d.timestamp).getTime() : now;
      const age = (now - ts) / (30 * 60 * 1000); // 0..1 over 30 min
      const alpha = Math.max(0, 1 - age);
      const risk = typeof d.riskScore === "number" ? d.riskScore : 50;
      let color: string;
      if (risk >= 70) color = `rgba(239,68,68,${alpha * 0.85})`;
      else if (risk >= 40) color = `rgba(251,191,36,${alpha * 0.85})`;
      else color = `rgba(34,197,94,${alpha * 0.85})`;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // Ripple
      const rippleR = 5 + ((t * 0.05 + pos.x * 0.01) % 1) * 14;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${alpha * 0.35})`);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = `rgba(200,220,255,${alpha * 0.8})`;
      ctx.font = "9px monospace";
      ctx.fillText(d.type.slice(0, 10), pos.x + 7, pos.y + 4);
    });

    // Devices
    devices.forEach((device) => {
      const pos = hashToPos(device.id, W, H, 50);
      const online = device.status === "online";
      const color = online ? "#22c55e" : "#6b7280";
      const glowColor = online ? "rgba(34,197,94,0.4)" : "rgba(107,114,128,0.3)";

      // Glow
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 14);
      grad.addColorStop(0, glowColor);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Camera icon — square with notch
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pos.x - 9, pos.y - 6, 14, 11, 2);
      ctx.fill();
      // Lens triangle
      ctx.beginPath();
      ctx.moveTo(pos.x + 5, pos.y - 2);
      ctx.lineTo(pos.x + 11, pos.y - 5);
      ctx.lineTo(pos.x + 11, pos.y + 4);
      ctx.closePath();
      ctx.fill();
      // Lens circle
      ctx.beginPath();
      ctx.arc(pos.x - 2, pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0f1a";
      ctx.fill();

      // Label
      ctx.fillStyle = online ? "#86efac" : "#9ca3af";
      ctx.font = "9px monospace";
      ctx.fillText(device.name.slice(0, 12), pos.x - 8, pos.y + 20);
    });

    // Alerts as pulsing rings
    alerts.forEach((alert) => {
      const pos = hashToPos(alert.id, W, H, 50);
      const isCritical = alert.severity === "critical";
      const isWarning = alert.severity === "warning";

      const phase = (t * (isCritical ? 0.08 : 0.05) + pos.x * 0.005) % 1;
      const pulseR = 10 + phase * (isCritical ? 20 : 14);
      const pulseAlpha = 1 - phase;

      const color = isCritical
        ? `rgba(239,68,68,${pulseAlpha * 0.9})`
        : isWarning
          ? `rgba(251,191,36,${pulseAlpha * 0.9})`
          : `rgba(34,197,94,${pulseAlpha * 0.9})`;

      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Second ring (offset phase)
      if (isCritical) {
        const phase2 = (phase + 0.4) % 1;
        const pulseR2 = 10 + phase2 * 20;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulseR2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239,68,68,${(1 - phase2) * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Inner filled dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      const solidColor = isCritical ? "#ef4444" : isWarning ? "#fbbf24" : "#22c55e";
      ctx.fillStyle = solidColor;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Alert title label
      ctx.fillStyle = isCritical ? "#fca5a5" : isWarning ? "#fde68a" : "#86efac";
      ctx.font = "bold 9px monospace";
      ctx.fillText(alert.title.slice(0, 16), pos.x + 10, pos.y + 4);
    });

    // Scan line sweep (tactical radar feel)
    const sweepAngle = ((t * 0.02) % 1) * Math.PI * 2;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.max(W, H);
    const sweepGrad = ctx.createConicalGradient
      ? null
      : null;
    void sweepGrad;
    // Manual sweep arc
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, sweepAngle - 0.4, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = "rgba(22,163,74,0.04)";
    ctx.fill();
    // Sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
    ctx.strokeStyle = "rgba(22,163,74,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Watermark label
    ctx.fillStyle = "rgba(22,163,74,0.12)";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "right";
    ctx.fillText("CANOPY SIGHT // TACTICAL GRID", W - 10, H - 10);
    ctx.textAlign = "left";
  }, [detections, zones, devices, alerts, pulseTime]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = height !== undefined ? height : container.clientHeight || resolvedHeight;
      draw();
    });
    observer.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = height !== undefined ? height : container.clientHeight || resolvedHeight;
    draw();

    return () => observer.disconnect();
  }, [draw, height, resolvedHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onAlertClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const W = canvas.width;
      const H = canvas.height;
      for (const alert of alerts) {
        const pos = hashToPos(alert.id, W, H, 50);
        const dist = Math.hypot(mx - pos.x, my - pos.y);
        if (dist < 20) {
          onAlertClick(alert.id);
          return;
        }
      }
    },
    [alerts, onAlertClick]
  );

  return (
    <div ref={containerRef} className="relative w-full" style={height !== undefined ? { height } : { height: "100%" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ display: "block", height: height !== undefined ? height : "100%" }}
        onClick={handleClick}
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-xs font-mono bg-black/60 rounded px-2 py-1.5 border border-green-900/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="text-green-300">Device Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
          <span className="text-gray-400">Device Offline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" />
          <span className="text-red-400">Critical Alert</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          <span className="text-amber-300">Warning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
          <span className="text-green-300">Detection</span>
        </div>
      </div>
    </div>
  );
}
