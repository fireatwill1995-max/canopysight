import { Detection, ZoneBreach } from "../types";

export interface Zone {
  id: string;
  name: string;
  type: "crossing" | "approach" | "exclusion" | "custom";
  points: Array<{ x: number; y: number }>;
  isActive: boolean;
}

/**
 * Zone analyzer for detecting breaches
 */
export class ZoneAnalyzer {
  private zones: Zone[] = [];

  /**
   * Set zones from API configuration
   */
  setZones(zones: Zone[]): void {
    this.zones = zones.filter((z) => z.isActive && z.points && z.points.length >= 3);
  }

  /**
   * Check if a point is inside a polygon (ray casting algorithm)
   */
  private isPointInPolygon(
    point: { x: number; y: number },
    polygon: Array<{ x: number; y: number }>
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Get center point of bounding box
   */
  private getCenter(box: Detection["boundingBox"]): { x: number; y: number } {
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  }

  /**
   * Analyze detections for zone breaches
   */
  analyzeDetections(detections: Detection[]): {
    breaches: ZoneBreach[];
    zoneIds: string[];
  } {
    const breaches: ZoneBreach[] = [];
    const zoneIds: Set<string> = new Set();

    for (const detection of detections) {
      const center = this.getCenter(detection.boundingBox);

      for (const zone of this.zones) {
        if (this.isPointInPolygon(center, zone.points)) {
          zoneIds.add(zone.id);

          const objectId = detection.trackId ?? -1;
          const existingBreach = breaches.find(
            (b) => b.zoneId === zone.id && b.objectId === objectId && objectId !== -1
          );

          if (!existingBreach) {
            breaches.push({
              zoneId: zone.id,
              objectId,
              timestamp: detection.timestamp,
              entryPoint: center,
            });
          }
        }
      }
    }

    return {
      breaches,
      zoneIds: Array.from(zoneIds),
    };
  }

  /** Occupancy per zone (for clustering, congestion, pinch points) */
  getOccupancyByZone(detections: Detection[]): Map<string, number> {
    const countByZone = new Map<string, number>();
    for (const detection of detections) {
      const center = this.getCenter(detection.boundingBox);
      for (const zone of this.zones) {
        if (this.isPointInPolygon(center, zone.points)) {
          countByZone.set(zone.id, (countByZone.get(zone.id) ?? 0) + 1);
        }
      }
    }
    return countByZone;
  }

  getZones(): Zone[] {
    return this.zones;
  }
}
