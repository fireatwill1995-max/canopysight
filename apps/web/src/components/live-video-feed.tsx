"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { getYoutubeVideoId } from "@/lib/simulation";

/** Build a user-friendly error message for stream load failures */
function streamErrorMessage(url: string | undefined, mediaError?: MediaError | null): string {
  const base = "Failed to load stream.";
  if (!url) return base;
  const shortUrl = url.length > 60 ? url.slice(0, 57) + "…" : url;
  const code =
    mediaError?.code === 1 ? " (format not supported)"
    : mediaError?.code === 2 ? " (network error)"
    : mediaError?.code === 3 ? " (decode error)"
    : mediaError?.code === 4 ? " (source not supported)"
    : "";
  return `${base} ${shortUrl}${code}. Verify the stream URL is a direct video or HLS (.m3u8) link and CORS is configured.`;
}

/** A real-time detection to highlight on the live feed. */
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
  showZones?: boolean;
  zones?: Array<{
    id: string;
    name: string;
    points: Array<{ x: number; y: number }>;
    type: string;
  }>;
  /** Real-time AI detections to overlay as bounding boxes. */
  hazards?: HazardOverlay[];
  /** Reference resolution for hazard boundingBox coordinates (default 1920×1080). */
  hazardRefWidth?: number;
  hazardRefHeight?: number;
}

export function LiveVideoFeed({
  deviceId,
  siteId,
  streamUrl,
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

  const youtubeId = streamUrl ? getYoutubeVideoId(streamUrl) : null;
  const useYoutube = !!youtubeId;
  const effectiveStreamUrl = streamUrl && !youtubeId ? streamUrl : undefined;

  useEffect(() => {
    if (useYoutube) return;
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    let hlsInstance: import("hls.js").default | null = null;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVideoError = () => {
      setError(streamErrorMessage(effectiveStreamUrl ?? undefined, video.error ?? undefined));
    };

    if (effectiveStreamUrl) {
      if (effectiveStreamUrl.endsWith(".m3u8")) {
        let aborted = false;
        const loadHls = async () => {
          try {
            const Hls = (await import("hls.js")).default;
            if (aborted) return;
            if (Hls.isSupported()) {
              hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
              hlsInstance.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                  setError(`HLS stream error. Check ${effectiveStreamUrl.length > 60 ? effectiveStreamUrl.slice(0, 57) + "…" : effectiveStreamUrl} is a valid .m3u8 with CORS enabled.`);
                }
              });
              hlsInstance.loadSource(effectiveStreamUrl);
              hlsInstance.attachMedia(video);
              video.src = "";
            } else if (video.canPlayType("application/vnd.apple.mpegurl") !== "") {
              video.src = effectiveStreamUrl;
            } else {
              setError("HLS (.m3u8) not supported in this browser. Use Chrome or Firefox.");
            }
          } catch {
            if (!aborted) setError(streamErrorMessage(effectiveStreamUrl, null) + " HLS failed to load.");
          }
        };
        loadHls();
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("error", onVideoError);
        return () => {
          aborted = true;
          video.removeEventListener("play", onPlay);
          video.removeEventListener("pause", onPause);
          video.removeEventListener("error", onVideoError);
          hlsInstance?.destroy();
          hlsInstance = null;
          video.src = "";
        };
      } else {
        video.src = effectiveStreamUrl;
      }
    } else {
      setError("No stream URL configured for this device. Add a stream URL in device settings.");
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onVideoError);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onVideoError);
      hlsInstance?.destroy();
      hlsInstance = null;
      video.src = "";
    };
  }, [effectiveStreamUrl, useYoutube]);

  /** Draw real-time AI detection bounding boxes. */
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

    hazards.forEach((hazard) => {
      const b = hazard.boundingBox;
      const x = b.x * scaleX;
      const y = b.y * scaleY;
      const w = b.width * scaleX;
      const h = b.height * scaleY;

      // Detection box
      ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);

      // Label
      const label = `${hazard.type}${hazard.confidence != null ? ` ${(hazard.confidence * 100).toFixed(0)}%` : ""}`;
      ctx.font = "11px Arial";
      ctx.fillStyle = "rgba(34, 197, 94, 0.95)";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x, Math.max(14, y - 4));
    });
  };

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
      const draw = () => {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        ctx.clearRect(0, 0, cw, ch);
        if (showZones) {
          zones.forEach((zone) => {
            const scaled = zone.points.map((p) => ({
              x: p.x * (cw / REF_W),
              y: p.y * (ch / REF_H),
            }));
            drawPolygon(ctx, scaled, getZoneColor(zone.type), zone.name);
          });
        }
        drawHazardBoxes(ctx, cw, ch, hazardRefWidth, hazardRefHeight);
      };
      draw();
      const interval = setInterval(draw, 200);
      const ro = new ResizeObserver(draw);
      ro.observe(container);
      return () => { clearInterval(interval); ro.disconnect(); };
    }

    const video = videoRef.current;
    if (!video) return;

    const draw = () => {
      if (video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          canvas.width = vw;
          canvas.height = vh;
          ctx.clearRect(0, 0, vw, vh);
          if (showZones) {
            zones.forEach((zone) => {
              const scaled = zone.points.map((p) => ({
                x: p.x * (vw / hazardRefWidth),
                y: p.y * (vh / hazardRefHeight),
              }));
              drawPolygon(ctx, scaled, getZoneColor(zone.type), zone.name);
            });
          }
          drawHazardBoxes(ctx, vw, vh, hazardRefWidth, hazardRefHeight);
        }
      }
    };

    video.addEventListener("loadedmetadata", draw);
    video.addEventListener("loadeddata", draw);
    const interval = setInterval(draw, 100);
    return () => {
      video.removeEventListener("loadedmetadata", draw);
      video.removeEventListener("loadeddata", draw);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, showZones, hazards, hazardRefWidth, hazardRefHeight, useYoutube]);

  const getZoneColor = (type: string): string => {
    switch (type) {
      case "exclusion": return "rgba(239, 68, 68, 0.3)";
      case "approach":  return "rgba(245, 158, 11, 0.3)";
      case "crossing":  return "rgba(59, 130, 246, 0.3)";
      default:          return "rgba(139, 92, 246, 0.3)";
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
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (label) {
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      ctx.fillStyle = "white";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live Feed
          {(isPlaying || useYoutube) && (
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Live" />
          )}
        </CardTitle>
        <CardDescription>
          Device: {deviceId} · Site: {siteId}
          {hazards.length > 0 && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
              {hazards.length} detection{hazards.length !== 1 ? "s" : ""} active
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative bg-black rounded-lg overflow-hidden"
          style={{ aspectRatio: useYoutube ? "16/9" : undefined, maxHeight: useYoutube ? "600px" : undefined }}
        >
          {useYoutube && youtubeId ? (
            <>
              <iframe
                title="Live feed"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=1&rel=0`}
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-sm p-6 text-center">
                  <div>
                    <div className="text-2xl mb-2">📡</div>
                    <p>{error}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
