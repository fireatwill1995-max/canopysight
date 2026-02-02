/**
 * Simulation / demo mode for showing potential buyers how the app works
 * without real cameras. Uses a mock camera feed (train station style) and
 * optional mock alerts so all aspects of the app can be demonstrated.
 *
 * Demo video should show: train station with people walking past and trains
 * going past on a usual busy day outdoors (platform / concourse view).
 */

/** YouTube demo video – used as primary simulation feed when set. */
export const DEMO_VIDEO_YOUTUBE_ID = "AgrYGFuW13g";

/** Extract YouTube video ID from a URL (watch, embed, shorts, or youtu.be). */
export function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const match = u.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/** Return true if the URL is a YouTube watch/embed/youtu.be URL. */
export function isYoutubeUrl(url: string): boolean {
  return !!getYoutubeVideoId(url);
}

/** Local demo video path – used when no YouTube (add public/demo-train-station.mp4). */
export const DEMO_VIDEO_LOCAL_PATH = "/demo-train-station.mp4";

/**
 * Fallback when local demo file is missing (works in HTML5).
 */
export const DEMO_VIDEO_FALLBACK_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

const SIMULATION_STORAGE_KEY = "canopy_simulation_mode";

export function isSimulationMode(): boolean {
  if (typeof window === "undefined") return false;
  // When demo mode is on, simulation is available; also respect explicit toggle
  return (
    sessionStorage.getItem(SIMULATION_STORAGE_KEY) === "true" ||
    sessionStorage.getItem("demo_mode") === "true"
  );
}

export function setSimulationMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    sessionStorage.setItem(SIMULATION_STORAGE_KEY, "true");
  } else {
    sessionStorage.removeItem(SIMULATION_STORAGE_KEY);
  }
}

/** Site ID used for mock data when no real site is in context (e.g. dashboard). */
export const SIM_DEMO_SITE_ID = "sim-demo";

/** Mock site name for sim-demo. */
export const SIM_DEMO_SITE_NAME = "Demo Train Station";

/** Mock alerts for simulation – rail safety scenarios */
export const MOCK_ALERT_TEMPLATES: Array<{
  severity: "advisory" | "warning" | "critical";
  title: string;
  message: string;
}> = [
  {
    severity: "advisory",
    title: "Person detected near platform edge",
    message: "Individual within approach zone at Platform 2. No immediate risk.",
  },
  {
    severity: "warning",
    title: "Vehicle approaching crossing",
    message: "Vehicle detected in approach zone. Crossing gates activated.",
  },
  {
    severity: "critical",
    title: "Person in exclusion zone",
    message: "Pedestrian detected in active exclusion zone. Alert sent to control.",
  },
  {
    severity: "advisory",
    title: "Crowd density increase",
    message: "Higher than usual footfall in concourse. Monitoring.",
  },
  {
    severity: "warning",
    title: "Object on track",
    message: "Foreign object detected in crossing zone. Investigation required.",
  },
  {
    severity: "advisory",
    title: "Loitering in restricted area",
    message: "Person detected in restricted area beyond platform. Advisory only.",
  },
];

/** Alerts list page shape: { items: AlertItem[] } */
export function getMockAlertsForList(limit = 100): { items: Array<{
  id: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  site: { name: string };
  createdAt: string;
}> } {
  const statuses = ["active", "active", "acknowledged", "resolved"] as const;
  const items = MOCK_ALERT_TEMPLATES.flatMap((t, i) =>
    [1, 2, 3].map((j) => ({
      id: `sim-alert-${i}-${j}`,
      severity: t.severity,
      status: statuses[(i + j) % 4],
      title: t.title,
      message: t.message,
      site: { name: SIM_DEMO_SITE_NAME },
      createdAt: new Date(Date.now() - (i * 60000 + j * 10000)).toISOString(),
    }))
  ).slice(0, limit);
  return { items };
}

