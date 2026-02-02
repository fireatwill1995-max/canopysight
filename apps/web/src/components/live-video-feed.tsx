"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import {
  DEMO_VIDEO_YOUTUBE_ID,
  DEMO_VIDEO_LOCAL_PATH,
  DEMO_VIDEO_FALLBACK_URL,
  getYoutubeVideoId,
} from "@/lib/simulation";

/** Build a user-friendly error message for stream load failures */
function streamErrorMessage(
  url: string | undefined,
  mediaError?: MediaError | null
): string {
  const base = "Failed to load stream from the URL provided.";
  if (!url) return base;
  const shortUrl = url.length > 60 ? url.slice(0, 57) + "…" : url;
  const code =
    mediaError?.code === 1
      ? " (format/URL not supported)"
      : mediaError?.code === 2
        ? " (network error)"
        : mediaError?.code === 3
          ? " (decode error)"
          : mediaError?.code === 4
            ? " (source not supported)"
            : "";
  return `${base} ${shortUrl}${code}. Check CORS and that the URL is a direct video or HLS (.m3u8) link.`;
}

/** A detected potential hazard to circle on the live feed (from detection events or simulation). */
export interface HazardOverlay {
  id: string;
  type: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence?: number;
  riskScore?: number;
}

interface LiveVideoFeedProps {
  deviceId: string;
  siteId: string;
  streamUrl?: string;
  /** When true, show mock camera feed (train station style) for demos when no real stream. */
  simulationMode?: boolean;
  showZones?: boolean;
  zones?: Array<{
    id: string;
    name: string;
    points: Array<{ x: number; y: number }>;
    type: string;
  }>;
  /** Detected hazards to circle on the feed (boundingBox in hazardRefWidth x hazardRefHeight space). */
  hazards?: HazardOverlay[];
  /** Reference resolution for hazard boundingBox coordinates (default 1920x1080). */
  hazardRefWidth?: number;
  hazardRefHeight?: number;
}

