/**
 * Canopy Sight — Behavior Analyzer
 *
 * Runs the EfficientNet-B2 behavior classifier (ONNX) on cropped person
 * sequences produced by the SORT tracker. Enriches TrackedObject with
 * a behavior label + confidence, and updates the risk score.
 *
 * Model input:  Float32[1, T, 3, 224, 224]  (T = SEQ_LEN frames, normalized)
 * Model output: Float32[1, 8]               (logits for 8 behavior classes)
 *
 * The model is optional — if absent the analyzer is a no-op.
 */

import * as ort from "onnxruntime-node";
import * as fs  from "fs/promises";
import * as path from "path";
import sharp from "sharp";
import { BehaviorFlag, TrackedObject, Detection } from "../types";

// ── Constants ────────────────────────────────────────────────────────────────

const MODELS_DIR   = path.join(__dirname, "..", "..", "models");
const MODEL_PATH   = path.join(MODELS_DIR, "behavior_classifier.onnx");
const IMG_SIZE     = 224;
const SEQ_LEN      = 5;
const THRESHOLD    = 0.40; // minimum softmax prob to accept a behavior label

const BEHAVIORS: BehaviorFlag[] = [
  "walking",    // 0
  "running",    // 1
  "crouching",  // 2
  "stationary", // 3
  "climbing",   // 4
  "carrying",   // 5
  "crawling",   // 6
  "fighting",   // 7
];

/** Risk delta added to base risk score per behavior (mirrors Python training config). */
const BEHAVIOR_RISK_DELTA: Record<BehaviorFlag, number> = {
  walking:    0,
  running:    20,
  crouching:  35,
  stationary: 10,
  climbing:   45,
  carrying:   30,
  crawling:   40,
  fighting:   50,
  unknown:    0,
};

/** ImageNet normalisation constants (EfficientNet standard). */
const MEAN = [0.485, 0.456, 0.406];
const STD  = [0.229, 0.224, 0.225];

// ── Frame buffer ─────────────────────────────────────────────────────────────

/**
 * Ring buffer of the last SEQ_LEN raw frame crops for a tracked object.
 * Keys are track IDs.
 */
type FrameCrop = Buffer; // raw RGB bytes, IMG_SIZE × IMG_SIZE

// ── Behavior Analyzer class ──────────────────────────────────────────────────

export class BehaviorAnalyzer {
  private session:    ort.InferenceSession | null = null;
  private frameBuffer: Map<number, FrameCrop[]> = new Map();
  private ready = false;

