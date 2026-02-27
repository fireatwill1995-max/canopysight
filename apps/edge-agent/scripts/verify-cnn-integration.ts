/**
 * Canopy Sight — CNN integration verification
 * Run from edge-agent: npm run verify-cnn
 * Verifies trained ONNX model loads and YOLODetector returns valid Canopy Sight detection types.
 */

import * as path from "path";
import * as fs from "fs";
import { YOLODetector } from "../src/inference/yolo";
import sharp from "sharp";

const MODELS_DIR = path.join(__dirname, "..", "models");
const RAIL_SAFETY_ONNX = path.join(MODELS_DIR, "rail-safety-v1.onnx");
const FALLBACK_ONNX = path.join(MODELS_DIR, "yolov8n.onnx");
const ALLOWED_TYPES = ["person", "vehicle", "animal", "equipment", "debris", "unknown"] as const;

async function main(): Promise<void> {
  console.log("Canopy Sight — CNN integration verification\n");

  const hasRailSafety = fs.existsSync(RAIL_SAFETY_ONNX);
  const hasFallback = fs.existsSync(FALLBACK_ONNX);
  if (!hasRailSafety && !hasFallback) {
    console.error(
      "No model found. Place rail-safety-v1.onnx or yolov8n.onnx in apps/edge-agent/models/"
    );
    console.error(
      "  Train: python scripts/train_canopy_cnn.py --data-dir datasets/rail-safety"
    );
    process.exit(1);
  }
  console.log(
    hasRailSafety
      ? `✅ Found trained model: rail-safety-v1.onnx`
      : `⚠️ Using fallback: yolov8n.onnx`
  );

  const detector = new YOLODetector();
  try {
    await detector.initialize(hasRailSafety ? "rail-safety-v1" : "yolov8n");
  } catch (e) {
    console.error("Failed to initialize detector:", e);
    process.exit(1);
  }

  const info = detector.getModelInfo();
  if (info) {
    console.log(`   Model: ${info.name}, classes: ${info.classes.join(", ")}`);
  }

  const width = 640;
  const height = 480;
  const buffer = Buffer.alloc(width * height * 3);
  for (let i = 0; i < buffer.length; i++) buffer[i] = 120;
  const image = sharp(buffer, {
    raw: { width, height, channels: 3 },
  });

  const detections = await detector.detect(image);
  console.log(`\n✅ Inference OK. Detections: ${detections.length}`);
  const types = new Set(detections.map((d) => d.type));
  console.log(`   Types: ${[...types].join(", ") || "(none)"}`);
  const invalid = detections.filter((d) => !ALLOWED_TYPES.includes(d.type as any));
  if (invalid.length > 0) {
    console.error("   Invalid types:", invalid.map((d) => d.type));
    process.exit(1);
  }
  console.log("   All detection types are valid Canopy Sight types.");

  await detector.close();
  console.log("\n✅ CNN integration verification passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
