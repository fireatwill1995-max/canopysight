"use client";

import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@canopy-sight/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Skeleton } from "@canopy-sight/ui";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect, useState } from "react";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";

interface DeviceStatus {
  id: string;
  name?: string;
  status: string;
  lastHeartbeat?: Date | string;
}

type DeviceListOutput = RouterOutputs["device"]["list"];
type DeviceListItem = DeviceListOutput[number];

export function DeviceStatusPanel() {
  const [deviceStatuses, setDeviceStatuses] = useState<Map<string, DeviceStatus>>(new Map());
  const canQuery = useCanUseProtectedTrpc();
  const { data: devices, isLoading } = trpc.device.list.useQuery({}, { enabled: canQuery, retry: false });
  const { connected } = useWebSocket({
    onDeviceStatus: (device: DeviceStatus) => {
      setDeviceStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(device.id, device);
        return updated;
      });
    },
  });

  useEffect(() => {
    if (!devices || !Array.isArray(devices)) return;
    const statusMap = new Map<string, DeviceStatus>();
    const list: DeviceListItem[] = devices;
    for (let i = 0; i < list.length; i++) {
      const device: DeviceListItem = list[i];
      const lastHb = device.lastHeartbeat;
      statusMap.set(device.id, {
        id: device.id,
        name: device.name ?? undefined,
        status: device.status,
        lastHeartbeat: lastHb != null ? (typeof lastHb === "string" ? lastHb : (lastHb as Date).toISOString()) : undefined,
      });
    }
    setDeviceStatuses(statusMap);
  }, [devices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800";
      case "offline":
        return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800";
      case "error":
        return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
    }
  };

  const devicesArray = Array.from(deviceStatuses.values());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Device Status</CardTitle>
            <CardDescription>
              Real-time device health monitoring
              {connected ? (
                <span className="ml-2 text-green-600">● Live</span>
              ) : (
                <span className="ml-2 text-gray-400">● Offline</span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 border-2 rounded">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : devicesArray.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No devices</p>
        ) : (
          <div className="space-y-2">
            {devicesArray.map((device: DeviceStatus) => (
              <div
                key={device.id}
                className={`p-3 border-2 rounded ${getStatusColor(device.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{device.name}</div>
                    {device.lastHeartbeat && (
                      <div className="text-xs mt-1 opacity-75">
                        Last heartbeat: {new Date(device.lastHeartbeat).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-medium capitalize">
                    {device.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
