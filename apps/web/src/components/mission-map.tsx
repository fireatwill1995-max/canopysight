"use client";

import { useState } from "react";

interface LatLng {
  lat: number;
  lng: number;
}

interface DroneMarker {
  id: string;
  position: LatLng;
  label: string;
  heading?: number;
}

interface DetectionMarker {
  id: string;
  position: LatLng;
  label: string;
  confidence: number;
}

interface ZoneBoundary {
  id: string;
  name: string;
  points: LatLng[];
  color?: string;
}

interface MissionMapProps {
  flightPath?: LatLng[];
  drones?: DroneMarker[];
  detections?: DetectionMarker[];
  zones?: ZoneBoundary[];
  center?: LatLng;
  className?: string;
}

type LayerKey = "satellite" | "terrain" | "zones" | "detections" | "flightPath";

export function MissionMap({
  flightPath = [],
  drones = [],
  detections = [],
  zones = [],
  center = { lat: 37.7749, lng: -122.4194 },
  className = "",
}: MissionMapProps) {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    satellite: true,
    terrain: false,
    zones: true,
    detections: true,
    flightPath: true,
  });

  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Map scale factor for rendering coordinates within the CSS map
  const mapBounds = computeBounds(flightPath, drones, detections, zones, center);

  const toPixel = (pos: LatLng, w: number, h: number) => {
    const x = ((pos.lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng || 1)) * w;
    const y = ((mapBounds.maxLat - pos.lat) / (mapBounds.maxLat - mapBounds.minLat || 1)) * h;
    return {
      x: Math.max(8, Math.min(w - 8, x)),
      y: Math.max(8, Math.min(h - 8, y)),
    };
  };

  const mapW = 600;
  const mapH = 400;

  return (
    <div className={`rounded-xl border border-border overflow-hidden bg-card ${className}`}>
      {/* Map viewport */}
      <div
        className="relative w-full bg-slate-800"
        style={{ aspectRatio: `${mapW}/${mapH}` }}
      >
        {/* Grid background */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Coordinates label */}
        <div className="absolute top-2 left-2 text-[10px] text-white/50 font-mono z-10">
          {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </div>

        {/* Zone boundaries */}
        {layers.zones &&
          zones.map((zone) => {
            const pts = zone.points.map((p) => toPixel(p, mapW, mapH));
            const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
            return (
              <svg
                key={zone.id}
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${mapW} ${mapH}`}
                preserveAspectRatio="none"
              >
                <path
                  d={pathD}
                  fill={`${zone.color || "#6366f1"}20`}
                  stroke={zone.color || "#6366f1"}
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />
                <text x={pts[0]?.x ?? 0} y={(pts[0]?.y ?? 0) - 6} fill={zone.color || "#6366f1"} fontSize="11" fontWeight="600">
                  {zone.name}
                </text>
              </svg>
            );
          })}

        {/* Flight path */}
        {layers.flightPath && flightPath.length > 1 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${mapW} ${mapH}`}
            preserveAspectRatio="none"
          >
            <polyline
              points={flightPath.map((p) => { const px = toPixel(p, mapW, mapH); return `${px.x},${px.y}`; }).join(" ")}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Start marker */}
            {(() => { const s = toPixel(flightPath[0], mapW, mapH); return <circle cx={s.x} cy={s.y} r="5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />; })()}
            {/* End marker */}
            {(() => { const e = toPixel(flightPath[flightPath.length - 1], mapW, mapH); return <circle cx={e.x} cy={e.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />; })()}
          </svg>
        )}

        {/* Detection markers */}
        {layers.detections &&
          detections.map((det) => {
            const px = toPixel(det.position, mapW, mapH);
            return (
              <div
                key={det.id}
                className="absolute w-3 h-3 bg-yellow-400 rounded-full border border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ left: `${(px.x / mapW) * 100}%`, top: `${(px.y / mapH) * 100}%` }}
                title={`${det.label} (${(det.confidence * 100).toFixed(0)}%)`}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                  {det.label} - {(det.confidence * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}

        {/* Drone markers */}
        {drones.map((drone) => {
          const px = toPixel(drone.position, mapW, mapH);
          return (
            <div
              key={drone.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: `${(px.x / mapW) * 100}%`, top: `${(px.y / mapH) * 100}%` }}
            >
              <div className="relative">
                <div
                  className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ transform: drone.heading ? `rotate(${drone.heading}deg)` : undefined }}
                >
                  ▲
                </div>
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[10px] text-white bg-black/60 px-1 rounded whitespace-nowrap">
                  {drone.label}
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {flightPath.length === 0 && drones.length === 0 && detections.length === 0 && zones.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">🗺️</div>
              <p className="text-sm text-white/60">No mission data to display</p>
            </div>
          </div>
        )}
      </div>

      {/* Layer controls */}
      <div className="flex flex-wrap gap-2 p-3 border-t border-border bg-card">
        {(Object.keys(layers) as LayerKey[]).map((key) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors capitalize ${
              layers[key]
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {layers[key] ? "●" : "○"} {key.replace(/([A-Z])/g, " $1").trim()}
          </button>
        ))}
      </div>
    </div>
  );
}

function computeBounds(
  flightPath: LatLng[],
  drones: DroneMarker[],
  detections: DetectionMarker[],
  zones: ZoneBoundary[],
  center: LatLng
) {
  const allPoints: LatLng[] = [
    center,
    ...flightPath,
    ...drones.map((d) => d.position),
    ...detections.map((d) => d.position),
    ...zones.flatMap((z) => z.points),
  ];

  if (allPoints.length <= 1) {
    return {
      minLat: center.lat - 0.01,
      maxLat: center.lat + 0.01,
      minLng: center.lng - 0.01,
      maxLng: center.lng + 0.01,
    };
  }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of allPoints) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  // Add padding
  const latPad = (maxLat - minLat) * 0.15 || 0.005;
  const lngPad = (maxLng - minLng) * 0.15 || 0.005;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}
