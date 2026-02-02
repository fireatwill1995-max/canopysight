export type DetectionType = "person" | "vehicle" | "animal" | "equipment" | "debris" | "unknown";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  type: DetectionType;
  confidence: number;
  boundingBox: BoundingBox;
  trackId?: number;
  timestamp: Date;
}

export interface TrackedObject {
  id: number;
  type: DetectionType;
  boundingBox: BoundingBox;
  confidence: number;
  velocity?: { x: number; y: number };
  dwellTime: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface ZoneBreach {
  zoneId: string;
  objectId: number;
  timestamp: Date;
  entryPoint: { x: number; y: number };
}

export interface RiskScore {
  overall: number; // 0-100
  speedFactor: number;
  directionFactor: number;
  dwellTimeFactor: number;
  zoneFactor: number;
  timeOfDayFactor: number;
}

export interface DetectionEvent {
  id: string;
  deviceId: string;
  siteId: string;
  type: DetectionType;
  confidence: number;
  timestamp: Date;
  boundingBox: BoundingBox;
  zoneIds: string[];
  riskScore: RiskScore;
  videoClipPath?: string;
  metadata: Record<string, unknown>;
  loiteringEvent?: {
    duration: number;
    severity: "low" | "medium" | "high" | "critical";
  };
  ppeCompliance?: {
    compliant: boolean;
    missing: string[];
  };
}