/** Incidents list page shape */
export function getMockIncidents(limit = 20): { items: Array<{
  id: string;
  severity: string;
  title: string;
  description: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  siteId: string;
  site: { name: string };
}> } {
  const entries = [
    { severity: "high", title: "Unauthorized access near Platform 3", description: "Person observed in restricted area." },
    { severity: "medium", title: "Equipment left on track", description: "Tooling left after maintenance." },
    { severity: "low", title: "Lighting fault reported", description: "Flickering light at north concourse." },
    { severity: "critical", title: "Near-miss at crossing", description: "Vehicle crossed after gates lowered. No collision." },
  ];
  const items = entries.map((e, i) => ({
    id: `sim-incident-${i}`,
    severity: e.severity,
    title: e.title,
    description: e.description,
    reportedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    resolvedAt: i % 2 === 0 ? new Date(Date.now() - i * 1800000).toISOString() : null,
    siteId: SIM_DEMO_SITE_ID,
    site: { name: SIM_DEMO_SITE_NAME },
  }));
  return { items: items.slice(0, limit) };
}

/** Detections for analytics: same shape as detection.list */
export function getMockDetections(limit = 100): { items: Array<{
  id: string;
  type: string;
  timestamp: string;
  confidence: number;
  riskScore?: number;
  site?: { name: string };
  device?: { name: string };
}> } {
  const types = ["person", "vehicle", "person", "vehicle", "unknown"];
  const items = Array.from({ length: Math.min(limit, 30) }, (_, i) => ({
    id: `sim-det-${i}`,
    type: types[i % types.length],
    timestamp: new Date(Date.now() - i * 300000).toISOString(),
    confidence: 0.7 + Math.random() * 0.25,
    riskScore: Math.floor(Math.random() * 40) + 10,
    site: { name: SIM_DEMO_SITE_NAME },
    device: { name: "Platform 1 Camera" },
  }));
  return { items };
}

/** Playback events for playback page */
export function getMockPlaybackEvents(): Array<{
  id: string;
  type: string;
  confidence: number;
  timestamp: Date;
  boundingBox: { x: number; y: number; width: number; height: number };
  videoClipUrl?: string;
}> {
  return [
    { id: "sim-pb-1", type: "person", confidence: 0.92, timestamp: new Date(Date.now() - 3600000), boundingBox: { x: 100, y: 200, width: 80, height: 180 }, videoClipUrl: undefined },
    { id: "sim-pb-2", type: "vehicle", confidence: 0.88, timestamp: new Date(Date.now() - 1800000), boundingBox: { x: 300, y: 150, width: 120, height: 90 }, videoClipUrl: undefined },
    { id: "sim-pb-3", type: "person", confidence: 0.85, timestamp: new Date(Date.now() - 600000), boundingBox: { x: 200, y: 250, width: 70, height: 160 }, videoClipUrl: undefined },
  ];
}

/** Reference resolution for live-feed hazard overlay (match typical camera / demo). */
export const HAZARD_REF_WIDTH = 1920;
export const HAZARD_REF_HEIGHT = 1080;

/** Mock hazards for live feed overlay (potential hazards circled for detection demo). */
export function getMockHazardsForLiveFeed(timeSeed?: number): Array<{
  id: string;
  type: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence?: number;
  riskScore?: number;
}> {
  const t = timeSeed ?? 0;
  const drift = (i: number, axis: "x" | "y") => {
    const phase = (t / 800) + i * 1.2;
    const amp = axis === "x" ? 45 : 25;
    return Math.round(Math.sin(phase) * amp);
  };
  const base = [
    { id: "sim-h-1", type: "person", x: 420, y: 380, w: 90, h: 200, confidence: 0.91, riskScore: 35 },
    { id: "sim-h-2", type: "person", x: 1100, y: 450, w: 70, h: 180, confidence: 0.88, riskScore: 28 },
    { id: "sim-h-3", type: "vehicle", x: 700, y: 320, w: 140, h: 100, confidence: 0.85, riskScore: 42 },
    { id: "sim-h-4", type: "person", x: 1500, y: 500, w: 65, h: 170, confidence: 0.82, riskScore: 22 },
  ];
  return base.map((h, i) => {
    const x = Math.max(0, Math.min(HAZARD_REF_WIDTH - h.w, h.x + drift(i, "x")));
    const y = Math.max(0, Math.min(HAZARD_REF_HEIGHT - h.h, h.y + drift(i, "y")));
    return {
      id: h.id,
      type: h.type,
      boundingBox: { x, y, width: h.w, height: h.h },
      confidence: h.confidence,
      riskScore: h.riskScore,
    };
  });
}

/** Dashboard stat placeholders when simulation is on */
export function getMockDashboardStats(): { sites: number; devices: number; activeAlerts: number; recentEvents: number } {
  return { sites: 3, devices: 8, activeAlerts: 2, recentEvents: 24 };
}
