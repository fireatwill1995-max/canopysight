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

/** A detected person or object to highlight on the live feed (from detection events or simulation). */
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
  /** Detected persons/objects to highlight with a green box on the feed (boundingBox in hazardRefWidth x hazardRefHeight space). */
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
        let aborted = false;
        const loadHls = async () => {
          try {
            const Hls = (await import("hls.js")).default;
            if (aborted) return;
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
              video.src = effectiveStreamUrl;
            } else {
              setError(
                "HLS (.m3u8) stream not supported in this browser. Try Chrome or Firefox with a recent version."
              );
            }
          } catch (e) {
            if (!aborted) {
              setError(
                streamErrorMessage(effectiveStreamUrl, null) +
                  " HLS failed to load."
              );
            }
          }
        };
        loadHls();
        const originalCleanup = () => { aborted = true; };
        const baseReturn = () => {
          originalCleanup();
          video.removeEventListener("play", onPlay);
          video.removeEventListener("pause", onPause);
          video.removeEventListener("error", onVideoError);
          if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
          }
          video.src = "";
        };
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("error", onVideoError);
        return baseReturn;
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

  /** Draw detections as a thin green box with subtle highlight (no red circle). */
  const drawHazardBoxes = (
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    refW: number,
    refH: number
  ) => {
    if (hazards.length === 0) return;
    const scaleX = canvasW / refW;
    const scaleY = canvasH / refH;
    const BOX_STROKE = 2;
    const HIGHLIGHT_FILL = "rgba(34, 197, 94, 0.08)"; // subtle green tint
    const BOX_STROKE_COLOR = "rgba(34, 197, 94, 0.95)"; // thin green border

    hazards.forEach((hazard) => {
      const b = hazard.boundingBox;
      const x = b.x * scaleX;
      const y = b.y * scaleY;
      const w = b.width * scaleX;
      const boxH = b.height * scaleY;

      // 1. Subtle green highlight inside the box
      ctx.fillStyle = HIGHLIGHT_FILL;
      ctx.fillRect(x, y, w, boxH);

      // 2. Thin green box around the detection
      ctx.strokeStyle = BOX_STROKE_COLOR;
      ctx.lineWidth = BOX_STROKE;
      ctx.strokeRect(x, y, w, boxH);

      // 3. Small label above the box (optional, keeps context)
      const typeLabel = hazard.type === "person" ? "Person" : hazard.type === "vehicle" ? "Vehicle" : hazard.type;
      const labelText = `${typeLabel}${hazard.confidence != null ? ` ${(hazard.confidence * 100).toFixed(0)}%` : ""}`;
      ctx.font = "11px Arial";
      ctx.fillStyle = "rgba(34, 197, 94, 0.95)";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const labelY = Math.max(14, y - 4);
      ctx.fillText(labelText, x, labelY);
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
        drawHazardBoxes(ctx, w, h, hazardRefWidth, hazardRefHeight);
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
          drawHazardBoxes(ctx, vw, vh, hazardRefWidth, hazardRefHeight);
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
