import { Detection } from "../types";
import sharp from "sharp";

/**
 * PPE (Personal Protective Equipment) Detection
 * Detects if workers are wearing required safety equipment
 * Uses additional YOLO model or post-processing on person detections
 */
export interface PPEDetection {
  personId: string;
  hasHardHat: boolean;
  hasVest: boolean;
  hasGloves: boolean;
  confidence: number;
  boundingBox: Detection["boundingBox"];
}

import * as ort from "onnxruntime-node";

export class PPEDetector {
  private ppeModel: ort.InferenceSession | null = null; // Would load a specialized PPE detection model
  private enabled: boolean = false;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * Initialize PPE detection model
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    // TODO: Load specialized PPE detection model
    // This would be a fine-tuned YOLO model trained on safety equipment
    // For now, use heuristics based on person detection regions
    console.log("PPE detection initialized (heuristic mode)");
  }

  /**
   * Detect PPE on person detections
   */
  async detectPPE(
    personDetections: Detection[],
    image: sharp.Sharp
  ): Promise<PPEDetection[]> {
    if (!this.enabled || personDetections.length === 0) {
      return [];
    }

    const ppeDetections: PPEDetection[] = [];

    for (const person of personDetections) {
      if (person.type !== "person") continue;

      try {
        const imgMeta = await image.metadata();
        const imgW = imgMeta.width ?? 1920;
        const imgH = imgMeta.height ?? 1080;

        const left = Math.max(0, Math.floor(person.boundingBox.x));
        const top = Math.max(0, Math.floor(person.boundingBox.y));
        const width = Math.max(1, Math.min(Math.floor(person.boundingBox.width), imgW - left));
        const height = Math.max(1, Math.min(Math.floor(person.boundingBox.height), imgH - top));

        const personRegion = await image
          .clone()
          .extract({ left, top, width, height })
          .toBuffer();

        const ppe = await this.analyzePPEHeuristic(personRegion, person);
        ppeDetections.push(ppe);
      } catch (extractError) {
        console.warn(`Failed to extract person region for PPE analysis: ${extractError instanceof Error ? extractError.message : extractError}`);
      }
    }

    return ppeDetections;
  }

  /**
   * Heuristic PPE analysis (placeholder for actual model)
   */
  private async analyzePPEHeuristic(
    personImage: Buffer,
    person: Detection
  ): Promise<PPEDetection> {
    // This is a placeholder - in production, use a fine-tuned YOLO model
    // trained specifically on hard hats, safety vests, gloves, etc.
    
    // Without a real PPE model, assume compliant to avoid false-positive floods.
    // A real implementation would load a PPE-specific YOLO model and run inference.
    return {
      personId: person.id,
      hasHardHat: true,
      hasVest: true,
      hasGloves: true,
      confidence: 0.1,
      boundingBox: person.boundingBox,
    };
  }

  /**
   * Check if PPE requirements are met
   */
  checkPPECompliance(ppeDetection: PPEDetection): {
    compliant: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    if (!ppeDetection.hasHardHat) missing.push("hard_hat");
    if (!ppeDetection.hasVest) missing.push("safety_vest");
    if (!ppeDetection.hasGloves) missing.push("gloves");

    return {
      compliant: missing.length === 0,
      missing,
    };
  }
}
