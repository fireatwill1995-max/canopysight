import { describe, it, expect } from "vitest";
import {
  RATE_LIMITS,
  CACHE_TTL,
  JOB_RETRY,
  DETECTION_CONFIDENCE,
} from "../constants";

describe("RATE_LIMITS", () => {
  it("has expected keys", () => {
    expect(RATE_LIMITS).toHaveProperty("API_DEFAULT");
    expect(RATE_LIMITS).toHaveProperty("AI_INFERENCE");
    expect(RATE_LIMITS).toHaveProperty("REPORT_GENERATION");
    expect(RATE_LIMITS).toHaveProperty("AUTH");
  });

  it("each entry has positive maxRequests and windowMs", () => {
    for (const [key, value] of Object.entries(RATE_LIMITS)) {
      expect(value.maxRequests, `${key}.maxRequests`).toBeGreaterThan(0);
      expect(value.windowMs, `${key}.windowMs`).toBeGreaterThan(0);
    }
  });
});

describe("CACHE_TTL", () => {
  it("has expected keys", () => {
    expect(CACHE_TTL).toHaveProperty("DASHBOARD_STATS");
    expect(CACHE_TTL).toHaveProperty("DEVICE_LIST");
    expect(CACHE_TTL).toHaveProperty("ANALYTICS");
    expect(CACHE_TTL).toHaveProperty("SITE_CONFIG");
    expect(CACHE_TTL).toHaveProperty("USER_SESSION");
    expect(CACHE_TTL).toHaveProperty("REPORT");
  });

  it("all values are positive numbers (seconds)", () => {
    for (const [key, value] of Object.entries(CACHE_TTL)) {
      expect(value, `${key}`).toBeGreaterThan(0);
      expect(typeof value).toBe("number");
    }
  });

  it("values are in ascending order by intended duration", () => {
    expect(CACHE_TTL.DASHBOARD_STATS).toBeLessThan(CACHE_TTL.DEVICE_LIST);
    expect(CACHE_TTL.DEVICE_LIST).toBeLessThan(CACHE_TTL.ANALYTICS);
    expect(CACHE_TTL.ANALYTICS).toBeLessThan(CACHE_TTL.SITE_CONFIG);
    expect(CACHE_TTL.SITE_CONFIG).toBeLessThan(CACHE_TTL.USER_SESSION);
    expect(CACHE_TTL.USER_SESSION).toBeLessThan(CACHE_TTL.REPORT);
  });
});

describe("JOB_RETRY", () => {
  it("has expected keys", () => {
    expect(JOB_RETRY).toHaveProperty("AI_INFERENCE");
    expect(JOB_RETRY).toHaveProperty("IMAGE_PROCESSING");
    expect(JOB_RETRY).toHaveProperty("REPORT_GENERATION");
    expect(JOB_RETRY).toHaveProperty("NOTIFICATIONS");
  });

  it("each entry has attempts and backoff configuration", () => {
    for (const [key, value] of Object.entries(JOB_RETRY)) {
      expect(value.attempts, `${key}.attempts`).toBeGreaterThan(0);
      expect(value.backoff, `${key}.backoff`).toBeDefined();
      expect(value.backoff.type, `${key}.backoff.type`).toMatch(
        /^(exponential|fixed)$/,
      );
      expect(value.backoff.delay, `${key}.backoff.delay`).toBeGreaterThan(0);
    }
  });
});

describe("DETECTION_CONFIDENCE", () => {
  it("has expected threshold keys", () => {
    expect(DETECTION_CONFIDENCE).toHaveProperty("MINIMUM");
    expect(DETECTION_CONFIDENCE).toHaveProperty("LOW");
    expect(DETECTION_CONFIDENCE).toHaveProperty("MEDIUM");
    expect(DETECTION_CONFIDENCE).toHaveProperty("HIGH");
    expect(DETECTION_CONFIDENCE).toHaveProperty("CRITICAL");
  });

  it("all thresholds are in 0-1 range", () => {
    for (const [key, value] of Object.entries(DETECTION_CONFIDENCE)) {
      expect(value, `${key}`).toBeGreaterThanOrEqual(0);
      expect(value, `${key}`).toBeLessThanOrEqual(1);
    }
  });

  it("HIGH > MEDIUM > LOW", () => {
    expect(DETECTION_CONFIDENCE.HIGH).toBeGreaterThan(
      DETECTION_CONFIDENCE.MEDIUM,
    );
    expect(DETECTION_CONFIDENCE.MEDIUM).toBeGreaterThan(
      DETECTION_CONFIDENCE.LOW,
    );
  });

  it("CRITICAL > HIGH > MEDIUM > LOW > MINIMUM", () => {
    expect(DETECTION_CONFIDENCE.CRITICAL).toBeGreaterThan(
      DETECTION_CONFIDENCE.HIGH,
    );
    expect(DETECTION_CONFIDENCE.HIGH).toBeGreaterThan(
      DETECTION_CONFIDENCE.MEDIUM,
    );
    expect(DETECTION_CONFIDENCE.MEDIUM).toBeGreaterThan(
      DETECTION_CONFIDENCE.LOW,
    );
    expect(DETECTION_CONFIDENCE.LOW).toBeGreaterThan(
      DETECTION_CONFIDENCE.MINIMUM,
    );
  });
});
