"use client";

import { useState } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { motion, AnimatePresence } from "framer-motion";

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
}

export function LiveAlertFeed({
  siteIdFilter,
  deviceIdFilter: _deviceIdFilter,
  onAlertFocus,
}: LiveAlertFeedProps = {}) {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);

  const { connected } = useWebSocket({
    onAlert: (alert: LiveAlert) => {
      if (siteIdFilter && alert.siteId !== siteIdFilter) return;
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      onAlertFocus?.(alert);
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-100 border-red-500 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300";
      case "warning":  return "bg-orange-100 border-orange-500 text-orange-800 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-300";
      case "advisory": return "bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-950/40 dark:border-yellow-700 dark:text-yellow-300";
      default:         return "bg-muted border-border text-foreground";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return "🔴";
      case "warning":  return "🟠";
      case "advisory": return "🟡";
      default:         return "ℹ️";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live Alerts
          {connected && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Live" />}
        </CardTitle>
        <CardDescription>
          Real-time alerts from AI detection
          {connected ? (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">● Connected</span>
          ) : (
            <span className="ml-2 text-muted-foreground text-xs">● Connecting…</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                No alerts yet — system is monitoring
              </p>
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
