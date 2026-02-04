"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { MeshTopologySkeleton } from "@canopy-sight/ui";

interface MeshTopologyViewProps {
  siteId: string;
}

interface TopologyNode {
  nodeId: string;
  deviceId: string;
  deviceName: string;
  status: string;
  ipAddress?: string | null;
  signalStrength?: number;
  latency?: number;
  throughput?: number;
  isGateway: boolean;
  neighborNodes: string[];
}

export function MeshTopologyView({ siteId }: MeshTopologyViewProps) {
  const { data: topology, isLoading, error } = trpc.meshconnect.getTopology.useQuery(
    { siteId },
    { enabled: !!siteId, refetchInterval: 10000 } // Refresh every 10 seconds
  );

  if (isLoading) {
    return <MeshTopologySkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">Error loading topology: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!topology || topology.nodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No MeshConnect nodes found for this site.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mesh Network Topology</CardTitle>
        <CardDescription>
          Visual representation of the mesh network ({topology.nodes.length} nodes,{" "}
          {topology.edges.length} connections)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Simple node list view - could be enhanced with a graph visualization library */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topology.nodes.map((node: TopologyNode) => (
              <div
                key={node.nodeId}
                className={`p-4 border-2 rounded-lg ${
                  node.status === "connected"
                    ? "border-green-500 bg-green-50"
                    : node.status === "error"
                    ? "border-red-500 bg-red-50"
                    : "border-yellow-500 bg-yellow-50"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{node.deviceName}</h4>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      node.status === "connected"
                        ? "bg-green-200 text-green-800"
                        : node.status === "error"
                        ? "bg-red-200 text-red-800"
                        : "bg-yellow-200 text-yellow-800"
                    }`}
                  >
                    {node.status}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-600">Node ID:</span>{" "}
                    <span className="font-mono text-xs">{node.nodeId}</span>
                  </div>
                  {node.ipAddress && (
                    <div>
                      <span className="text-gray-600">IP:</span>{" "}
                      <span className="font-mono text-xs">{node.ipAddress}</span>
                    </div>
                  )}
                  {node.signalStrength && (
                    <div>
                      <span className="text-gray-600">Signal:</span>{" "}
                      <span className="font-medium">{node.signalStrength} dBm</span>
                    </div>
                  )}
                  {node.latency && (
                    <div>
                      <span className="text-gray-600">Latency:</span>{" "}
                      <span className="font-medium">{node.latency} ms</span>
                    </div>
                  )}
                  {node.throughput && (
                    <div>
                      <span className="text-gray-600">Throughput:</span>{" "}
                      <span className="font-medium">{node.throughput} Mbps</span>
                    </div>
                  )}
                  {node.isGateway && (
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs font-medium">
                        Gateway
                      </span>
                    </div>
                  )}
                  {node.neighborNodes && node.neighborNodes.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-gray-600 text-xs mb-1">Neighbors:</div>
                      <div className="flex flex-wrap gap-1">
                        {node.neighborNodes.map((neighbor: string) => (
                          <span
                            key={neighbor}
                            className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono"
                          >
                            {neighbor.substring(0, 8)}...
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Connection edges visualization */}
          {topology.edges.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-3">Network Connections</h4>
              <div className="space-y-2">
                {topology.edges.map((edge: { from: string; to: string; signalStrength?: number; latency?: number }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-900 dark:text-gray-100"
                  >
                    <span className="font-mono text-xs">{edge.from.substring(0, 8)}</span>
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                    <span className="font-mono text-xs">{edge.to.substring(0, 8)}</span>
                    {edge.signalStrength && (
                      <span className="ml-auto text-gray-600 dark:text-gray-300">
                        {edge.signalStrength} dBm
                      </span>
                    )}
                    {edge.latency && (
                      <span className="text-gray-600 dark:text-gray-300">{edge.latency} ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
