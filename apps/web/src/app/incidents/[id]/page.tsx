"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import { useToast } from "@canopy-sight/ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCanUseProtectedTrpc } from "@/lib/can-use-protected-trpc";

export default function IncidentReconstructionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const canQuery = useCanUseProtectedTrpc();

  const { data, isLoading, error } = trpc.incident.reconstruction.useQuery(
    { id, windowMinutes: 30 },
    { enabled: canQuery && !!id, retry: false }
  );

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

  if (!canQuery || !id) {
    return (
      <main className="canopy-page">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>Sign in or select an incident to view reconstruction.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/incidents")}>
              Back to Incidents
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="canopy-page">
        <Card>
          <CardContent className="p-8 text-center">Loading incident reconstruction…</CardContent>
        </Card>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="canopy-page">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-600">{error?.message ?? "Incident not found"}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/incidents")}>
              Back to Incidents
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { incident, timeline, contributingConditions, windowStart, windowEnd } = data;
  const reportedAt = new Date(incident.reportedAt);

  return (
    <main className="canopy-page">
      <div className="mb-6">
        <Link
          href="/incidents"
          className="text-sm text-primary hover:underline mb-2 inline-block"
        >
          ← Back to Incidents
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Incident reconstruction & learning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visual timeline, environmental context, and contributing conditions
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{incident.title}</CardTitle>
            <CardDescription>{incident.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Site</span>
                <p className="font-medium">
                  <Link href={`/sites/${incident.siteId}`} className="text-primary hover:underline">
                    {(incident.site as { name?: string })?.name ?? incident.siteId}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Severity</span>
                <p>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
                    {incident.severity}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Reported</span>
                <p className="font-medium">{reportedAt.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium">
                  {incident.resolvedAt ? "✅ Resolved" : "⚠️ Active"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {contributingConditions && (
          <Card>
            <CardHeader>
              <CardTitle>Contributing conditions</CardTitle>
              <CardDescription>
                Environmental context: crowding, layout, timing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {contributingConditions.crowding != null && (
                  <li>
                    <strong>Crowding:</strong>{" "}
                    {contributingConditions.crowding ? "Yes" : "No"}
                    {contributingConditions.crowdingLevel != null && ` (level ${contributingConditions.crowdingLevel})`}
                  </li>
                )}
                {contributingConditions.zoneIds && contributingConditions.zoneIds.length > 0 && (
                  <li>
                    <strong>Zones involved:</strong> {contributingConditions.zoneIds.join(", ")}
                  </li>
                )}
                {contributingConditions.layoutNotes && (
                  <li>
                    <strong>Layout:</strong> {contributingConditions.layoutNotes}
                  </li>
                )}
                {(contributingConditions.timeOfDay != null || contributingConditions.hourOfDay != null) && (
                  <li>
                    <strong>Time:</strong>{" "}
                    {contributingConditions.timeOfDay ?? (contributingConditions.hourOfDay != null
                      ? `${contributingConditions.hourOfDay}:00`
                      : "")}
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Visual timeline</CardTitle>
            <CardDescription>
              Detection events around incident time ({windowStart.toLocaleString()} – {windowEnd.toLocaleString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No detection events in this time window
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {timeline.map((event: { id: string; type: string; timestamp: Date | string; confidence?: number; zoneIds?: string[] }) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="w-24 text-sm text-muted-foreground shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="font-medium capitalize">{event.type}</div>
                    {event.confidence != null && (
                      <div className="text-sm text-muted-foreground">
                        {Math.round(event.confidence * 100)}% confidence
                      </div>
                    )}
                    {event.zoneIds && event.zoneIds.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Zones: {event.zoneIds.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
