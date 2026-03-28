"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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

// Threat level from risk score
function threatLevel(risk: number): "low" | "medium" | "high" | "critical" {
  if (risk >= 80) return "critical";
  if (risk >= 60) return "high";
  if (risk >= 35) return "medium";
  return "low";
}

function threatColor(level: "low" | "medium" | "high" | "critical", alpha = 1): string {
  switch (level) {
    case "critical": return `rgba(239,68,68,${alpha})`;
    case "high": return `rgba(249,115,22,${alpha})`;
    case "medium": return `rgba(251,191,36,${alpha})`;
    case "low": return `rgba(34,197,94,${alpha})`;
  }
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

// Grid labels: columns A-J, rows 1-10
const GRID_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const GRID_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface TooltipInfo {
  x: number;
  y: number;
  type: string;
  confidence: number;
  riskScore: number;
  threat: string;
  time: string;
  id: string;
}

// Draw detection icon by type
function drawDetectionIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  size: number,
  color: string,
) {
  const t = type.toLowerCase();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  if (t.includes("person") || t.includes("human")) {
    // Stick figure
    const s = size;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.7, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.4);
    ctx.lineTo(x, y + s * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.1);
    ctx.lineTo(x + s * 0.4, y - s * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.lineTo(x - s * 0.3, y + s * 0.8);
    ctx.moveTo(x, y + s * 0.3);
    ctx.lineTo(x + s * 0.3, y + s * 0.8);
    ctx.stroke();
  } else if (t.includes("vehicle") || t.includes("car") || t.includes("truck")) {
    // Rectangle with wheels
    const w = size * 1.2;
    const h = size * 0.7;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4);
  } else if (t.includes("animal") || t.includes("wildlife")) {
    // Diamond
    const s = size * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
  } else if (t.includes("drone") || t.includes("uav")) {
    // X shape
    const s = size * 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.includes("weapon") || t.includes("gun") || t.includes("firearm")) {
    // Warning triangle
    const s = size;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y + s * 0.6);
    ctx.lineTo(x - s, y + s * 0.6);
    ctx.closePath();
    ctx.fill();
    // Exclamation
    ctx.fillStyle = "#0a0f1a";
    ctx.font = `bold ${Math.max(8, size)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("!", x, y + s * 0.3);
    ctx.textAlign = "left";
  } else {
    // Default: filled circle
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw zone fill patterns
function drawZonePattern(
  ctx: CanvasRenderingContext2D,
  zoneType: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const border = ZONE_BORDER[zoneType] ?? "rgba(100,100,200,0.3)";
  ctx.strokeStyle = border.replace(/[\d.]+\)$/, "0.15)");
  ctx.lineWidth = 1;

  if (zoneType === "exclusion") {
    // Diagonal lines
    const step = 10;
    for (let i = -Math.max(w, h); i < Math.max(w, h) * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }
  } else if (zoneType === "approach") {
    // Dot pattern
    const step = 12;
    for (let dx = step / 2; dx < w; dx += step) {
      for (let dy = step / 2; dy < h; dy += step) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

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
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [focusedDetection, setFocusedDetection] = useState<string | null>(null);
  // Track detection history for trails
  const detectionHistory = useRef<Map<string, Array<{ x: number; y: number; t: number }>>>(new Map());

  // Update detection history
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    if (W === 0 || H === 0) return;
    const now = Date.now();
    detections.forEach((d) => {
      const pos = hashToPos(d.id, W, H, 50);
      const history = detectionHistory.current.get(d.id) || [];
      // Add point if different from last
      const last = history[history.length - 1];
      if (!last || last.x !== pos.x || last.y !== pos.y) {
        history.push({ x: pos.x, y: pos.y, t: now });
        if (history.length > 8) history.shift();
      }
      detectionHistory.current.set(d.id, history);
    });
  }, [detections]);

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

    // --- Scanline effect ---
    const scanlineY = ((t * 1.5) % (H + 60)) - 30;
    for (let sy = 0; sy < H; sy += 3) {
      ctx.fillStyle = `rgba(22,163,74,${sy % 6 === 0 ? 0.015 : 0.005})`;
      ctx.fillRect(0, sy, W, 1);
    }
    // Moving scanline band
    const scanGrad = ctx.createLinearGradient(0, scanlineY - 30, 0, scanlineY + 30);
    scanGrad.addColorStop(0, "rgba(22,163,74,0)");
    scanGrad.addColorStop(0.5, "rgba(22,163,74,0.04)");
    scanGrad.addColorStop(1, "rgba(22,163,74,0)");
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanlineY - 30, W, 60);

    // --- Military grid with labels ---
    const gridMargin = 28;
    const gridW = W - gridMargin * 2;
    const gridH = H - gridMargin * 2;
    const colStep = gridW / GRID_COLS.length;
    const rowStep = gridH / GRID_ROWS.length;

    ctx.strokeStyle = "rgba(30,60,90,0.4)";
    ctx.lineWidth = 0.5;
    // Vertical lines
    for (let i = 0; i <= GRID_COLS.length; i++) {
      const x = gridMargin + i * colStep;
      ctx.beginPath();
      ctx.moveTo(x, gridMargin);
      ctx.lineTo(x, H - gridMargin);
      ctx.stroke();
    }
    // Horizontal lines
    for (let i = 0; i <= GRID_ROWS.length; i++) {
      const y = gridMargin + i * rowStep;
      ctx.beginPath();
      ctx.moveTo(gridMargin, y);
      ctx.lineTo(W - gridMargin, y);
      ctx.stroke();
    }
    // Column labels
    ctx.fillStyle = "rgba(22,163,74,0.35)";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < GRID_COLS.length; i++) {
      const x = gridMargin + i * colStep + colStep / 2;
      ctx.fillText(GRID_COLS[i], x, gridMargin - 8);
      ctx.fillText(GRID_COLS[i], x, H - gridMargin + 14);
    }
    // Row labels
    ctx.textAlign = "right";
    for (let i = 0; i < GRID_ROWS.length; i++) {
      const y = gridMargin + i * rowStep + rowStep / 2 + 3;
      ctx.fillText(GRID_ROWS[i], gridMargin - 6, y);
    }
    ctx.textAlign = "left";
    for (let i = 0; i < GRID_ROWS.length; i++) {
      const y = gridMargin + i * rowStep + rowStep / 2 + 3;
      ctx.fillText(GRID_ROWS[i], W - gridMargin + 6, y);
    }

    // Crosshairs at center
    ctx.strokeStyle = "rgba(22,163,74,0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, gridMargin);
    ctx.lineTo(W / 2, H - gridMargin);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gridMargin, H / 2);
    ctx.lineTo(W - gridMargin, H / 2);
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

    // --- Compass Rose (top-right corner) ---
    const compassX = W - 50;
    const compassY = 50;
    const compassR = 22;
    ctx.save();
    // Circle
    ctx.beginPath();
    ctx.arc(compassX, compassY, compassR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(22,163,74,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Compass lines
    ctx.strokeStyle = "rgba(22,163,74,0.25)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(compassX, compassY - compassR + 2);
    ctx.lineTo(compassX, compassY + compassR - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(compassX - compassR + 2, compassY);
    ctx.lineTo(compassX + compassR - 2, compassY);
    ctx.stroke();
    // N arrow (filled triangle)
    ctx.fillStyle = "rgba(239,68,68,0.8)";
    ctx.beginPath();
    ctx.moveTo(compassX, compassY - compassR + 3);
    ctx.lineTo(compassX - 4, compassY - 6);
    ctx.lineTo(compassX + 4, compassY - 6);
    ctx.closePath();
    ctx.fill();
    // S arrow
    ctx.fillStyle = "rgba(22,163,74,0.5)";
    ctx.beginPath();
    ctx.moveTo(compassX, compassY + compassR - 3);
    ctx.lineTo(compassX - 3, compassY + 6);
    ctx.lineTo(compassX + 3, compassY + 6);
    ctx.closePath();
    ctx.fill();
    // Labels
    ctx.fillStyle = "rgba(22,163,74,0.7)";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", compassX, compassY - compassR - 3);
    ctx.fillStyle = "rgba(22,163,74,0.4)";
    ctx.fillText("S", compassX, compassY + compassR + 10);
    ctx.fillText("W", compassX - compassR - 7, compassY + 3);
    ctx.fillText("E", compassX + compassR + 7, compassY + 3);
    ctx.textAlign = "left";
    ctx.restore();

    // --- Scale Bar (bottom-right) ---
    const scaleX = W - 140;
    const scaleY = H - 24;
    const scaleW = 100;
    ctx.strokeStyle = "rgba(22,163,74,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + scaleW, scaleY);
    ctx.stroke();
    // End ticks
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY - 4);
    ctx.lineTo(scaleX, scaleY + 4);
    ctx.moveTo(scaleX + scaleW, scaleY - 4);
    ctx.lineTo(scaleX + scaleW, scaleY + 4);
    ctx.moveTo(scaleX + scaleW / 2, scaleY - 2);
    ctx.lineTo(scaleX + scaleW / 2, scaleY + 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(22,163,74,0.45)";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("500m", scaleX + scaleW / 2, scaleY - 6);
    ctx.fillText("0", scaleX, scaleY + 12);
    ctx.fillText("1km", scaleX + scaleW, scaleY + 12);
    ctx.textAlign = "left";

    // --- Zones as polygon overlays with patterns ---
    zones.forEach((zone) => {
      const hasActiveAlert = alerts.some(
        (a) => a.siteId === zone.id || a.deviceId === zone.id
      );
      const pts = Array.isArray(zone.points)
        ? (zone.points as Array<{ x: number; y: number }>)
        : [];
      if (pts.length < 3) {
        const pos = hashToPos(zone.id, W, H, 60);
        const zW = 80 + (zone.id.charCodeAt(0) % 60);
        const zH = 50 + (zone.id.charCodeAt(1) % 40);
        const fill = ZONE_COLORS[zone.type] ?? "rgba(100,100,200,0.15)";
        const border = ZONE_BORDER[zone.type] ?? "rgba(100,100,200,0.6)";

        // Active zone highlight
        const activeFill = hasActiveAlert
          ? fill.replace(/[\d.]+\)$/, "0.35)")
          : fill;

        ctx.fillStyle = activeFill;
        ctx.strokeStyle = border;
        ctx.lineWidth = hasActiveAlert ? 2.5 : 1.5;
        ctx.setLineDash([4, 4]);
        ctx.fillRect(pos.x - zW / 2, pos.y - zH / 2, zW, zH);
        ctx.strokeRect(pos.x - zW / 2, pos.y - zH / 2, zW, zH);
        ctx.setLineDash([]);

        // Pattern overlay
        drawZonePattern(ctx, zone.type, pos.x - zW / 2, pos.y - zH / 2, zW, zH);

        // Centered label
        ctx.fillStyle = border;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(zone.name.slice(0, 14), pos.x, pos.y);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Active glow pulse
        if (hasActiveAlert) {
          const glowAlpha = 0.15 + Math.sin(t * 0.1) * 0.1;
          ctx.strokeStyle = border.replace(/[\d.]+\)$/, `${glowAlpha})`);
          ctx.lineWidth = 4;
          ctx.strokeRect(pos.x - zW / 2 - 3, pos.y - zH / 2 - 3, zW + 6, zH + 6);
        }
        return;
      }
      // Draw actual polygon
      const fill = ZONE_COLORS[zone.type] ?? "rgba(100,100,200,0.15)";
      const border = ZONE_BORDER[zone.type] ?? "rgba(100,100,200,0.6)";
      const activeFill = hasActiveAlert ? fill.replace(/[\d.]+\)$/, "0.35)") : fill;

      ctx.fillStyle = activeFill;
      ctx.strokeStyle = border;
      ctx.lineWidth = hasActiveAlert ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * W, pts[0].y * H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Label centered in zone
      const cx2 = pts.reduce((a, p) => a + p.x * W, 0) / pts.length;
      const cy2 = pts.reduce((a, p) => a + p.y * H, 0) / pts.length;
      ctx.fillStyle = border;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(zone.name.slice(0, 14), cx2, cy2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });

    // --- Detection trails ---
    detectionHistory.current.forEach((history, _id) => {
      if (history.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(history[0].x, history[0].y);
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(history[i].x, history[i].y);
      }
      ctx.strokeStyle = "rgba(22,163,74,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Dots along trail
      history.forEach((pt, i) => {
        if (i === history.length - 1) return;
        const alpha = 0.1 + (i / history.length) * 0.2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22,163,74,${alpha})`;
        ctx.fill();
      });
    });

    // --- Detections with type-specific icons ---
    const now = Date.now();
    detections.slice(0, 30).forEach((d) => {
      const pos = hashToPos(d.id, W, H, 50);
      const ts = d.timestamp ? new Date(d.timestamp).getTime() : now;
      const age = (now - ts) / (30 * 60 * 1000);
      const alpha = Math.max(0, 1 - age);
      const risk = typeof d.riskScore === "number" ? d.riskScore : 50;
      const conf = typeof d.confidence === "number" ? d.confidence : 0.5;
      const level = threatLevel(risk);
      const color = threatColor(level, alpha * 0.85);

      // Size proportional to confidence (min 5, max 12)
      const blipSize = 5 + conf * 7;

      // Focused detection zoom effect
      const isFocused = focusedDetection === d.id;
      const scale = isFocused ? 1.8 : 1;
      const drawSize = blipSize * scale;

      // Glow for high/critical threats
      if (level === "critical" || level === "high") {
        const glowR = drawSize + 6 + Math.sin(t * 0.15) * 3;
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
        grad.addColorStop(0, threatColor(level, alpha * 0.3));
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw icon
      drawDetectionIcon(ctx, pos.x, pos.y, d.type, drawSize, color);

      // Ripple
      const rippleR = drawSize + ((t * 0.05 + pos.x * 0.01) % 1) * 14;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = threatColor(level, alpha * 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Critical pulsing double ripple
      if (level === "critical") {
        const rippleR2 = drawSize + ((t * 0.05 + pos.x * 0.01 + 0.5) % 1) * 18;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rippleR2, 0, Math.PI * 2);
        ctx.strokeStyle = threatColor(level, alpha * 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = `rgba(200,220,255,${alpha * 0.8})`;
      ctx.font = "9px monospace";
      ctx.fillText(d.type.slice(0, 10), pos.x + drawSize + 4, pos.y + 4);

      // Focus ring
      if (isFocused) {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, drawSize + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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

      // Camera icon -- square with notch
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

      const alertColor = isCritical
        ? `rgba(239,68,68,${pulseAlpha * 0.9})`
        : isWarning
          ? `rgba(251,191,36,${pulseAlpha * 0.9})`
          : `rgba(34,197,94,${pulseAlpha * 0.9})`;

      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = alertColor;
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

      // Alert severity icon
      if (isCritical) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", pos.x, pos.y + 3);
        ctx.textAlign = "left";
      }

      // Alert title label
      ctx.fillStyle = isCritical ? "#fca5a5" : isWarning ? "#fde68a" : "#86efac";
      ctx.font = "bold 9px monospace";
      ctx.fillText(alert.title.slice(0, 16), pos.x + 10, pos.y + 4);
    });

    // --- Radar Sweep ---
    const sweepAngle = ((t * 0.02) % 1) * Math.PI * 2;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.max(W, H);

    // Sweep trail (fading arc behind the sweep line)
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const angle = sweepAngle - (i / 20) * 0.5;
      const lineAlpha = 0.06 * (1 - i / 20);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = `rgba(22,163,74,${lineAlpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Main sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
    ctx.strokeStyle = "rgba(22,163,74,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Sweep arc fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, sweepAngle - 0.5, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = "rgba(22,163,74,0.03)";
    ctx.fill();
    ctx.restore();

    // Center radar dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(22,163,74,0.3)";
    ctx.fill();

    // --- Watermark label ---
    ctx.fillStyle = "rgba(22,163,74,0.12)";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "right";
    ctx.fillText("CANOPY SIGHT // TACTICAL GRID", W - 10, H - 10);
    ctx.textAlign = "left";

    // --- Status bar top-left ---
    ctx.fillStyle = "rgba(22,163,74,0.25)";
    ctx.font = "9px monospace";
    const statusText = `TGT:${detections.length}  DEV:${devices.length}  ALT:${alerts.length}  ZN:${zones.length}`;
    ctx.fillText(statusText, 8, 14);

    // Timestamp
    const timeStr = new Date().toISOString().slice(11, 19) + "Z";
    ctx.fillStyle = "rgba(22,163,74,0.2)";
    ctx.fillText(timeStr, 8, H - 10);
  }, [detections, zones, devices, alerts, pulseTime, focusedDetection]);

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
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const W = canvas.width;
      const H = canvas.height;

      // Check detections for click-to-focus
      for (const d of detections.slice(0, 30)) {
        const pos = hashToPos(d.id, W, H, 50);
        const dist = Math.hypot(mx - pos.x, my - pos.y);
        if (dist < 20) {
          setFocusedDetection((prev) => (prev === d.id ? null : d.id));
          return;
        }
      }

      // Check alerts
      if (onAlertClick) {
        for (const alert of alerts) {
          const pos = hashToPos(alert.id, W, H, 50);
          const dist = Math.hypot(mx - pos.x, my - pos.y);
          if (dist < 20) {
            onAlertClick(alert.id);
            return;
          }
        }
      }

      // Click on empty space clears focus
      setFocusedDetection(null);
    },
    [detections, alerts, onAlertClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const W = canvas.width;
      const H = canvas.height;

      for (const d of detections.slice(0, 30)) {
        const pos = hashToPos(d.id, W, H, 50);
        const dist = Math.hypot(mx - pos.x, my - pos.y);
        if (dist < 18) {
          const risk = typeof d.riskScore === "number" ? d.riskScore : 50;
          const conf = typeof d.confidence === "number" ? d.confidence : 0.5;
          const ts = d.timestamp ? new Date(d.timestamp) : new Date();
          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            type: d.type,
            confidence: Math.round(conf * 100),
            riskScore: risk,
            threat: threatLevel(risk),
            time: ts.toLocaleTimeString(),
            id: d.id.slice(0, 8),
          });
          return;
        }
      }
      setTooltip(null);
    },
    [detections]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full" style={height !== undefined ? { height } : { height: "100%" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ display: "block", height: height !== undefined ? height : "100%" }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Hover Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-black/85 border border-green-800/60 rounded px-2.5 py-2 text-xs font-mono shadow-lg"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 300) - 180),
            top: tooltip.y - 10,
          }}
        >
          <div className="text-green-300 font-bold mb-1">{tooltip.type.toUpperCase()}</div>
          <div className="text-gray-300">
            <span className="text-gray-500">ID:</span> {tooltip.id}
          </div>
          <div className="text-gray-300">
            <span className="text-gray-500">Confidence:</span> {tooltip.confidence}%
          </div>
          <div className={
            tooltip.threat === "critical" ? "text-red-400" :
            tooltip.threat === "high" ? "text-orange-400" :
            tooltip.threat === "medium" ? "text-amber-300" :
            "text-green-400"
          }>
            <span className="text-gray-500">Risk:</span> {tooltip.riskScore} ({tooltip.threat})
          </div>
          <div className="text-gray-400">
            <span className="text-gray-500">Time:</span> {tooltip.time}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-xs font-mono bg-black/70 rounded px-2.5 py-2 border border-green-900/50 backdrop-blur-sm">
        <div className="text-green-500/70 font-bold text-[10px] mb-0.5 tracking-wider">LEGEND</div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="text-green-300">Low Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          <span className="text-amber-300">Medium Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          <span className="text-orange-300">High Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" />
          <span className="text-red-400">Critical</span>
        </div>
        <div className="border-t border-green-900/40 my-0.5" />
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-green-400">
            <circle cx="5" cy="2.5" r="1.5" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
            <line x1="5" y1="4" x2="5" y2="7" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span className="text-gray-400">Person</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-green-400">
            <rect x="1" y="2.5" width="8" height="5" fill="currentColor" rx="1" />
          </svg>
          <span className="text-gray-400">Vehicle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-green-400">
            <polygon points="5,1 9,5 5,9 1,5" fill="currentColor" />
          </svg>
          <span className="text-gray-400">Animal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-green-400">
            <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" />
            <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-gray-400">Drone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-red-400">
            <polygon points="5,1 9,9 1,9" fill="currentColor" />
          </svg>
          <span className="text-gray-400">Weapon</span>
        </div>
        <div className="border-t border-green-900/40 my-0.5" />
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="text-green-300">Device Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
          <span className="text-gray-400">Device Offline</span>
        </div>
      </div>
    </div>
  );
}
