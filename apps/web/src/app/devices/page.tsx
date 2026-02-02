"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { DeviceCardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { DeviceStatusPanel } from "@/components/device-status-panel";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { isSimulationMode } from "@/lib/simulation";

export default function DevicesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "maintenance" | "error">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "camera" | "meshconnect">("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const canQuery = useCanUseProtectedTrpc();

  const { data: devices, isLoading, error, refetch } = trpc.device.list.useQuery({}, { enabled: canQuery, retry: false });
  const { data: sites } = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });
  
  const createMutation = trpc.device.create.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Device created",
        description: "The device has been successfully added",
      });
      refetch();
      setShowCreateModal(false);
      setFormData({
        name: "",
        siteId: "",
        serialNumber: "",
        firmwareVersion: "",
        deviceType: "camera",
        status: "offline",
        ipAddress: "",
        macAddress: "",
        streamUrl: "",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to create device",
        description: error.message || "An error occurred while creating the device",
      });
    },
  });

  const deleteMutation = trpc.device.delete.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Device removed",
        description: "The device has been removed",
      });
      refetch();
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to remove device",
        description: error.message || "An error occurred while removing the device",
      });
    },
  });

  const handleDelete = (deviceId: string, deviceName: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Remove device "${deviceName}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: deviceId });
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    siteId: "",
    serialNumber: "",
    firmwareVersion: "",
    deviceType: "camera" as "camera" | "meshconnect",
    status: "offline" as "online" | "offline" | "maintenance" | "error",
    ipAddress: "",
    macAddress: "",
    streamUrl: "",
  });

  const handleCreate = () => {
    if (!formData.name || !formData.siteId) {
      addToast({
        type: "warning",
        title: "Missing required fields",
        description: "Please fill in the device name and select a site",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  // Filter devices
  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    
    let filtered = [...devices];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (device) =>
          device.name.toLowerCase().includes(query) ||
          device.serialNumber?.toLowerCase().includes(query) ||
          device.ipAddress?.toLowerCase().includes(query) ||
          device.macAddress?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((device) => device.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((device) => device.deviceType === typeFilter);
    }

    // Apply site filter
    if (siteFilter !== "all") {
      filtered = filtered.filter((device) => device.siteId === siteFilter);
    }

    return filtered;
  }, [devices, searchQuery, statusFilter, typeFilter, siteFilter]);

  const handleViewDetails = (deviceId: string) => {
    // Navigate to device detail page or show details modal
    router.push(`/devices/${deviceId}`);
  };

  const handleConfigure = (deviceId: string) => {
    router.push(`/devices/${deviceId}`);
  };

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
              Devices
              {simulationOn && (
                <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Simulation
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Monitor and manage edge detection devices</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)} 
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 shadow-md min-h-[44px] touch-manipulation"
          >
            + Add Device
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices by name, serial, IP, or MAC address..."
              className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
              <option value="error">Error</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
            >
              <option value="all">All Types</option>
              <option value="camera">Camera</option>
              <option value="meshconnect">MeshConnect</option>
            </select>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
            >
              <option value="all">All Sites</option>
              {sites?.map((site: { id: string; name: string }) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>

            {(searchQuery || statusFilter !== "all" || typeFilter !== "all" || siteFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setSiteFilter("all");
                }}
                className="min-h-[44px] touch-manipulation"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {searchQuery && (
            <div className="text-sm text-gray-600">
              Showing {filteredDevices.length} of {devices?.length || 0} devices
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="space-y-4">
              <DeviceCardSkeleton count={3} />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-8">
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-800">Error loading devices: {error.message}</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredDevices.length > 0 ? (
            <div className="space-y-4">
              {filteredDevices.map((device) => (
                <Card key={device.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{device.name}</CardTitle>
                        <CardDescription>
                          {device.deviceType === "meshconnect" && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs mr-2">
                              MeshConnect
                            </span>
                          )}
                          Serial: {device.serialNumber || "N/A"} | IP: {device.ipAddress || "N/A"}
                        </CardDescription>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-sm font-medium ${
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
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {device.site && (
                        <p className="text-sm text-gray-600">
                          Site: <Link href={`/sites/${device.siteId}`} className="text-blue-600 hover:underline">{device.site.name}</Link>
                        </p>
                      )}
                      {device.lastHeartbeat && (
                        <p className="text-sm text-gray-500">
                          Last heartbeat: {new Date(device.lastHeartbeat).toLocaleString()}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2 mt-4 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(device.id)}
                          className="min-h-[44px] touch-manipulation"
                        >
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigure(device.id)}
                          className="min-h-[44px] touch-manipulation"
                        >
                          Configure
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(device.id, device.name)}
                          disabled={deleteMutation.isPending}
                          className="min-h-[44px] touch-manipulation text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-4xl mb-3">📡</div>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {searchQuery || statusFilter !== "all" || typeFilter !== "all" || siteFilter !== "all"
                    ? "No devices match your filters"
                    : "No devices configured yet"}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  {searchQuery || statusFilter !== "all" || typeFilter !== "all" || siteFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Get started by adding your first device"}
                </p>
                <Button 
                  className="mt-4 min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90" 
                  onClick={() => setShowCreateModal(true)}
                >
                  + Add Your First Device
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <DeviceStatusPanel />
        </div>
      </div>

      {/* Create Device Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-strong p-4 sm:p-6 max-w-md w-full mx-auto my-auto max-h-[90vh] overflow-y-auto border-border">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Create New Device</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="Device name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Site *</label>
                <select
                  value={formData.siteId}
                  onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                >
                  <option value="">Select a site</option>
                  {sites?.map((site: any) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Serial Number</label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="Device serial number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Firmware Version</label>
                <input
                  type="text"
                  value={formData.firmwareVersion}
                  onChange={(e) => setFormData({ ...formData, firmwareVersion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="e.g., 1.0.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Device Type</label>
                <select
                  value={formData.deviceType || "camera"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deviceType: e.target.value as "camera" | "meshconnect",
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                >
                  <option value="camera">Camera Device</option>
                  <option value="meshconnect">MeshConnect Node</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Stream URL / Camera feed</label>
                <input
                  type="text"
                  value={formData.streamUrl}
                  onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value.trim() })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="https://www.youtube.com/watch?v=... or other stream URL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional. YouTube live or video URL, or other stream link. Used as the device&apos;s live feed on the site.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "online" | "offline" | "maintenance" | "error",
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                >
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">IP Address</label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="192.168.1.100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">MAC Address</label>
                <input
                  type="text"
                  value={formData.macAddress}
                  onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="00:11:22:33:44:55"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex-1 min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90"
              >
                {createMutation.isPending ? "Creating..." : "Create Device"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 min-h-[44px] touch-manipulation"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
