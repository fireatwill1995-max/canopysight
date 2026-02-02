"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { AlertCardSkeleton } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";
import { isSimulationMode, getMockIncidents, SIM_DEMO_SITE_ID } from "@/lib/simulation";

interface IncidentEntry {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  reportedAt: Date | string;
  resolvedAt: Date | string | null;
  siteId: string;
  site: { name: string };
}

export default function IncidentsPage() {
  const { addToast } = useToast();
  const canQuery = useCanUseProtectedTrpc();
  const [simulationOn, setSimulationOn] = useState(false);
  useEffect(() => {
    setSimulationOn(isSimulationMode());
  }, []);

  const { data: apiData, isLoading, error, refetch } = trpc.incident.list.useQuery(
    { limit: 100 },
    { enabled: canQuery && !simulationOn, retry: false }
  );
  const data = simulationOn ? getMockIncidents(100) : apiData;

  const resolveMutation = trpc.incident.resolve.useMutation({
    onSuccess: () => {
      addToast({
        type: "success",
        title: "Incident resolved",
        description: "The incident has been marked as resolved",
      });
      refetch();
    },
    onError: (err) => {
      addToast({
        type: "error",
        title: "Failed to resolve incident",
        description: err.message || "An error occurred",
      });
    },
  });

  const incidents = useMemo(() => data?.items ?? [], [data?.items]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      case "low":
        return "🔵";
      default:
        return "ℹ️";
    }
  };

  const handleResolve = (id: string) => {
    if (simulationOn) return;
    resolveMutation.mutate({ id });
  };

  return (
    <main className="canopy-page">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground flex items-center gap-2">
              Incidents
              {simulationOn && (
                <span className="text-sm font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Simulation
                </span>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manual incident reports and safety logs
            </p>
          </div>
        </div>
      </div>

      {!simulationOn && isLoading ? (
        <div className="space-y-4">
          <AlertCardSkeleton count={3} />
        </div>
      ) : !simulationOn && error ? (
        <Card>
          <CardContent className="p-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">Error loading incidents: {error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : incidents.length > 0 ? (
        <div className="space-y-4">
          {(incidents as IncidentEntry[]).map((incident) => (
            <Card key={incident.id} className="card-hover">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-xl">{getSeverityIcon(incident.severity)}</span>
                      {incident.title}
                    </CardTitle>
                    <CardDescription className="mt-2">{incident.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!incident.resolvedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolve(incident.id)}
                        disabled={resolveMutation.isPending}
                        className="border-green-200 text-green-700 hover:bg-green-50 min-h-[36px] touch-manipulation"
                      >
                        {resolveMutation.isPending ? "Resolving..." : "Resolve"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Site:</span>
                    <p className="font-medium break-words">
                      <Link
                        href={incident.siteId === SIM_DEMO_SITE_ID ? "/sites" : `/sites/${incident.siteId}`}
                        className="text-primary hover:underline"
                      >
                        {incident.site.name}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Severity:</span>
                    <p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(
                          incident.severity
                        )}`}
                      >
                        {incident.severity}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Reported:</span>
                    <p className="font-medium break-words">
                      {new Date(incident.reportedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className="font-medium">
                      {incident.resolvedAt ? (
                        <span className="text-green-600">✅ Resolved</span>
                      ) : (
                        <span className="text-orange-600">⚠️ Active</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-lg font-medium text-foreground mb-1">
              No incidents found
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Incidents will appear here when reported.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
