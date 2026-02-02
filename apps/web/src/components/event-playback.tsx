"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { useState } from "react";

interface DetectionEvent {
  id: string;
  type: string;
  confidence: number;
  timestamp: Date;
  boundingBox: { x: number; y: number; width: number; height: number };
  videoClipUrl?: string;
}

interface EventPlaybackProps {
  event: DetectionEvent;
}

export function EventPlayback({ event }: EventPlaybackProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Playback</CardTitle>
        <CardDescription>
          {event.type} detection - {new Date(event.timestamp).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {event.videoClipUrl ? (
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                src={event.videoClipUrl}
                controls
                className="w-full h-auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              {/* Overlay bounding box */}
              <div
                className="absolute border-2 border-red-500 pointer-events-none"
                style={{
                  left: `${event.boundingBox.x}px`,
                  top: `${event.boundingBox.y}px`,
                  width: `${event.boundingBox.width}px`,
                  height: `${event.boundingBox.height}px`,
                }}
              >
                <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded">
                  {event.type} ({(event.confidence * 100).toFixed(1)}%)
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-900 dark:text-gray-100">
              <p className="text-gray-500 dark:text-gray-300">Video clip not available</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-300">Type: </span>
              <span className="font-medium capitalize">{event.type}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-300">Confidence: </span>
              <span className="font-medium">{(event.confidence * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-300">Timestamp: </span>
              <span className="font-medium">{new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-300">Bounding Box: </span>
              <span className="font-mono text-xs">
                ({Math.round(event.boundingBox.x)}, {Math.round(event.boundingBox.y)}){" "}
                {Math.round(event.boundingBox.width)}×{Math.round(event.boundingBox.height)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
