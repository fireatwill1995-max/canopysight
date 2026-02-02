"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button, Skeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";

export interface CameraConfigItem {
  id: string;
  deviceId: string;
  cameraIndex: number;
  name?: string | null;
  resolution?: string | null;
  fps?: number | null;
  is360?: boolean;
  isActive?: boolean;
}

interface CameraConfigPanelProps {
  deviceId: string;
  cameraConfigs: CameraConfigItem[];
  onUpdate: () => void;
}

export function CameraConfigPanel({ deviceId, cameraConfigs, onUpdate }: CameraConfigPanelProps) {
  const { addToast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    cameraIndex: cameraConfigs.length,
    name: "",
    resolution: "1920x1080",
    fps: 30,
    is360: false,
    isActive: true,
  });
  const [editForm, setEditForm] = useState<Record<string, { name: string; resolution: string; fps: number; isActive: boolean }>>({});

  const createMutation = trpc.device.createCameraConfig.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Camera added", description: "Camera configuration has been added." });
      setShowAddForm(false);
      setAddForm({ cameraIndex: cameraConfigs.length, name: "", resolution: "1920x1080", fps: 30, is360: false, isActive: true });
      onUpdate();
    },
    onError: (e) => {
      addToast({ type: "error", title: "Failed to add camera", description: e.message });
    },
  });

  const updateMutation = trpc.device.updateCameraConfig.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Camera updated", description: "Camera configuration has been updated." });
      setEditingId(null);
      onUpdate();
    },
    onError: (e) => {
      addToast({ type: "error", title: "Failed to update camera", description: e.message });
    },
  });

  const deleteMutation = trpc.device.deleteCameraConfig.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Camera removed", description: "Camera configuration has been removed." });
      onUpdate();
    },
    onError: (e) => {
      addToast({ type: "error", title: "Failed to remove camera", description: e.message });
    },
  });

  const handleAdd = () => {
    createMutation.mutate({
      deviceId,
      cameraIndex: addForm.cameraIndex,
      name: addForm.name || undefined,
      resolution: addForm.resolution || undefined,
      fps: addForm.fps,
      is360: addForm.is360,
      isActive: addForm.isActive,
    });
  };

  const handleEdit = (config: CameraConfigItem) => {
    setEditingId(config.id);
    setEditForm((prev) => ({
      ...prev,
      [config.id]: {
        name: config.name ?? "",
        resolution: config.resolution ?? "1920x1080",
        fps: config.fps ?? 30,
        isActive: config.isActive ?? true,
      },
    }));
  };

  const handleSaveEdit = (id: string) => {
    const form = editForm[id];
    if (!form) return;
    updateMutation.mutate({
      id,
      deviceId,
      name: form.name || undefined,
      resolution: form.resolution || undefined,
      fps: form.fps ?? 30,
      isActive: form.isActive,
    });
  };

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remove this camera configuration?")) return;
    deleteMutation.mutate({ id, deviceId });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Camera configuration</CardTitle>
            <CardDescription>Add or edit camera settings for this device</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {showAddForm ? "Cancel" : "+ Add camera"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
            <h4 className="font-medium text-sm">New camera</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Camera index</label>
                <input
                  type="number"
                  min={0}
                  value={addForm.cameraIndex}
                  onChange={(e) => setAddForm({ ...addForm, cameraIndex: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                  placeholder="e.g. Main camera"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Resolution</label>
                <input
                  type="text"
                  value={addForm.resolution}
                  onChange={(e) => setAddForm({ ...addForm, resolution: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                  placeholder="1920x1080"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">FPS</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={addForm.fps}
                  onChange={(e) => setAddForm({ ...addForm, fps: parseInt(e.target.value, 10) || 30 })}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addForm.is360}
                  onChange={(e) => setAddForm({ ...addForm, is360: e.target.checked })}
                  className="rounded"
                />
                360°
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addForm.isActive}
                  onChange={(e) => setAddForm({ ...addForm, isActive: e.target.checked })}
                  className="rounded"
                />
                Active
              </label>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {createMutation.isPending ? "Adding..." : "Add camera"}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {cameraConfigs.length === 0 && !showAddForm ? (
            <p className="text-sm text-muted-foreground">No cameras configured. Click &quot;+ Add camera&quot; to add one.</p>
          ) : (
            cameraConfigs.map((config) => (
              <div key={config.id} className="p-3 border rounded-lg flex flex-wrap items-center justify-between gap-2">
                {editingId === config.id ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={editForm[config.id]?.name ?? ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id]!, name: e.target.value },
                          }))
                        }
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={editForm[config.id]?.resolution ?? ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id]!, resolution: e.target.value },
                          }))
                        }
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="Resolution"
                      />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={editForm[config.id]?.fps ?? 30}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id]!, fps: parseInt(e.target.value, 10) || 30 },
                          }))
                        }
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="FPS"
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm[config.id]?.isActive ?? true}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              [config.id]: { ...prev[config.id]!, isActive: e.target.checked },
                            }))
                          }
                          className="rounded"
                        />
                        Active
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(config.id)} disabled={updateMutation.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="font-medium text-sm">
                        {config.name || `Camera ${config.cameraIndex}`}
                      </span>
                      <span className="text-muted-foreground text-xs ml-2">
                        Index {config.cameraIndex} · {config.resolution || "N/A"} · {config.fps ?? 30} fps
                        {config.is360 ? " · 360°" : ""} · {config.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(config.id)}>
                        Remove
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
