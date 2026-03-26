import * as ort from "onnxruntime-node";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Model Manager for YOLO / Canopy wildlife models.
 * Auto-discovers fine-tuned models via JSON sidecar files written by export_onnx.py.
 */
export interface ModelInfo {
  name: string;
  path: string;
  version: string;
  inputSize: number;
  classes: string[];
  quantized: boolean;
  accuracy: number; // mAP score
}

/** Shape of the JSON sidecar written by packages/ml-training/src/export_onnx.py */
interface ModelMetaSidecar {
  name:        string;
  version:     string;
  inputSize:   number;
  classes:     string[];
  framework:   string;
  description: string;
  exportedAt:  string;
}

const MODELS_DIR = path.join(__dirname, "..", "..", "models");

export class ModelManager {
  private models: Map<string, ModelInfo> = new Map();
  private currentModel: string | null = null;

  constructor() {
    this.registerDefaultModels();
  }

  /** Register built-in fallback models and scan for trained sidecar models. */
  private registerDefaultModels(): void {
    // YOLOv8n — generic COCO baseline (fastest)
    this.models.set("yolov8n", {
      name: "YOLOv8n",
      path: path.join(MODELS_DIR, "yolov8n.onnx"),
      version: "8.0",
      inputSize: 640,
      classes: ["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat"],
      quantized: false,
      accuracy: 0.37,
    });

    // Canopy Wildlife v1 — YOLO11 fine-tuned (registered with placeholder; sidecar loaded async)
    this.models.set("canopy-wildlife-v1", {
      name: "Canopy Wildlife v1",
      path: path.join(MODELS_DIR, "canopy-wildlife-v1.onnx"),
      version: "1.0.0",
      inputSize: 640,
      classes: [
        "person", "person_group",
        "vehicle_4wd", "vehicle_truck", "vehicle_motorbike", "vehicle_boat",
        "elephant", "lion", "leopard", "rhinoceros", "buffalo", "zebra",
        "giraffe", "hippopotamus", "crocodile", "cheetah", "wild_dog",
        "hyena", "pangolin", "primate",
        "bird", "reptile",
        "drone", "weapon", "snare", "trap",
      ],
      quantized: false,
      accuracy: 0.85, // Expected post fine-tune mAP50
    });
  }

  /**
   * Attempt to update a model's metadata from its JSON sidecar.
   * Called before loading so classes/inputSize reflect the actual trained model.
   */
  private async loadSidecar(modelKey: string): Promise<void> {
    const info = this.models.get(modelKey);
    if (!info) return;

    const sidecarPath = info.path.replace(/\.onnx$/, ".json");
    try {
      const raw = await fs.readFile(sidecarPath, "utf-8");
      const meta: ModelMetaSidecar = JSON.parse(raw);
      // Overwrite with authoritative values from training pipeline
      info.version   = meta.version   ?? info.version;
      info.inputSize = meta.inputSize  ?? info.inputSize;
      info.classes   = meta.classes?.length ? meta.classes : info.classes;
      console.log(`📋 Loaded model sidecar: ${sidecarPath}`);
    } catch {
      // Sidecar absent — use defaults registered above (fine for pre-training)
    }
  }

  /** Load a model, updating metadata from sidecar first. */
  async loadModel(modelName: string): Promise<ort.InferenceSession> {
    const modelInfo = this.models.get(modelName);
    if (!modelInfo) {
      throw new Error(`Model "${modelName}" not found. Available: ${Array.from(this.models.keys()).join(", ")}`);
    }

    // Refresh class list / inputSize from training sidecar if present
    await this.loadSidecar(modelName);

    // Verify ONNX file exists
    try {
      await fs.access(modelInfo.path);
    } catch {
      // For non-default models, fall back gracefully to yolov8n
      if (modelName !== "yolov8n") {
        console.warn(`Model not found at ${modelInfo.path} — falling back to yolov8n`);
        return this.loadModel("yolov8n");
      }
      throw new Error(`Model file not found: ${modelInfo.path}`);
    }

    const session = await ort.InferenceSession.create(modelInfo.path, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
      enableCpuMemArena: true,
    });

    this.currentModel = modelName;
    console.log(`✅ Loaded model: ${modelInfo.name} v${modelInfo.version} (${modelInfo.classes.length} classes)`);
    return session;
  }

  getCurrentModel(): ModelInfo | null {
    if (!this.currentModel) return null;
    return this.models.get(this.currentModel) || null;
  }

  listModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Prefer the Canopy fine-tuned model; fall back to yolov8n if not yet trained.
   */
  getBestModel(_prioritizeAccuracy: boolean = false): string {
    return "canopy-wildlife-v1";
  }
}
