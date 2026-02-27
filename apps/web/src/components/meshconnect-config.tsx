"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button, Skeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";

interface MeshConnectConfigProps {
  deviceId: string;
  onClose?: () => void;
}

export function MeshConnectConfig({ deviceId, onClose }: MeshConnectConfigProps) {
  const { addToast } = useToast();
  const { data: config, isLoading, refetch } = trpc.meshconnect.getConfig.useQuery(
    { deviceId },
    { enabled: !!deviceId }
  );

  const updateMutation = trpc.meshconnect.upsertConfig.useMutation({
    onSuccess: () => {
      refetch();
      addToast({ type: "success", title: "Saved", description: "MeshConnect configuration saved successfully." });
    },
    onError: (e) => {
      addToast({ type: "error", title: "Save failed", description: e.message });
    },
  });

  const [formData, setFormData] = useState({
    frequencyBand: "dual" as "1.35-1.44" | "2.20-2.50" | "dual",
    throughput: 100,
    latency: 7,
    encryptionEnabled: true,
    encryptionKey: "",
    meshNodeId: "",
    parentNodeId: "",
    wifiEnabled: false,
    wifiSSID: "",
    wifiPassword: "",
    ethernetPorts: 4,
    isGateway: false,
    gatewayAddress: "",
  });

  useEffect(() => {
    if (config) {
      setFormData({
        frequencyBand: (config.frequencyBand === "1.35-1.44" || config.frequencyBand === "2.20-2.50" || config.frequencyBand === "dual")
          ? config.frequencyBand
          : "dual",
        throughput: config.throughput ?? 100,
        latency: config.latency ?? 7,
        encryptionEnabled: config.encryptionEnabled ?? true,
        encryptionKey: "",
        meshNodeId: config.meshNodeId ?? "",
        parentNodeId: config.parentNodeId ?? "",
        wifiEnabled: config.wifiEnabled ?? false,
        wifiSSID: config.wifiSSID ?? "",
        wifiPassword: "",
        ethernetPorts: config.ethernetPorts ?? 4,
        isGateway: config.isGateway ?? false,
        gatewayAddress: config.gatewayAddress ?? "",
      });
    }
  }, [config]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const handleSave = () => {
    const frequencyBand = (formData.frequencyBand === "1.35-1.44" || formData.frequencyBand === "2.20-2.50" || formData.frequencyBand === "dual")
      ? formData.frequencyBand
      : "dual";
    updateMutation.mutate({
      deviceId,
      ...formData,
      frequencyBand,
      nodeStatus: (config?.nodeStatus as "connected" | "disconnected" | "syncing" | "error") ?? "disconnected",
      // Only send password if changed
      encryptionKey: formData.encryptionKey || undefined,
      wifiPassword: formData.wifiPassword || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>MeshConnect Configuration</CardTitle>
        <CardDescription>
          Configure mesh network settings for this MeshConnect device
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Frequency Band *</label>
            <select
              value={formData.frequencyBand}
              onChange={(e) =>
                setFormData({ 
                  ...formData, 
                  frequencyBand: e.target.value as "1.35-1.44" | "2.20-2.50" | "dual"
                })
              }
              className="w-full px-3 py-2 border rounded"
            >
              <option value="1.35-1.44">1.35-1.44 GHz</option>
              <option value="2.20-2.50">2.20-2.50 GHz</option>
              <option value="dual">Dual Band</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Throughput (Mbps)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.throughput}
              onChange={(e) =>
                setFormData({ ...formData, throughput: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Latency (ms)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={formData.latency}
              onChange={(e) =>
                setFormData({ ...formData, latency: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ethernet Ports</label>
            <input
              type="number"
              min="1"
              max="8"
              value={formData.ethernetPorts}
              onChange={(e) =>
                setFormData({ ...formData, ethernetPorts: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Mesh Node ID</label>
            <input
              type="text"
              value={formData.meshNodeId}
              onChange={(e) =>
                setFormData({ ...formData, meshNodeId: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              placeholder="Auto-generated if empty"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Parent Node ID</label>
            <input
              type="text"
              value={formData.parentNodeId}
              onChange={(e) =>
                setFormData({ ...formData, parentNodeId: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              placeholder="Leave empty for root node"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.encryptionEnabled}
              onChange={(e) =>
                setFormData({ ...formData, encryptionEnabled: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm font-medium">Enable AES-256 Encryption</span>
          </label>

          {formData.encryptionEnabled && (
            <div>
              <label className="block text-sm font-medium mb-2">Encryption Key</label>
              <input
                type="password"
                value={formData.encryptionKey}
                onChange={(e) =>
                  setFormData({ ...formData, encryptionKey: e.target.value })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder="Leave empty to keep existing key"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.wifiEnabled}
              onChange={(e) =>
                setFormData({ ...formData, wifiEnabled: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm font-medium">Enable Wi-Fi Access Point</span>
          </label>

          {formData.wifiEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Wi-Fi SSID</label>
                <input
                  type="text"
                  value={formData.wifiSSID}
                  onChange={(e) =>
                    setFormData({ ...formData, wifiSSID: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Wi-Fi Password</label>
                <input
                  type="password"
                  value={formData.wifiPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, wifiPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Leave empty to keep existing"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isGateway}
              onChange={(e) =>
                setFormData({ ...formData, isGateway: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm font-medium">Is Gateway Node</span>
          </label>

          {!formData.isGateway && (
            <div>
              <label className="block text-sm font-medium mb-2">Gateway Address</label>
              <input
                type="text"
                value={formData.gatewayAddress}
                onChange={(e) =>
                  setFormData({ ...formData, gatewayAddress: e.target.value })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder="192.168.1.1"
              />
            </div>
          )}
        </div>

        {config && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded space-y-2 text-gray-900 dark:text-gray-100">
            <h4 className="font-medium">Current Status</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-300">Node Status:</span>{" "}
                <span
                  className={`font-medium ${
                    config.nodeStatus === "connected"
                      ? "text-green-600"
                      : config.nodeStatus === "error"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                >
                  {config.nodeStatus}
                </span>
              </div>
              {config.signalStrength && (
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Signal:</span>{" "}
                  <span className="font-medium">{config.signalStrength} dBm</span>
                </div>
              )}
              {config.latency && (
                <div>
                  <span className="text-gray-600">Latency:</span>{" "}
                  <span className="font-medium">{config.latency} ms</span>
                </div>
              )}
              {config.throughput && (
                <div>
                  <span className="text-gray-600">Throughput:</span>{" "}
                  <span className="font-medium">{config.throughput} Mbps</span>
                </div>
              )}
            </div>
            {(() => {
              const neighbors = (config as { neighborNodes?: unknown }).neighborNodes;
              const list = Array.isArray(neighbors) ? (neighbors as string[]) : [];
              return list.length > 0 ? (
                <div className="text-sm">
                  <span className="text-gray-600">Neighbors:</span>{" "}
                  <span className="font-medium">{list.join(", ")}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {updateMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
