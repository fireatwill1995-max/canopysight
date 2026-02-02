"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { useState, useEffect } from "react";

interface FilterPanelProps {
  onFilterChange?: (filters: {
    types?: string[];
    minRiskScore?: number;
    maxRiskScore?: number;
    minConfidence?: number;
    maxConfidence?: number;
    zones?: string[];
    startDate?: Date;
    endDate?: Date;
  }) => void;
  sites?: Array<{ id: string; name: string }>;
  devices?: Array<{ id: string; name: string; siteId?: string }>;
  filters?: {
    siteId?: string;
    deviceId?: string;
    types?: string[];
    minRiskScore?: number;
    maxRiskScore?: number;
    minConfidence?: number;
    maxConfidence?: number;
    zones?: string[];
    startDate?: Date;
    endDate?: Date;
  };
  onFiltersChange?: (filters: {
    siteId?: string;
    deviceId?: string;
    types?: string[];
    minRiskScore?: number;
    maxRiskScore?: number;
    minConfidence?: number;
    maxConfidence?: number;
    zones?: string[];
    startDate?: Date;
    endDate?: Date;
  }) => void;
  availableZones?: Array<{ id: string; name: string }>;
}

export function FilterPanel({ 
  onFilterChange, 
  sites = [],
  devices = [],
  filters,
  onFiltersChange,
  availableZones = [] 
}: FilterPanelProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(filters?.siteId);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(filters?.deviceId);
  const [types, setTypes] = useState<string[]>(filters?.types || []);
  const [minRiskScore, setMinRiskScore] = useState<number | undefined>(filters?.minRiskScore);
  const [maxRiskScore, setMaxRiskScore] = useState<number | undefined>(filters?.maxRiskScore);
  const [minConfidence, setMinConfidence] = useState<number | undefined>(filters?.minConfidence);
  const [maxConfidence, setMaxConfidence] = useState<number | undefined>(filters?.maxConfidence);
  const [selectedZones, setSelectedZones] = useState<string[]>(filters?.zones || []);
  const [startDate, setStartDate] = useState(
    filters?.startDate 
      ? filters.startDate.toISOString().split("T")[0]
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    filters?.endDate 
      ? filters.endDate.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    advanced: false,
  });

  useEffect(() => {
    if (filters) {
      setSelectedSiteId(filters.siteId);
      setSelectedDeviceId(filters.deviceId);
      setTypes(filters.types || []);
      setMinRiskScore(filters.minRiskScore);
      setMaxRiskScore(filters.maxRiskScore);
      setMinConfidence(filters.minConfidence);
      setMaxConfidence(filters.maxConfidence);
      setSelectedZones(filters.zones || []);
      if (filters.startDate) {
        setStartDate(filters.startDate.toISOString().split("T")[0]);
      }
      if (filters.endDate) {
        setEndDate(filters.endDate.toISOString().split("T")[0]);
      }
    }
  }, [filters]);

  // Filter devices by selected site
  const filteredDevices = selectedSiteId
    ? devices.filter((d) => d.siteId === selectedSiteId)
    : devices;

  const handleApply = () => {
    const newFilters = {
      siteId: selectedSiteId,
      deviceId: selectedDeviceId,
      types: types.length > 0 ? types : undefined,
      minRiskScore,
      maxRiskScore,
      minConfidence,
      maxConfidence,
      zones: selectedZones.length > 0 ? selectedZones : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    } else if (onFilterChange) {
      onFilterChange({
        types: newFilters.types,
        minRiskScore: newFilters.minRiskScore,
        maxRiskScore: newFilters.maxRiskScore,
        minConfidence: newFilters.minConfidence,
        maxConfidence: newFilters.maxConfidence,
        zones: newFilters.zones,
        startDate: newFilters.startDate,
        endDate: newFilters.endDate,
      });
    }
  };

  const handleReset = () => {
    setSelectedSiteId(undefined);
    setSelectedDeviceId(undefined);
    setTypes([]);
    setMinRiskScore(undefined);
    setMaxRiskScore(undefined);
    setMinConfidence(undefined);
    setMaxConfidence(undefined);
    setSelectedZones([]);
    setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setEndDate(new Date().toISOString().split("T")[0]);
    
    if (onFiltersChange) {
      onFiltersChange({
        siteId: undefined,
        deviceId: undefined,
        types: [],
        minRiskScore: undefined,
        maxRiskScore: undefined,
        minConfidence: undefined,
        maxConfidence: undefined,
        zones: [],
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });
    } else if (onFilterChange) {
      onFilterChange({});
    }
  };

  const applyDatePreset = (preset: "today" | "7days" | "30days" | "90days" | "year") => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    let start: string;

    switch (preset) {
      case "today":
        start = end;
        break;
      case "7days":
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "30days":
        start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "90days":
        start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "year":
        start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
    }

    setStartDate(start);
    setEndDate(end);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleType = (type: string) => {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((z) => z !== zoneId) : [...prev, zoneId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Refine your search</CardDescription>
          </div>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="min-h-[32px] touch-manipulation"
          >
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Filters Section */}
        <div>
          <button
            onClick={() => toggleSection("basic")}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="font-medium text-sm">Basic Filters</span>
            <span>{expandedSections.basic ? "−" : "+"}</span>
          </button>
          {expandedSections.basic && (
            <div className="space-y-4 pl-2 border-l-2 border-gray-200">
              {sites.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Site</label>
                  <select
                    value={selectedSiteId || ""}
                    onChange={(e) => {
                      setSelectedSiteId(e.target.value || undefined);
                      setSelectedDeviceId(undefined); // Reset device when site changes
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                  >
                    <option value="">All Sites</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {devices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Device</label>
                  <select
                    value={selectedDeviceId || ""}
                    onChange={(e) => setSelectedDeviceId(e.target.value || undefined)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    disabled={!selectedSiteId && sites.length > 0}
                  >
                    <option value="">All Devices</option>
                    {filteredDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Detection Types</label>
                <div className="flex flex-wrap gap-2">
                  {["person", "vehicle", "animal", "unknown"].map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors touch-manipulation min-h-[36px] ${
                        types.includes(type)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset("today")}
                    className="text-xs min-h-[32px] touch-manipulation"
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset("7days")}
                    className="text-xs min-h-[32px] touch-manipulation"
                  >
                    7 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset("30days")}
                    className="text-xs min-h-[32px] touch-manipulation"
                  >
                    30 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset("90days")}
                    className="text-xs min-h-[32px] touch-manipulation"
                  >
                    90 Days
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Filters Section */}
        <div>
          <button
            onClick={() => toggleSection("advanced")}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="font-medium text-sm">Advanced Filters</span>
            <span>{expandedSections.advanced ? "−" : "+"}</span>
          </button>
          {expandedSections.advanced && (
            <div className="space-y-4 pl-2 border-l-2 border-gray-200">
              <div>
                <label className="block text-sm font-medium mb-2">Risk Score Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={minRiskScore || ""}
                      onChange={(e) => setMinRiskScore(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={maxRiskScore || ""}
                      onChange={(e) => setMaxRiskScore(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="100"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confidence Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min (0-1)</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={minConfidence !== undefined ? minConfidence : ""}
                      onChange={(e) => setMinConfidence(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="0.0"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max (0-1)</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={maxConfidence !== undefined ? maxConfidence : ""}
                      onChange={(e) => setMaxConfidence(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="1.0"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              {availableZones.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Zones</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {availableZones.map((zone) => (
                      <label key={zone.id} className="flex items-center gap-2 cursor-pointer touch-manipulation">
                        <input
                          type="checkbox"
                          checked={selectedZones.includes(zone.id)}
                          onChange={() => toggleZone(zone.id)}
                          className="rounded w-5 h-5"
                        />
                        <span className="text-sm">{zone.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 border-t">
          <Button onClick={handleApply} className="w-full min-h-[44px] touch-manipulation bg-primary text-primary-foreground hover:opacity-90">
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
