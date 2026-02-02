"use client";

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  isSimulationMode,
  MOCK_ALERT_TEMPLATES,
  SIM_DEMO_SITE_ID,
} from "@/lib/simulation";

export interface LiveAlert {
  id: string;
  severity: "advisory" | "warning" | "critical";
  title: string;
  message: string;
  siteId: string;
  deviceId?: string;
  timestamp: Date | string;
}

interface LiveAlertFeedProps {
  siteIdFilter?: string;
  deviceIdFilter?: string;
  onAlertFocus?: (alert: LiveAlert) => void;
  /** When true, inject mock rail-safety alerts for demo (uses siteIdFilter). */
  simulationMode?: boolean;
}

export function LiveAlertFeed({
  siteIdFilter,
  deviceIdFilter,
  onAlertFocus,
  simulationMode: simulationModeProp,
}: LiveAlertFeedProps = {}) {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [simulationFromStorage, setSimulationFromStorage] = useState(false);
  useEffect(() => {
    setSimulationFromStorage(isSimulationMode());
  }, []);
  const simulationActive = simulationModeProp ?? simulationFromStorage;
  const siteForSimulation = siteIdFilter ?? SIM_DEMO_SITE_ID;
  const deviceForSimulation = deviceIdFilter;
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { connected } = useWebSocket({
    onAlert: (alert: LiveAlert) => {
      if (siteIdFilter && alert.siteId !== siteIdFilter) return;
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      onAlertFocus?.(alert);
    },
  });

  // Inject mock alerts when simulation is on (so buyers see live feed of alerts)
  useEffect(() => {
    if (!simulationActive || !siteForSimulation) return;
    const template =
      MOCK_ALERT_TEMPLATES[Math.floor(Math.random() * MOCK_ALERT_TEMPLATES.length)];
    const pushMock = () => {
      const alert: LiveAlert = {
        id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        severity: template.severity,
        title: template.title,
        message: template.message,
        siteId: siteForSimulation,
        deviceId: deviceForSimulation,
        timestamp: new Date().toISOString(),
      };
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      onAlertFocus?.(alert);
    };
    pushMock();
    mockIntervalRef.current = setInterval(pushMock, 10000 + Math.random() * 8000);
    return () => {
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
        mockIntervalRef.current = null;
      }
    };
  }, [simulationActive, siteForSimulation, deviceForSimulation, onAlertFocus]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-500 text-red-800";
      case "warning":
        return "bg-orange-100 border-orange-500 text-orange-800";
      case "advisory":
        return "bg-yellow-100 border-yellow-500 text-yellow-800";
      default:
        return "bg-gray-100 border-gray-500 text-gray-800";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟠";
      case "advisory":
        return "🟡";
      default:
        return "ℹ️";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Live Alerts
              {simulationActive && (
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Simulation
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Real-time safety alerts
              {simulationActive ? (
                <span className="ml-2 text-amber-600">● Mock alerts for demo</span>
              ) : connected ? (
                <span className="ml-2 text-green-600">● Connected</span>
              ) : (
                <span className="ml-2 text-gray-400 text-xs">● Offline (API server may not be running)</span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No alerts yet</p>
            ) : (
              alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  className={`p-3 rounded-lg border-2 ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{alert.title}</div>
                      <div className="text-sm mt-1">{alert.message}</div>
                      <div className="text-xs mt-2 opacity-75">
                        {new Date(alert.timestamp instanceof Date ? alert.timestamp : new Date(alert.timestamp)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
