import { router } from "../trpc/trpc";
import { siteRouter } from "./site.router";
import { deviceRouter } from "./device.router";
import { detectionRouter } from "./detection.router";
import { alertRouter } from "./alert.router";
import { zoneRouter } from "./zone.router";
import { analyticsRouter } from "./analytics.router";
import { videoRouter } from "./video.router";
import { notificationRouter } from "./notification.router";
import { systemRouter } from "./system.router";
import { incidentRouter } from "./incident.router";
import { modelRouter } from "./model.router";
import { ingestionRouter } from "./ingestion.router";
import { meshconnectRouter } from "./meshconnect.router";

export const appRouter = router({
  site: siteRouter,
  device: deviceRouter,
  detection: detectionRouter,
  alert: alertRouter,
  zone: zoneRouter,
  analytics: analyticsRouter,
  video: videoRouter,
  notification: notificationRouter,
  system: systemRouter,
  incident: incidentRouter,
  model: modelRouter,
  ingestion: ingestionRouter,
  meshconnect: meshconnectRouter,
});

export type AppRouter = typeof appRouter;
