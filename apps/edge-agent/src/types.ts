// ─── Detection object classes ────────────────────────────────────────────────
// Must match configs/classes.yaml → detection_classes in ml-training package.

export type DetectionType =
  // Humans
  | "person"
  | "person_group"
  // Vehicles
  | "vehicle_4wd"
  | "vehicle_truck"
  | "vehicle_motorbike"
  | "vehicle_boat"
  // ── African mega-fauna ────────────────────────────────────────────────────
  | "elephant"
  | "lion"
  | "leopard"
  | "rhinoceros"
  | "buffalo"
  | "zebra"
  | "giraffe"
  | "hippopotamus"
  | "crocodile"
  | "cheetah"
  | "wild_dog"     // African wild dog — Endangered
  | "hyena"
  | "pangolin"     // Critically trafficked
  | "primate"      // Baboon, vervet, chimp
  // ── Other wildlife ────────────────────────────────────────────────────────
  | "bird"
  | "reptile"
  // ── Threats / contraband ─────────────────────────────────────────────────
  | "drone"
  | "weapon"
  | "snare"
  | "trap"
  // ── Legacy / catch-all ───────────────────────────────────────────────────
  | "vehicle"      // Generic vehicle (pre-fine-tune fallback)
  | "animal"       // Generic animal (pre-fine-tune fallback)
  | "equipment"
  | "debris"
  | "unknown";

// ── Behavior flags ───────────────────────────────────────────────────────────
// Produced by the behavior analyzer — overlaid on tracked person detections.
export type BehaviorFlag =
  | "walking"
  | "running"
  | "crouching"
  | "stationary"
  | "climbing"
  | "carrying"
  | "crawling"
  | "fighting"
  | "unknown";

// ── Conservation priority tier ───────────────────────────────────────────────
export type ConservationTier = "critical" | "high" | "medium" | "low" | "none";

export const CONSERVATION_TIER: Record<string, ConservationTier> = {
  rhinoceros: "critical",
  pangolin:   "critical",
  wild_dog:   "critical",
  cheetah:    "critical",
  elephant:   "high",
  leopard:    "high",
  lion:       "high",
  hippopotamus: "high",
  crocodile:  "high",
  buffalo:    "medium",
  zebra:      "medium",
  giraffe:    "medium",
  hyena:      "medium",
  primate:    "medium",
  bird:       "low",
  reptile:    "low",
};

// ── Threat type classification ────────────────────────────────────────────────
export type ThreatCategory =
  | "human_intrusion"   // person in exclusion zone
  | "poaching_risk"     // weapon / snare / trap detected
  | "vehicle_intrusion" // vehicle where none should be
  | "drone_intrusion"   // unauthorized UAV
  | "wildlife_approach" // wildlife near perimeter
  | "suspicious_behavior" // behavior classifier flag
  | "none";

// ─── Core types ──────────────────────────────────────────────────────────────

export interface BoundingBox {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface Detection {
  id:           string;
  type:         DetectionType;
  confidence:   number;
  boundingBox:  BoundingBox;
  trackId?:     number;
  timestamp:    Date;
  // Enriched by behavior analyzer (persons only)
  behavior?:    BehaviorFlag;
  behaviorConf?: number;
}

export interface TrackedObject {
  id:           number;
  type:         DetectionType;
  boundingBox:  BoundingBox;
  confidence:   number;
  velocity?:    { x: number; y: number };
  speed:        number;   // pixels/frame
  dwellTime:    number;   // seconds
  firstSeen:    Date;
  lastSeen:     Date;
  behavior?:    BehaviorFlag;
  behaviorConf?: number;
}

export interface ZoneBreach {
  zoneId:     string;
  objectId:   number;
  timestamp:  Date;
  entryPoint: { x: number; y: number };
}

export interface RiskScore {
  overall:          number; // 0-100
  speedFactor:      number;
  directionFactor:  number;
  dwellTimeFactor:  number;
  zoneFactor:       number;
  timeOfDayFactor:  number;
  behaviorFactor:   number; // NEW — contribution from behavior classifier
  threatFactor:     number; // NEW — weapon/snare/trap/drone detected
}

export interface SuspiciousActivityEvent {
  type:         ThreatCategory;
  description:  string;
  severity:     "advisory" | "warning" | "critical";
  detectionIds: string[];
  timestamp:    Date;
}

export interface DetectionEvent {
  id:             string;
  deviceId:       string;
  siteId:         string;
  type:           DetectionType;
  confidence:     number;
  timestamp:      Date;
  boundingBox:    BoundingBox;
  zoneIds:        string[];
  riskScore:      RiskScore;
  videoClipPath?: string;
  metadata:       Record<string, unknown>;
  // Behavior enrichment
  behavior?:      BehaviorFlag;
  behaviorConf?:  number;
  // Conservation context
  conservationTier?: ConservationTier;
  // Threat context
  threatCategory?:   ThreatCategory;
  // Legacy fields
  loiteringEvent?: {
    duration: number;
    severity: "low" | "medium" | "high" | "critical";
  };
  ppeCompliance?: {
    compliant: boolean;
    missing:   string[];
  };
}
