"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { CardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { useState } from "react";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";

interface NotificationPreferenceEntry {
  id: string;
  channel: "sms" | "email" | "push" | "webhook";
  severity: string | null;
  siteIds: string[];
  isActive: boolean;
}

export default function NotificationsPage() {
  const { addToast } = useToast();
  const canQuery = useCanUseProtectedTrpc();
  const { data: preferences, isLoading, error, refetch } = trpc.notification.list.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
  });
  const createMutation = trpc.notification.create.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Notification rule created",
        description: "The notification preference has been successfully created",
      });
      refetch();
      setShowCreateModal(false);
      setFormData({
        channel: "email",
        severity: undefined,
        siteIds: [],
        isActive: true,
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to create notification rule",
        description: error.message || "An error occurred while creating the notification rule",
      });
    },
  });
  const updateMutation = trpc.notification.update.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Notification rule updated",
        description: "The notification preference has been successfully updated",
      });
      refetch();
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to update notification rule",
        description: error.message || "An error occurred while updating the notification rule",
      });
    },
  });
  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Notification rule deleted",
        description: "The notification preference has been successfully deleted",
      });
      refetch();
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to delete notification rule",
        description: error.message || "An error occurred while deleting the notification rule",
      });
    },
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    channel: "email" as "sms" | "email" | "push" | "webhook",
    severity: undefined as "advisory" | "warning" | "critical" | undefined,
    siteIds: [] as string[],
    isActive: true,
  });

  const { data: sites } = trpc.site.list.useQuery(undefined, { enabled: canQuery, retry: false });

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateMutation.mutate({
      id,
      isActive: !currentActive,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  return (
    <main className="canopy-page">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
              Notification Settings
            </h1>
            <p className="text-sm sm:text-base text-gray-600">Configure how and when you receive alerts</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)} 
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 shadow-md min-h-[44px] touch-manipulation"
          >
            + Create Notification Rule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800">Error loading preferences: {error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : preferences && preferences.length > 0 ? (
        <div className="space-y-4">
          {(preferences as NotificationPreferenceEntry[]).map((pref) => (
            <Card key={pref.id} className="card-gradient">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {pref.channel === "sms" && "📱"}
                      {pref.channel === "email" && "📧"}
                      {pref.channel === "push" && "🔔"}
                      {pref.channel === "webhook" && "🔗"}
                      {pref.channel.toUpperCase()} Notifications
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                          {pref.severity ? `Severity: ${pref.severity}` : "All severities"}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs">
                          {pref.siteIds.length > 0 ? `${pref.siteIds.length} sites` : "All sites"}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            pref.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {pref.isActive ? "✅ Active" : "❌ Inactive"}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(pref.id, pref.isActive)}
                      disabled={updateMutation.isPending}
                      className="min-h-[44px] touch-manipulation"
                    >
                      {pref.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(pref.id)}
                      disabled={deleteMutation.isPending}
                      className="min-h-[44px] touch-manipulation border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
              No notification preferences configured yet
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Create rules to control how and when you receive alerts
            </p>
            <Button 
              className="mt-4 min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90" 
              onClick={() => setShowCreateModal(true)}
            >
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 max-w-md w-full mx-auto my-auto max-h-[90vh] overflow-y-auto shadow-2xl text-gray-900 dark:text-gray-100">
            <h2 className="text-2xl font-bold mb-4">
              Create Notification Rule
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Channel</label>
                <select
                  value={formData.channel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      channel: e.target.value as "sms" | "email" | "push" | "webhook",
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push Notification</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Severity (Optional)</label>
                <select
                  value={formData.severity || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      severity: e.target.value
                        ? (e.target.value as "advisory" | "warning" | "critical")
                        : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                >
                  <option value="">All Severities</option>
                  <option value="advisory">Advisory</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Sites (Optional)</label>
                <div className="max-h-32 overflow-y-auto border rounded p-2">
                  {sites && sites.length > 0 ? (
                    sites.map((site: { id: string; name: string }) => (
                      <label key={site.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.siteIds.includes(site.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                siteIds: [...formData.siteIds, site.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                siteIds: formData.siteIds.filter((id) => id !== site.id),
                              });
                            }
                          }}
                          className="rounded w-5 h-5 touch-manipulation"
                        />
                        <span className="text-sm">{site.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No sites available</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex-1 min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
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
