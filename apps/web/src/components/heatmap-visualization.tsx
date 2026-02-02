"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";

interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
}

interface HeatmapVisualizationProps {
  data: HeatmapPoint[];
  width?: number;
  height?: number;
}

export function HeatmapVisualization({ data, width = 800, height = 600 }: HeatmapVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Normalize intensities
    const maxIntensity = Math.max(...data.map((p) => p.intensity));
    if (maxIntensity === 0) return;

    // Draw heatmap points
    data.forEach((point) => {
      const intensity = point.intensity / maxIntensity;
      const radius = 20 + intensity * 30;

      // Create gradient
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      
      // Color based on intensity (blue -> green -> yellow -> red)
      if (intensity < 0.25) {
        gradient.addColorStop(0, `rgba(0, 100, 255, ${intensity * 0.8})`);
        gradient.addColorStop(1, "rgba(0, 100, 255, 0)");
      } else if (intensity < 0.5) {
        gradient.addColorStop(0, `rgba(0, 255, 100, ${intensity * 0.8})`);
        gradient.addColorStop(1, "rgba(0, 255, 100, 0)");
      } else if (intensity < 0.75) {
        gradient.addColorStop(0, `rgba(255, 255, 0, ${intensity * 0.8})`);
        gradient.addColorStop(1, "rgba(255, 255, 0, 0)");
      } else {
        gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity * 0.8})`);
        gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Heatmap</CardTitle>
          <CardDescription>Spatial distribution of detections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100">
            <p className="text-gray-500 dark:text-gray-300">No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Heatmap</CardTitle>
        <CardDescription>Spatial distribution of detections</CardDescription>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} width={width} height={height} className="w-full h-auto border rounded" />
      </CardContent>
    </Card>
  );
}
