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
    this.zones = zones.filter((z) => z.isActive);
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

          // Check if this is a new breach (not already tracked)
          const existingBreach = breaches.find(
            (b) => b.zoneId === zone.id && b.objectId === detection.trackId
          );

          if (!existingBreach && detection.trackId) {
            breaches.push({
              zoneId: zone.id,
              objectId: detection.trackId,
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

  getZones(): Zone[] {
    return this.zones;
  }
}
