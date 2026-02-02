"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { DetailPageSkeleton, Skeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MeshConnectConfig } from "@/components/meshconnect-config";
import { CameraConfigPanel, type CameraConfigItem } from "@/components/camera-config-panel";

interface SystemHealthEntry {
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  timestamp: string;
}

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const { addToast } = useToast();
  const { data: device, isLoading, error, refetch } = trpc.device.byId.useQuery({ id: deviceId });
  const updateMutation = trpc.device.update.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Device updated",
        description: "Device information has been updated successfully",
      });
      setEditingDevice(false);
      refetch();
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Update failed",
        description: error.message || "Failed to update device",
      });
    },
  });

  const [editingDevice, setEditingDevice] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    streamUrl: "",
    status: "offline" as "online" | "offline" | "maintenance" | "error",
    ipAddress: "",
    macAddress: "",
    firmwareVersion: "",
  });

  const openEditForm = () => {
    setEditForm({
      name: device?.name ?? "",
      streamUrl: device?.streamUrl ?? "",
      status: (device?.status as "online" | "offline" | "maintenance" | "error") ?? "offline",
      ipAddress: device?.ipAddress ?? "",
      macAddress: device?.macAddress ?? "",
      firmwareVersion: device?.firmwareVersion ?? "",
    });
    setEditingDevice(true);
  };

  const submitEdit = () => {
    if (!deviceId) return;
    updateMutation.mutate({
      id: deviceId,
      name: editForm.name,
      streamUrl: editForm.streamUrl || undefined,
      status: editForm.status,
      ipAddress: editForm.ipAddress || undefined,
      macAddress: editForm.macAddress || undefined,
      firmwareVersion: editForm.firmwareVersion || undefined,
    });
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !device) {
    return (
      <div className="container mx-auto p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">Error loading device: {error?.message || "Device not found"}</p>
          <Button className="mt-4" onClick={() => router.push("/devices")}>
            Back to Devices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="canopy-page">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4 min-h-[44px] touch-manipulation">
          ← Back
        </Button>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          {device.name}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">Device Details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-gradient">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>ℹ️ Device Information</CardTitle>
                <CardDescription>Basic device details and configuration</CardDescription>
              </div>
              <div className="flex gap-2">
                {!editingDevice && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openEditForm}
                    className="min-h-[32px]"
                    title="Edit device"
                  >
                    Configure
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="min-h-[32px]"
                  title="Refresh device data"
                >
                  🔄
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingDevice ? (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm">Edit device</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          status: e.target.value as "online" | "offline" | "maintenance" | "error",
                        })
                      }
                      className="w-full px-3 py-2 border rounded text-sm"
                    >
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Stream URL</label>
                    <input
                      type="url"
                      value={editForm.streamUrl}
                      onChange={(e) => setEditForm({ ...editForm, streamUrl: e.target.value })}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Firmware version</label>
                    <input
                      type="text"
                      value={editForm.firmwareVersion}
                      onChange={(e) => setEditForm({ ...editForm, firmwareVersion: e.target.value })}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="e.g. 1.0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">IP Address</label>
                    <input
                      type="text"
                      value={editForm.ipAddress}
                      onChange={(e) => setEditForm({ ...editForm, ipAddress: e.target.value })}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">MAC Address</label>
                    <input
                      type="text"
                      value={editForm.macAddress}
                      onChange={(e) => setEditForm({ ...editForm, macAddress: e.target.value })}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitEdit} disabled={updateMutation.isPending} className="bg-primary text-primary-foreground hover:opacity-90">
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingDevice(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
            <div>
              <span className="text-sm font-medium text-gray-500">Status:</span>
              <span
                className={`ml-2 px-3 py-1 rounded text-sm font-medium ${
                  device.status === "online"
                    ? "bg-green-100 text-green-800"
                    : device.status === "offline"
                    ? "bg-gray-100 text-gray-800"
                    : device.status === "maintenance"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {device.status}
              </span>
            </div>
            {device.site && (
              <div>
                <span className="text-sm font-medium text-gray-500">Site:</span>
                <Link
                  href={`/sites/${device.siteId}`}
                  className="ml-2 text-blue-600 hover:underline"
                >
                  {device.site.name}
                </Link>
              </div>
            )}
            {device.serialNumber && (
              <div>
                <span className="text-sm font-medium text-gray-500">Serial Number:</span>
                <span className="ml-2">{device.serialNumber}</span>
              </div>
            )}
            {device.firmwareVersion && (
              <div>
                <span className="text-sm font-medium text-gray-500">Firmware Version:</span>
                <span className="ml-2">{device.firmwareVersion}</span>
              </div>
            )}
            {device.ipAddress && (
              <div>
                <span className="text-sm font-medium text-gray-500">IP Address:</span>
                <span className="ml-2">{device.ipAddress}</span>
              </div>
            )}
            {device.macAddress && (
              <div>
                <span className="text-sm font-medium text-gray-500">MAC Address:</span>
                <span className="ml-2">{device.macAddress}</span>
              </div>
            )}
            {device.streamUrl && (
              <div>
                <span className="text-sm font-medium text-gray-500">Stream URL:</span>
                <a
                  href={device.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-primary hover:underline break-all"
                >
                  {device.streamUrl}
                </a>
              </div>
            )}
            {device.lastHeartbeat && (
              <div>
                <span className="text-sm font-medium text-gray-500">Last Heartbeat:</span>
                <span className="ml-2">{new Date(device.lastHeartbeat).toLocaleString()}</span>
              </div>
            )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Recent health metrics and performance data</CardDescription>
          </CardHeader>
          <CardContent>
            {device.systemHealth && device.systemHealth.length > 0 ? (
              <div className="space-y-3">
                {(device.systemHealth as SystemHealthEntry[]).slice(0, 5).map((health, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50">
                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">CPU Usage</div>
                        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{health.cpuUsage}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Memory Usage</div>
                        <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{health.memoryUsage}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Temperature</div>
                        <div className="text-lg font-semibold text-red-600 dark:text-red-400">{health.temperature}°C</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                      📅 {new Date(health.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
                {device.systemHealth.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    Showing latest 5 of {device.systemHealth.length} health records
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm">No health data available</p>
                <p className="text-xs mt-1">Health metrics will appear here once the device starts reporting</p>
              </div>
            )}
          </CardContent>
        </Card>

        {device.deviceType === "camera" && (
          <div className="md:col-span-2">
            <CameraConfigPanel
              deviceId={deviceId}
              cameraConfigs={(device.cameraConfigs ?? []) as CameraConfigItem[]}
              onUpdate={() => refetch()}
            />
          </div>
        )}

        {device.deviceType === "meshconnect" && (
          <div className="md:col-span-2">
            <MeshConnectConfig deviceId={deviceId} />
          </div>
        )}
      </div>
    </main>
  );
}
