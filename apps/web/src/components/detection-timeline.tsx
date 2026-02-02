"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";

interface DetectionEvent {
  id: string;
  type: string;
  timestamp: Date | string;
  confidence: number;
}

interface DetectionTimelineProps {
  events: DetectionEvent[];
  startDate: Date;
  endDate: Date;
}

export function DetectionTimeline({ events, startDate, endDate }: DetectionTimelineProps) {
  const groupedEvents = useMemo(() => {
    const groups: Map<string, DetectionEvent[]> = new Map();

    events.forEach((event) => {
      const timestamp = typeof event.timestamp === "string" ? new Date(event.timestamp) : event.timestamp;
      const hour = new Date(timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    });

    return Array.from(groups.entries())
      .map(([time, evts]) => ({
        time: new Date(time),
        events: evts,
        count: evts.length,
      }))
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [events]);

  const maxCount = Math.max(...groupedEvents.map((g) => g.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detection Timeline</CardTitle>
        <CardDescription>Events over time</CardDescription>
      </CardHeader>
      <CardContent>
        {groupedEvents.length === 0 ? (
          <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100">
            <p className="text-gray-500 dark:text-gray-300">No events in this time range</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedEvents.map((group, idx) => {
              const height = (group.count / maxCount) * 100;
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600 dark:text-gray-300">
                    {group.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex-1 relative h-8 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${height}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-200">
                      {group.count} events
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