export function LiveVideoFeed({
  deviceId,
  siteId,
  streamUrl,
  simulationMode = false,
  showZones = true,
  zones = [],
  hazards = [],
  hazardRefWidth = 1920,
  hazardRefHeight = 1080,
}: LiveVideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triedFallbackRef = useRef(false);

  // Device streamUrl can be a YouTube URL; simulation can also use demo YouTube
  const youtubeIdFromUrl = streamUrl ? getYoutubeVideoId(streamUrl) : null;
  const useYoutube =
    !!youtubeIdFromUrl || (simulationMode && !!DEMO_VIDEO_YOUTUBE_ID);
  const embedVideoId = youtubeIdFromUrl || DEMO_VIDEO_YOUTUBE_ID || undefined;
  const effectiveStreamUrl =
    streamUrl && !youtubeIdFromUrl
      ? streamUrl
      : simulationMode && !useYoutube
        ? DEMO_VIDEO_LOCAL_PATH
        : undefined;

  useEffect(() => {
    if (useYoutube) return;
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    triedFallbackRef.current = false;
    let hlsInstance: import("hls.js").default | null = null;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVideoError = () => {
      if (simulationMode && !triedFallbackRef.current) {
        triedFallbackRef.current = true;
        video.src = DEMO_VIDEO_FALLBACK_URL;
        setError(null);
      } else {
        setError(
          streamErrorMessage(
            effectiveStreamUrl ?? undefined,
            video.error ?? undefined
          )
        );
      }
    };

    if (effectiveStreamUrl) {
      const isHls = effectiveStreamUrl.endsWith(".m3u8");

      if (isHls) {
        // HLS: use hls.js in Chrome/Firefox; native in Safari
        const loadHls = async () => {
          try {
            const Hls = (await import("hls.js")).default;
            if (Hls.isSupported()) {
              hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
              });
              hlsInstance.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                  setError(
                    `Failed to load HLS stream from the URL provided. ${(effectiveStreamUrl?.length ?? 0) > 60 ? effectiveStreamUrl?.slice(0, 57) + "…" : effectiveStreamUrl ?? ""} Check that the URL is a valid .m3u8 and CORS allows this origin.`
                  );
                }
              });
              hlsInstance.loadSource(effectiveStreamUrl);
              hlsInstance.attachMedia(video);
              video.src = "";
            } else if (
              video.canPlayType("application/vnd.apple.mpegurl") !== ""
            ) {
              // Safari native HLS
              video.src = effectiveStreamUrl;
            } else {
              setError(
                "HLS (.m3u8) stream not supported in this browser. Try Chrome or Firefox with a recent version."
              );
            }
          } catch (e) {
            setError(
              streamErrorMessage(effectiveStreamUrl, null) +
                " HLS failed to load."
            );
          }
        };
        loadHls();
      } else {
        video.src = effectiveStreamUrl;
      }
    } else {
      setError("No video stream available");
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onVideoError);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onVideoError);
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      video.src = "";
    };
  }, [effectiveStreamUrl, simulationMode, useYoutube]);

  // Draw hazard circle color by risk/type
  const getHazardColor = (h: HazardOverlay): string => {
    const risk = h.riskScore ?? (h.confidence ? h.confidence * 50 : 30);
    if (risk >= 40) return "rgba(239, 68, 68, 0.9)"; // red – high risk
    if (risk >= 25) return "rgba(245, 158, 11, 0.9)"; // orange – medium
    return "rgba(234, 179, 8, 0.85)"; // yellow – potential hazard
  };

  /** Helper: draw rounded rect (use native roundRect if available). */
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === "function") {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  };

  /** Draw a simple icon for the hazard type (person, vehicle, or alert) above center. */
  const drawHazardIcon = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    type: string,
    iconSize: number,
    color: string
  ) => {
    const top = cy - iconSize * 1.4;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    const t = type.toLowerCase();
    if (t === "person") {
      // Head (circle) + body (rounded rect)
      ctx.beginPath();
      ctx.arc(cx, top + iconSize * 0.35, iconSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, cx - (iconSize * 0.5) / 2, top + iconSize * 0.5, iconSize * 0.5, iconSize * 0.65, 2);
      ctx.fill();
      ctx.stroke();
    } else if (t === "vehicle" || t === "car") {
      // Car body (wide rounded rect) + cabin
      const w = iconSize * 1.1;
      const h = iconSize * 0.5;
      roundRect(ctx, cx - w / 2, top + iconSize * 0.2, w, h, 3);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, cx - w * 0.25, top + iconSize * 0.05, w * 0.5, h * 0.6, 2);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fill();
      ctx.stroke();
    } else {
      // Generic alert: triangle with exclamation
      const r = iconSize * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + r, top + r * 1.6);
      ctx.lineTo(cx - r, top + r * 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = `bold ${Math.max(8, iconSize * 0.5)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", cx, top + r * 0.9);
    }
    ctx.textBaseline = "alphabetic";
  };

  const drawHazardCircles = (
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    refW: number,
    refH: number
  ) => {
    if (hazards.length === 0) return;
    const scaleX = canvasW / refW;
    const scaleY = canvasH / refH;
    hazards.forEach((h) => {
      const b = h.boundingBox;
      const cx = (b.x + b.width / 2) * scaleX;
      const cy = (b.y + b.height / 2) * scaleY;
      const radius = Math.max(b.width * scaleX, b.height * scaleY) / 2 + 8;
      const color = getHazardColor(h);
      const iconSize = Math.min(24, radius * 0.8);

      // 1. Spotlight: radial gradient to "light up" the area of interest
      const glowRadius = radius * 2.2;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      gradient.addColorStop(0, "rgba(255, 230, 180, 0.4)");
      gradient.addColorStop(0.4, "rgba(255, 200, 120, 0.15)");
      gradient.addColorStop(1, "rgba(255, 180, 80, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Circle around the hazard (attached to the moving person/car)
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace("0.9", "0.15").replace("0.85", "0.12");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3. Connector from symbol down to hazard so viewer sees the symbol is attached
      const iconAnchorY = cy - radius - iconSize * 0.2;
      const circleTopY = cy - radius;
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, "1)");
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, iconAnchorY);
      ctx.lineTo(cx, circleTopY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Icon attached above the hazard (moves with the hazard)
      drawHazardIcon(ctx, cx, cy - radius, h.type, iconSize, color.replace(/[\d.]+\)$/, "1)"));

      // 5. Label (person/vehicle + confidence) so viewer knows the hazard that's come up
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      const labelY = cy - radius - iconSize * 1.6 - 8;
      const typeLabel = h.type === "person" ? "Person" : h.type === "vehicle" ? "Vehicle" : h.type;
      ctx.fillText(
        `${typeLabel}${h.confidence != null ? ` ${(h.confidence * 100).toFixed(0)}%` : ""}`,
        cx,
        labelY
      );
    });
  };

  // Draw zones and hazard circles: for video use video dimensions; for YouTube use container-sized canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!showZones && hazards.length === 0)) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (useYoutube) {
      const container = containerRef.current;
      if (!container) return;
      const REF_W = 1920;
      const REF_H = 1080;
      const drawZonesAndHazards = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (showZones) {
          const scaleX = w / REF_W;
          const scaleY = h / REF_H;
          zones.forEach((zone) => {
            const color = getZoneColor(zone.type);
            const scaled = zone.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
            drawPolygon(ctx, scaled, color, zone.name);
          });
        }
        drawHazardCircles(ctx, w, h, hazardRefWidth, hazardRefHeight);
      };
      drawZonesAndHazards();
      const interval = setInterval(drawZonesAndHazards, 200);
      const ro = new ResizeObserver(drawZonesAndHazards);
      ro.observe(container);
      return () => {
        clearInterval(interval);
        ro.disconnect();
      };
    }

    const video = videoRef.current;
    if (!video) return;

    const drawZonesAndHazards = () => {
      if (video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          canvas.width = vw;
          canvas.height = vh;
          ctx.clearRect(0, 0, vw, vh);
          if (showZones) {
            const scaleX = vw / hazardRefWidth;
            const scaleY = vh / hazardRefHeight;
            zones.forEach((zone) => {
              const color = getZoneColor(zone.type);
              const scaled = zone.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
              drawPolygon(ctx, scaled, color, zone.name);
            });
          }
          drawHazardCircles(ctx, vw, vh, hazardRefWidth, hazardRefHeight);
        }
      }
    };

    video.addEventListener("loadedmetadata", drawZonesAndHazards);
    video.addEventListener("loadeddata", drawZonesAndHazards);
    const interval = setInterval(drawZonesAndHazards, 100);

    return () => {
      video.removeEventListener("loadedmetadata", drawZonesAndHazards);
      video.removeEventListener("loadeddata", drawZonesAndHazards);
      clearInterval(interval);
    };
  }, [zones, showZones, hazards, hazardRefWidth, hazardRefHeight, useYoutube]);

  const getZoneColor = (type: string): string => {
    switch (type) {
      case "exclusion":
        return "rgba(239, 68, 68, 0.3)"; // red
      case "approach":
        return "rgba(245, 158, 11, 0.3)"; // orange
      case "crossing":
        return "rgba(59, 130, 246, 0.3)"; // blue
      default:
        return "rgba(139, 92, 246, 0.3)"; // purple
    }
  };

  const drawPolygon = (
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    color: string,
    label?: string
  ) => {
    if (points.length < 3) return;

    ctx.strokeStyle = color.replace("0.3", "1");
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw label
    if (label) {
      const center = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      };
      ctx.fillStyle = "white";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(label, center.x, center.y);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live Feed
          {simulationMode && (
            <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Simulation
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Device: {deviceId} | Site: {siteId}
          {(isPlaying || useYoutube) && <span className="ml-2 text-green-600">● Live</span>}
        </CardDescription>
        {simulationMode && useYoutube && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Simulation feed: YouTube video. Alerts and zones work as usual.
          </p>
        )}
        {simulationMode && !useYoutube && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            For a train station scene, add <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">public/demo-train-station.mp4</code> or use YouTube in simulation config.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative bg-black rounded-lg overflow-hidden"
          style={{ aspectRatio: useYoutube ? "16/9" : undefined, maxHeight: useYoutube ? "600px" : undefined }}
        >
          {useYoutube && embedVideoId ? (
            <>
              <iframe
                title="Live feed"
                src={`https://www.youtube.com/embed/${embedVideoId}?autoplay=1&mute=1&loop=1&playlist=${embedVideoId}&controls=1&rel=0`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {(showZones || hazards.length > 0) && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden
                />
              )}
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                loop={simulationMode}
                className="w-full h-auto block"
                style={{ maxHeight: "600px", objectFit: "contain" }}
              />
              {(showZones || hazards.length > 0) && (
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  aria-hidden
                />
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
