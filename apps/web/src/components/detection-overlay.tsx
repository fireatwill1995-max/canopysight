"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Detection {
  id: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

interface DetectionOverlayProps {
  imageUrl: string;
  detections: Detection[];
  width?: number;
  height?: number;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "#22c55e"; // green
  if (confidence >= 0.5) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export function DetectionOverlay({
  imageUrl,
  detections,
  width,
  height,
}: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const allClasses = Array.from(new Set(detections.map((d) => d.label)));

  const toggleClass = (cls: string) => {
    setHiddenClasses((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = width ?? containerRef.current?.clientWidth ?? img.naturalWidth;
    const h = height ?? (w * img.naturalHeight) / img.naturalWidth;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const scaleX = w / img.naturalWidth;
    const scaleY = h / img.naturalHeight;

    const visible = detections.filter((d) => !hiddenClasses.has(d.label));

    for (const det of visible) {
      const color = getConfidenceColor(det.confidence);
      const bx = det.bbox.x * scaleX;
      const by = det.bbox.y * scaleY;
      const bw = det.bbox.width * scaleX;
      const bh = det.bbox.height * scaleY;
      const isHovered = hoveredId === det.id;

      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Label background
      const labelText = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 12px Inter, sans-serif";
      const metrics = ctx.measureText(labelText);
      const lh = 18;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by - lh, metrics.width + 8, lh);
      ctx.fillStyle = "#fff";
      ctx.fillText(labelText, bx + 4, by - 5);

      // Hover tooltip
      if (isHovered) {
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        const tooltipLines = [
          `Class: ${det.label}`,
          `Confidence: ${(det.confidence * 100).toFixed(1)}%`,
          `Position: (${det.bbox.x}, ${det.bbox.y})`,
          `Size: ${det.bbox.width}x${det.bbox.height}`,
        ];
        const tw = 180;
        const th = tooltipLines.length * 18 + 12;
        const tx = Math.min(bx + bw + 8, w - tw - 8);
        const ty = Math.max(by, 8);
        ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = "#fff";
        ctx.font = "12px Inter, sans-serif";
        tooltipLines.forEach((line, i) => {
          ctx.fillText(line, tx + 8, ty + 18 + i * 18);
        });
      }
    }
  }, [detections, hiddenClasses, hoveredId, imgLoaded, width, height]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scaleX = canvas.width / img.naturalWidth;
      const scaleY = canvas.height / img.naturalHeight;

      const hit = detections.find((d) => {
        if (hiddenClasses.has(d.label)) return false;
        const bx = d.bbox.x * scaleX;
        const by = d.bbox.y * scaleY;
        const bw = d.bbox.width * scaleX;
        const bh = d.bbox.height * scaleY;
        return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
      });

      setHoveredId(hit?.id ?? null);
    },
    [detections, hiddenClasses]
  );

  return (
    <div ref={containerRef} className="relative">
      {!imgLoaded && (
        <div className="w-full aspect-video bg-muted animate-pulse rounded-lg" />
      )}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredId(null)}
        className={`w-full rounded-lg ${imgLoaded ? "" : "hidden"}`}
        style={{ cursor: hoveredId ? "pointer" : "default" }}
      />

      {allClasses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {allClasses.map((cls) => (
            <button
              key={cls}
              onClick={() => toggleClass(cls)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                hiddenClasses.has(cls)
                  ? "border-border text-muted-foreground opacity-50"
                  : "border-primary/30 bg-primary/10 text-foreground"
              }`}
            >
              {hiddenClasses.has(cls) ? "○" : "●"} {cls}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