  /** Initialize ORT session. No-op if model file absent. */
  async initialize(): Promise<void> {
    try {
      await fs.access(MODEL_PATH);
      this.session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
        enableCpuMemArena: true,
      });
      this.ready = true;
      console.log("✅ Behavior classifier loaded:", MODEL_PATH);
    } catch {
      console.warn(
        "⚠️  Behavior classifier not found — behavior analysis disabled.\n" +
        "    Train with: make train-behavior  (packages/ml-training)"
      );
    }
  }

  get isReady(): boolean { return this.ready; }

  /**
   * Crop the bounding-box region of a tracked person from the current frame,
   * add it to the ring buffer, and (when SEQ_LEN frames accumulated) run
   * classifier inference.
   *
   * @param tracked   TrackedObject to enrich (mutated in-place).
   * @param detection Corresponding Detection (provides bounding box).
   * @param frameRgb  Full camera frame as a sharp instance.
   */
  async analyzeTrackedPerson(
    tracked:   TrackedObject,
    detection: Detection,
    frameRgb:  sharp.Sharp,
  ): Promise<void> {
    if (!this.ready || !this.session) return;

    // Only run on person detections
    if (tracked.type !== "person" && tracked.type !== "person_group") return;

    try {
      // 1. Crop bounding box from frame
      const { x, y, width, height } = detection.boundingBox;
      const crop = await frameRgb
        .clone()
        .extract({
          left:   Math.max(0, Math.round(x)),
          top:    Math.max(0, Math.round(y)),
          width:  Math.max(1, Math.round(width)),
          height: Math.max(1, Math.round(height)),
        })
        .resize(IMG_SIZE, IMG_SIZE)
        .removeAlpha()
        .raw()
        .toBuffer();

      // 2. Update ring buffer
      const buf = this.frameBuffer.get(tracked.id) ?? [];
      buf.push(crop);
      if (buf.length > SEQ_LEN) buf.shift();
      this.frameBuffer.set(tracked.id, buf);

      // 3. Run inference only when we have a full sequence
      if (buf.length < SEQ_LEN) return;

      const tensor   = this.buildTensor(buf);
      const inputName = this.session.inputNames[0];
      if (!inputName) return;

      const results = await this.session.run({ [inputName]: tensor });
      const logits  = results[this.session.outputNames[0]];
      if (!logits) return;

      const { behavior, confidence } = this.argmaxSoftmax(logits.data as Float32Array);

      // 4. Enrich TrackedObject
      tracked.behavior     = behavior;
      tracked.behaviorConf = confidence;

    } catch (err) {
      // Non-fatal — skip behavior enrichment for this frame
      console.debug("Behavior analyzer frame error:", err);
    }
  }

  /**
   * Convenience: apply behavior result back to a Detection as well.
   */
  applyToDetection(detection: Detection, tracked: TrackedObject): void {
    if (tracked.behavior && tracked.behaviorConf != null) {
      detection.behavior     = tracked.behavior;
      detection.behaviorConf = tracked.behaviorConf;
    }
  }

  /**
   * Return the risk delta for a given behavior (0 if not applicable).
   */
  static riskDelta(behavior: BehaviorFlag | undefined): number {
    if (!behavior) return 0;
    return BEHAVIOR_RISK_DELTA[behavior] ?? 0;
  }

  /** Evict buffer for objects that are no longer tracked. */
  evictTrack(trackId: number): void {
    this.frameBuffer.delete(trackId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Build a Float32 ONNX tensor of shape [1, T, 3, IMG_SIZE, IMG_SIZE]
   * from a ring buffer of raw RGB crops.
   */
  private buildTensor(frames: FrameCrop[]): ort.Tensor {
    const T = SEQ_LEN;
    const C = 3;
    const H = IMG_SIZE;
    const W = IMG_SIZE;
    const pixelsPerFrame = C * H * W;
    const data = new Float32Array(T * pixelsPerFrame);

    for (let t = 0; t < T; t++) {
      const raw = frames[t];
      const offset = t * pixelsPerFrame;
      const pixCount = H * W;

      for (let i = 0; i < pixCount; i++) {
        const r = (raw[i * 3]     / 255 - MEAN[0]) / STD[0];
        const g = (raw[i * 3 + 1] / 255 - MEAN[1]) / STD[1];
        const b = (raw[i * 3 + 2] / 255 - MEAN[2]) / STD[2];

        // CHW layout per frame: R-plane, G-plane, B-plane
        data[offset + 0 * pixCount + i] = r;
        data[offset + 1 * pixCount + i] = g;
        data[offset + 2 * pixCount + i] = b;
      }
    }

    return new ort.Tensor("float32", data, [1, T, C, H, W]);
  }

  /** Softmax + argmax over the 8 logits → { behavior, confidence }. */
  private argmaxSoftmax(logits: Float32Array): { behavior: BehaviorFlag; confidence: number } {
    // Numerically-stable softmax
    const max  = Math.max(...Array.from(logits));
    const exps = Array.from(logits).map(v => Math.exp(v - max));
    const sum  = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(v => v / sum);

    let topIdx  = 0;
    let topProb = probs[0];
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > topProb) { topProb = probs[i]; topIdx = i; }
    }

    const behavior: BehaviorFlag =
      topProb >= THRESHOLD && topIdx < BEHAVIORS.length
        ? BEHAVIORS[topIdx]
        : "unknown";

    return { behavior, confidence: topProb };
  }
}
