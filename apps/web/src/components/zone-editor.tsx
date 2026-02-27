"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { getYoutubeVideoId, DEMO_VIDEO_YOUTUBE_ID, DEMO_VIDEO_LOCAL_PATH } from "@/lib/simulation";

interface Point {
  x: number;
  y: number;
}

interface ZoneEditorProps {
  imageUrl?: string;
  /** When set, show this stream (main camera) fully zoomed out so user draws zones on the live view. */
  streamUrl?: string;
  /** When true, use demo feed if no stream (e.g. YouTube demo). */
  simulationMode?: boolean;
  /** Reference resolution for zone points (default 1920x1080 to match Live feed). */
  refWidth?: number;
  refHeight?: number;
  existingZones?: Array<{
    id: string;
    name: string;
    points: Point[];
    type: string;
  }>;
  onSave: (zone: { name: string; points: Point[]; type: string }) => void;
}

const ZONE_REF_WIDTH = 1920;
const ZONE_REF_HEIGHT = 1080;

export function ZoneEditor({
  imageUrl,
  streamUrl,
  simulationMode = false,
  refWidth = ZONE_REF_WIDTH,
  refHeight = ZONE_REF_HEIGHT,
  existingZones = [],
  onSave,
}: ZoneEditorProps) {
  const { addToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState<"crossing" | "approach" | "exclusion" | "custom">("exclusion");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const youtubeId = streamUrl ? getYoutubeVideoId(streamUrl) : null;
  const useYoutube = !!youtubeId || (simulationMode && !!DEMO_VIDEO_YOUTUBE_ID);
  const embedId = youtubeId || DEMO_VIDEO_YOUTUBE_ID || undefined;
  const effectiveStreamUrl =
    streamUrl && !youtubeId
      ? streamUrl
      : simulationMode && !useYoutube
        ? DEMO_VIDEO_LOCAL_PATH
        : undefined;

  const REF_WIDTH = 800;
  const REF_HEIGHT = 450;

  const hasStream = (useYoutube && !!embedId) || !!effectiveStreamUrl;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.offsetWidth || REF_WIDTH;
    const h = canvas.offsetHeight || REF_HEIGHT;
    canvas.width = w;
    canvas.height = h;

    drawZones(ctx, w, h);

    if (points.length > 0) {
      const pts = points.map((p) => ({ x: (p.x / refWidth) * w, y: (p.y / refHeight) * h }));
      drawPolygon(ctx, pts, "#3b82f6", false);
    }
  }, [points, existingZones, imageUrl, refWidth, refHeight, containerSize]);

  // When showing stream, redraw when container resizes (e.g. tab switch) so overlay stays aligned
  useEffect(() => {
    if (!hasStream || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [hasStream]);

  const drawZones = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    const scaleRefToCanvas = (p: Point) => ({ x: (p.x / refWidth) * width, y: (p.y / refHeight) * height });

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        existingZones.forEach((zone) => {
          const color = getZoneColor(zone.type);
          const scaled = zone.points.map(scaleRefToCanvas);
          drawPolygon(ctx, scaled, color, true, zone.name);
        });
        if (points.length > 0) {
          const pts = points.map(scaleRefToCanvas);
          drawPolygon(ctx, pts, "#3b82f6", false);
        }
      };
      img.src = imageUrl;
    } else if (hasStream) {
      // Stream showing: draw only zones (transparent overlay); points in ref space
      existingZones.forEach((zone) => {
        const color = getZoneColor(zone.type);
        const scaled = zone.points.map(scaleRefToCanvas);
        drawPolygon(ctx, scaled, color, true, zone.name);
      });
    } else {
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(4, 4, width - 8, height - 8);
      ctx.setLineDash([]);
      ctx.fillStyle = "#6b7280";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Reference area — click to add zone points (min 3)", width / 2, height / 2 - 12);
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText("Select a camera above or add a device with a stream URL", width / 2, height / 2 + 14);
      existingZones.forEach((zone) => {
        const color = getZoneColor(zone.type);
        const scaled = zone.points.map(scaleRefToCanvas);
        drawPolygon(ctx, scaled, color, true, zone.name);
      });
    }
  };

  const drawPolygon = (
    ctx: CanvasRenderingContext2D,
    pts: Point[],
    color: string,
    filled: boolean,
    label?: string
  ) => {
    if (pts.length < 2) return;

    ctx.strokeStyle = color;
    ctx.fillStyle = filled ? `${color}40` : "transparent";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (filled) {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();

    // Draw points
    pts.forEach((point, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw point number
      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), point.x, point.y);
    });

    // Draw label
    if (label && filled && pts.length > 0) {
      const center = getPolygonCenter(pts);
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(label, center.x, center.y);
    }
  };

  const getPolygonCenter = (pts: Point[]): Point => {
    const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  };

  const getZoneColor = (type: string): string => {
    switch (type) {
      case "exclusion":
        return "#ef4444"; // red
      case "approach":
        return "#f59e0b"; // orange
      case "crossing":
        return "#3b82f6"; // blue
      default:
        return "#8b5cf6"; // purple
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Store points in ref space (1920x1080) so zones match Live feed
    const refX = (x / rect.width) * refWidth;
    const refY = (y / rect.height) * refHeight;

    setPoints([...points, { x: refX, y: refY }]);
    setIsDrawing(true);
  };

  const handleClear = () => {
    setPoints([]);
    setIsDrawing(false);
  };

  const handleSave = () => {
    if (points.length < 3) {
      addToast({ type: "error", title: "Invalid zone", description: "Zone must have at least 3 points." });
      return;
    }
    if (!zoneName.trim()) {
      addToast({ type: "error", title: "Missing name", description: "Please enter a zone name." });
      return;
    }

    onSave({
      name: zoneName,
      points,
      type: zoneType,
    });

    // Reset
    setPoints([]);
    setZoneName("");
    setIsDrawing(false);
  };

  // Load video when showing stream (non-YouTube)
  useEffect(() => {
    if (!effectiveStreamUrl || useYoutube) return;
    const video = videoRef.current;
    if (!video) return;
    video.src = effectiveStreamUrl;
    return () => {
      video.src = "";
    };
  }, [effectiveStreamUrl, useYoutube]);

  return (
    <div className="space-y-4">
      {/* Fully zoomed out: 16/9 container, stream fills it (object-fit contain), overlay canvas on top */}
      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-black min-h-[384px] w-full"
        style={{ aspectRatio: "16/9", maxHeight: "70vh" }}
      >
        {hasStream ? (
          <>
            {useYoutube && embedId ? (
              <iframe
                title="Zone reference stream"
                src={`https://www.youtube.com/embed/${embedId}?autoplay=1&mute=1&loop=1&playlist=${embedId}&controls=1&rel=0`}
                className="absolute inset-0 w-full h-full object-contain"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                loop
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              style={{ pointerEvents: "auto" }}
              aria-hidden
            />
          </>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-96 min-h-[384px] cursor-crosshair bg-gray-100 dark:bg-gray-800 block"
            style={{ minHeight: "384px" }}
          />
        )}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Zone name"
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
        />
        <select
          value={zoneType}
          onChange={(e) => setZoneType(e.target.value as "crossing" | "approach" | "exclusion" | "custom")}
          className="px-3 py-2 border rounded"
        >
          <option value="exclusion">Exclusion Zone</option>
          <option value="approach">Approach Zone</option>
          <option value="crossing">Crossing Zone</option>
          <option value="custom">Custom Zone</option>
        </select>
        <Button onClick={handleClear} variant="outline" disabled={points.length === 0}>
          Clear
        </Button>
        <Button onClick={handleSave} disabled={points.length < 3 || !zoneName.trim()}>
          Save Zone
        </Button>
      </div>

      <div className="text-sm text-gray-600">
        <p>Click on the canvas to add points. Minimum 3 points required.</p>
        <p>Points added: {points.length}</p>
      </div>
    </div>
  );
}
