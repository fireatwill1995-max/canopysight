"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { SiteCardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";

export default function SitesPage() {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const canQuery = useCanUseProtectedTrpc();
  
  const { data: sites, isLoading, error, refetch } = trpc.site.list.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
  });
  const createMutation = trpc.site.create.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Site created",
        description: "The site has been successfully added",
      });
      refetch();
      setShowCreateModal(false);
      setFormData({
        name: "",
        description: "",
        address: "",
        latitude: 0,
        longitude: 0,
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to create site",
        description: error.message || "An error occurred",
      });
    },
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    latitude: 0,
    longitude: 0,
  });

  const handleCreate = () => {
    if (!formData.name?.trim()) {
      addToast({
        type: "warning",
        title: "Missing required field",
        description: "Please enter a site name",
      });
      return;
    }
    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      addToast({
        type: "warning",
        title: "Invalid latitude",
        description: "Latitude must be between -90 and 90 (decimal degrees)",
      });
      return;
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      addToast({
        type: "warning",
        title: "Invalid longitude",
        description: "Longitude must be between -180 and 180 (decimal degrees)",
      });
      return;
    }
    createMutation.mutate({ ...formData, latitude: lat, longitude: lng });
  };

  // Filter sites
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    
    if (!searchQuery.trim()) return sites;
    
    const query = searchQuery.toLowerCase();
    return sites.filter(
      (site: { name: string; description?: string | null; address?: string | null }) =>
        site.name.toLowerCase().includes(query) ||
        site.description?.toLowerCase().includes(query) ||
        site.address?.toLowerCase().includes(query)
    );
  }, [sites, searchQuery]);

  return (
    <main className="canopy-page">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-2">
              Sites
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage monitoring locations and configurations</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)} 
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 shadow-md min-h-[44px] touch-manipulation"
          >
            + Add Site
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sites by name, description, or address..."
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
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <SiteCardSkeleton count={6} />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">Error loading sites: {error.message}</p>
        </div>
      ) : filteredSites.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredSites.map((site: { id: string; name: string; description?: string | null; address?: string | null; latitude?: number; longitude?: number }) => (
            <Card key={site.id} className="card-gradient card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <Link href={`/sites/${site.id}`} className="text-primary hover:underline">
                    {site.name}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2">{site.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <span>📍</span>
                    {site.address || `${site.latitude}, ${site.longitude}`}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <Link href={`/sites/${site.id}`}>
                      <Button variant="outline" size="sm" className="min-h-[32px] touch-manipulation">
                        View Details →
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">📍</div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
              {searchQuery ? "No sites match your search" : "No sites configured yet"}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery ? "Try a different search term" : "Get started by adding your first monitoring site"}
            </p>
            {!searchQuery && (
              <Button 
                onClick={() => setShowCreateModal(true)} 
                className="min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90"
              >
                + Add Your First Site
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Site Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-strong p-4 sm:p-6 max-w-md w-full mx-auto my-auto max-h-[90vh] overflow-y-auto border-border">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Create New Site</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="Site name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Site description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  placeholder="Physical address"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={formData.latitude === 0 ? "" : formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    placeholder="e.g. -33.8688"
                    title="Decimal degrees, -90 to 90"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={formData.longitude === 0 ? "" : formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    placeholder="e.g. 151.2093"
                    title="Decimal degrees, -180 to 180"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex-1 min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90"
              >
                {createMutation.isPending ? "Creating..." : "Create Site"}
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
