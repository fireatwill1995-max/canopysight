import { Detection, TrackedObject } from "../types";

/**
 * Simple SORT (Simple Online and Realtime Tracking) implementation
 * For production, consider using DeepSORT for better accuracy
 */
export class SORTTracker {
  private tracks: Map<number, TrackedObject> = new Map();
  private nextTrackId: number = 1;
  private maxAgeSeconds: number = 1; // tracks expire after 1s without match (~30 frames at 30fps)
  private iouThreshold: number = 0.3;

  /**
   * Calculate Intersection over Union (IoU) between two bounding boxes
   */
  private calculateIoU(box1: Detection["boundingBox"], box2: Detection["boundingBox"]): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;
    if (union <= 0) return 0;

    return intersection / union;
  }

  /**
   * Calculate center point of bounding box
   */
  private getCenter(box: Detection["boundingBox"]): { x: number; y: number } {
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  }

  /**
   * Update tracks with new detections
   */
  update(detections: Detection[]): Detection[] {
    const now = new Date();
    const matched: boolean[] = new Array(detections.length).fill(false);
    const trackIds: (number | undefined)[] = new Array(detections.length).fill(undefined);

    // Match detections to existing tracks
    for (const [trackId, track] of this.tracks.entries()) {
      let bestMatch = -1;
      let bestIoU = 0;

      for (let i = 0; i < detections.length; i++) {
        if (matched[i]) continue;

        const iou = this.calculateIoU(track.boundingBox, detections[i].boundingBox);
        if (iou > bestIoU && iou > this.iouThreshold) {
          bestIoU = iou;
          bestMatch = i;
        }
      }

      if (bestMatch >= 0) {
        // Update existing track
        const detection = detections[bestMatch];
        const center = this.getCenter(detection.boundingBox);
        const prevCenter = this.getCenter(track.boundingBox);

        track.boundingBox = detection.boundingBox;
        track.confidence = detection.confidence;
        track.lastSeen = now;
        track.velocity = {
          x: center.x - prevCenter.x,
          y: center.y - prevCenter.y,
        };
        track.dwellTime = (now.getTime() - track.firstSeen.getTime()) / 1000;

        matched[bestMatch] = true;
        trackIds[bestMatch] = trackId;
      }
    }

    // Create new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (!matched[i]) {
        const trackId = this.nextTrackId++;
        const detection = detections[i];

        this.tracks.set(trackId, {
          id: trackId,
          type: detection.type,
          boundingBox: detection.boundingBox,
          confidence: detection.confidence,
          firstSeen: now,
          lastSeen: now,
          dwellTime: 0,
        });

        trackIds[i] = trackId;
      }
    }

    for (const [trackId, track] of this.tracks.entries()) {
      const ageSeconds = (now.getTime() - track.lastSeen.getTime()) / 1000;
      if (ageSeconds > this.maxAgeSeconds) {
        this.tracks.delete(trackId);
      }
    }

    // Add track IDs to detections
    return detections.map((detection, i) => ({
      ...detection,
      trackId: trackIds[i],
    }));
  }

  getTracks(): TrackedObject[] {
    return Array.from(this.tracks.values());
  }

  clear(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
  }
}
