// ── API Rate Limits ──────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** General API requests per minute */
  API_DEFAULT: { maxRequests: 60, windowMs: 60_000 },
  /** AI inference requests per minute */
  AI_INFERENCE: { maxRequests: 20, windowMs: 60_000 },
  /** Report generation requests per hour */
  REPORT_GENERATION: { maxRequests: 10, windowMs: 3_600_000 },
  /** Auth attempts per 15 minutes */
  AUTH: { maxRequests: 10, windowMs: 900_000 },
} as const;

// ── Cache TTL (seconds) ──────────────────────────────────────────────────────

export const CACHE_TTL = {
  /** Dashboard stats: 30 seconds */
  DASHBOARD_STATS: 30,
  /** Device list: 1 minute */
  DEVICE_LIST: 60,
  /** Analytics query results: 5 minutes */
  ANALYTICS: 300,
  /** Site configuration: 10 minutes */
  SITE_CONFIG: 600,
  /** User session data: 1 hour */
  USER_SESSION: 3_600,
  /** Report results: 1 day */
  REPORT: 86_400,
} as const;

// ── Job Retry Configurations ─────────────────────────────────────────────────

export const JOB_RETRY = {
  AI_INFERENCE: { attempts: 3, backoff: { type: "exponential" as const, delay: 2_000 } },
  IMAGE_PROCESSING: { attempts: 3, backoff: { type: "exponential" as const, delay: 5_000 } },
  REPORT_GENERATION: { attempts: 2, backoff: { type: "fixed" as const, delay: 10_000 } },
  NOTIFICATIONS: { attempts: 5, backoff: { type: "exponential" as const, delay: 1_000 } },
} as const;

// ── Detection Confidence Thresholds ──────────────────────────────────────────

export const DETECTION_CONFIDENCE = {
  /** Below this, detection is discarded */
  MINIMUM: 0.3,
  /** Low confidence — logged but no alert */
  LOW: 0.5,
  /** Medium confidence — triggers standard alert */
  MEDIUM: 0.7,
  /** High confidence — triggers priority alert */
  HIGH: 0.85,
  /** Critical — triggers immediate escalation */
  CRITICAL: 0.95,
} as const;
