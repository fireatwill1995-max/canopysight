import * as ort from "onnxruntime-node";
import * as fs from "fs/promises";
import * as path from "path";
import { config } from "../config";

/**
 * Model Manager for YOLO models
 * Supports multiple model variants and fine-tuned models
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

export class ModelManager {
  private models: Map<string, ModelInfo> = new Map();
  private currentModel: string | null = null;

  constructor() {
    // Register available models
    this.registerDefaultModels();
  }

  /**
   * Register default YOLO models
   */
  private registerDefaultModels(): void {
    // YOLOv8n - Nano (fastest, lowest accuracy)
    this.models.set("yolov8n", {
      name: "YOLOv8n",
      path: "./models/yolov8n.onnx",
      version: "8.0",
      inputSize: 640,
      classes: ["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat"],
      quantized: false,
      accuracy: 0.37, // mAP50
    });

    // YOLOv8s - Small (balanced)
    this.models.set("yolov8s", {
      name: "YOLOv8s",
      path: "./models/yolov8s.onnx",
      version: "8.0",
      inputSize: 640,
      classes: ["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat"],
      quantized: false,
      accuracy: 0.44, // mAP50
    });

    // Fine-tuned rail safety model (if available)
    this.models.set("rail-safety-v1", {
      name: "Rail Safety Fine-tuned",
      path: "./models/rail-safety-v1.onnx",
      version: "1.0",
      inputSize: 640,
      classes: ["person", "vehicle", "animal", "equipment", "debris"],
      quantized: true,
      accuracy: 0.78, // Higher accuracy for rail-specific scenarios
    });
  }

  /**
   * Load a model
   */
  async loadModel(modelName: string): Promise<ort.InferenceSession> {
    const modelInfo = this.models.get(modelName);
    if (!modelInfo) {
      throw new Error(`Model ${modelName} not found. Available models: ${Array.from(this.models.keys()).join(", ")}`);
    }

    // Check if model file exists
    try {
      await fs.access(modelInfo.path);
    } catch (accessError) {
      // Fallback to default if fine-tuned model doesn't exist
      if (modelName === "rail-safety-v1") {
        console.warn(`Fine-tuned model not found at ${modelInfo.path}, falling back to default model`);
        return this.loadModel("yolov8n");
      }
      const errorMessage = accessError instanceof Error ? accessError.message : "Unknown error";
      throw new Error(`Model file not found: ${modelInfo.path}. Error: ${errorMessage}`);
    }

    const session = await ort.InferenceSession.create(modelInfo.path, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all", // Enable all optimizations
      enableCpuMemArena: true, // Memory optimization
    });

    this.currentModel = modelName;
    console.log(`✅ Loaded model: ${modelInfo.name} (mAP: ${modelInfo.accuracy})`);
    
    return session;
  }

  /**
   * Get current model info
   */
  getCurrentModel(): ModelInfo | null {
    if (!this.currentModel) return null;
    return this.models.get(this.currentModel) || null;
  }

  /**
   * List available models
   */
  listModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Get best model for current conditions
   */
  getBestModel(prioritizeAccuracy: boolean = false): string {
    if (prioritizeAccuracy) {
      // Return model with highest accuracy
      let bestModel = "yolov8n";
      let bestAccuracy = 0;
      
      for (const [name, info] of this.models.entries()) {
        if (info.accuracy > bestAccuracy) {
          bestAccuracy = info.accuracy;
          bestModel = name;
        }
      }
      return bestModel;
    }
    
    // Default: use fine-tuned if available, else nano
    return this.models.has("rail-safety-v1") ? "rail-safety-v1" : "yolov8n";
  }
}
