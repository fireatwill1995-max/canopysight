"use client";

import { useEffect, useRef } from "react";

export interface ThreatScoreGaugeProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  trend?: "rising" | "falling" | "stable";
}

function getThreatLabel(score: number): string {
  if (score <= 30) return "Low";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "High";
  return "Critical";
}

function getThreatColor(score: number): { stroke: string; fill: string; text: string; bg: string } {
  if (score <= 30)
    return { stroke: "#10b981", fill: "#10b981", text: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (score <= 60)
    return { stroke: "#f59e0b", fill: "#f59e0b", text: "text-amber-500", bg: "bg-amber-500/10" };
  if (score <= 80)
    return { stroke: "#f97316", fill: "#f97316", text: "text-orange-500", bg: "bg-orange-500/10" };
  return { stroke: "#ef4444", fill: "#ef4444", text: "text-red-500", bg: "bg-red-500/10" };
}

const SIZES = {
  sm: { svg: 100, strokeW: 8, fontSize: 20, subFontSize: 9, r: 36 },
  md: { svg: 160, strokeW: 12, fontSize: 32, subFontSize: 11, r: 58 },
  lg: { svg: 220, strokeW: 16, fontSize: 48, subFontSize: 13, r: 82 },
};

export function ThreatScoreGauge({
  score,
  size = "md",
  showLabel = true,
  trend,
}: ThreatScoreGaugeProps) {
  const normalised = Math.max(0, Math.min(100, score));
  const color = getThreatColor(normalised);
  const dims = SIZES[size];

  const cx = dims.svg / 2;
  const cy = dims.svg / 2;
  const r = dims.r;

  // Half-circle gauge: arc from 180° → 0° (left to right along bottom)
  const circumference = Math.PI * r; // half-circle arc length
  const dash = (normalised / 100) * circumference;
  const gap = circumference - dash;

  // Arc path: start at left (180°), sweep clockwise to right (0°)
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Needle tip
  const needleAngle = Math.PI - (normalised / 100) * Math.PI; // 180° to 0°
  const needleLength = r - dims.strokeW / 2 - 4;
  const nx = cx + needleLength * Math.cos(needleAngle);
  const ny = cy - needleLength * Math.sin(needleAngle); // SVG y-axis inverted

  const trendIcon =
    trend === "rising" ? "↑" : trend === "falling" ? "↓" : trend === "stable" ? "→" : null;
  const trendColor =
    trend === "rising"
      ? "text-red-500"
      : trend === "falling"
      ? "text-emerald-500"
      : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        width={dims.svg}
        height={dims.svg / 2 + dims.strokeW + 12}
        className="overflow-visible"
        aria-label={`Threat score: ${normalised} out of 100 — ${getThreatLabel(normalised)}`}
        role="img"
      >
        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={dims.strokeW}
          className="text-border"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={color.stroke}
          strokeWidth={dims.strokeW}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap + 1}`}
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={color.stroke}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ transition: "x2 0.6s cubic-bezier(0.4,0,0.2,1), y2 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <circle cx={cx} cy={cy} r={dims.strokeW / 2 - 1} fill={color.fill} />

        {/* Score number */}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fontSize={dims.fontSize}
          fontWeight="700"
          fill={color.fill}
          style={{ transition: "fill 0.4s" }}
        >
          {Math.round(normalised)}
        </text>
        {/* "/ 100" sub-label */}
        <text
          x={cx}
          y={cy + dims.fontSize - 4}
          textAnchor="middle"
          fontSize={dims.subFontSize}
          fill="currentColor"
          className="text-muted-foreground"
          opacity={0.7}
        >
          / 100
        </text>

        {/* Range labels */}
        <text x={cx - r - 2} y={cy + 14} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5} className="text-muted-foreground">0</text>
        <text x={cx + r + 2} y={cy + 14} textAnchor="start" fontSize={9} fill="currentColor" opacity={0.5} className="text-muted-foreground">100</text>
      </svg>

      {showLabel && (
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`text-sm font-semibold ${color.text}`}
            style={{ transition: "color 0.4s" }}
          >
            {getThreatLabel(normalised)}
          </span>
          {trendIcon && (
            <span className={`text-sm font-bold ${trendColor}`}>{trendIcon}</span>
          )}
        </div>
      )}
    </div>
  );
}
