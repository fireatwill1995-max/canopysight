import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { config } from "../config";
import { Detection, DetectionType, BoundingBox } from "../types";
import { ModelManager, ModelInfo } from "./model-manager";

/**
 * Enhanced YOLO inference engine with model management
 * Supports YOLOv8/v9 models, fine-tuned models, and adaptive processing
 */
export class YOLODetector {
  private session: ort.InferenceSession | null = null;
  private modelManager: ModelManager;
  private modelInfo: ModelInfo | null = null;
  private inputSize: number = 640;
  private classNames: DetectionType[] = ["person", "vehicle", "animal", "unknown"];
  private nmsThreshold: number = 0.45; // Non-maximum suppression threshold
  private confidenceThreshold: number;

  constructor(modelPath?: string) {
    this.modelManager = new ModelManager();
    this.confidenceThreshold = config.detectionThreshold;
  }

  async initialize(modelName?: string): Promise<void> {
    try {
      // Select best model if not specified
      const selectedModel = modelName || this.modelManager.getBestModel();
      
      // Load model
      this.session = await this.modelManager.loadModel(selectedModel);
      this.modelInfo = this.modelManager.getCurrentModel();
      
      if (this.modelInfo) {
        this.inputSize = this.modelInfo.inputSize;
        // Map model classes to our detection types
        this.classNames = this.mapClassesToDetectionTypes(this.modelInfo.classes);
      }
      
      if (!this.modelInfo) {
        throw new Error("Model info not available after loading");
      }
      console.log(`✅ YOLO model initialized: ${this.modelInfo.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to load YOLO model (${modelName || "default"}):`, errorMessage);
      
      // Fallback to default only if we weren't already trying the default
      const selectedModel = modelName || this.modelManager.getBestModel();
      if (selectedModel !== "yolov8n") {
        try {
          console.warn("Attempting fallback to default YOLOv8n model...");
          this.session = await this.modelManager.loadModel("yolov8n");
          this.modelInfo = this.modelManager.getCurrentModel();
          if (this.modelInfo) {
            this.inputSize = this.modelInfo.inputSize;
            this.classNames = this.mapClassesToDetectionTypes(this.modelInfo.classes);
            console.log("✅ Fallback to default YOLOv8n model successful");
          } else {
            throw new Error("Fallback model info not available");
          }
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "Unknown error";
          console.error("Failed to load fallback model:", fallbackMessage);
          // Re-throw original error with context
          throw new Error(`Failed to load model: ${errorMessage}. Fallback also failed: ${fallbackMessage}`);
        }
      } else {
        // If we were already trying the default, don't retry
        throw new Error(`Failed to load default model: ${errorMessage}`);
      }
    }
  }

  /**
   * Map model classes to our detection types
   */
  private mapClassesToDetectionTypes(modelClasses: string[]): DetectionType[] {
    const mapping: Record<string, DetectionType> = {
      person: "person",
      people: "person",
      pedestrian: "person",
      car: "vehicle",
      truck: "vehicle",
      bus: "vehicle",
      motorcycle: "vehicle",
      bicycle: "vehicle",
      train: "vehicle",
      vehicle: "vehicle",
      dog: "animal",
      cat: "animal",
      horse: "animal",
      animal: "animal",
    };

    const types = new Set<DetectionType>();
    for (const className of modelClasses) {
      const lower = className.toLowerCase();
      if (mapping[lower]) {
        types.add(mapping[lower]);
      }
    }

    // Always include our base types
    return Array.from(new Set([...types, "person", "vehicle", "animal", "unknown"]));
  }

  /**
   * Enhanced preprocessing with normalization and augmentation
   */
  private async preprocess(image: sharp.Sharp): Promise<ort.Tensor> {
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Invalid image metadata");
    }

    // Resize with letterboxing to maintain aspect ratio (better accuracy)
    const { data, info } = await image
      .resize(this.inputSize, this.inputSize, {
        fit: "contain",
        background: { r: 114, g: 114, b: 114 }, // YOLO standard padding color
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;

    // Normalize pixel values to [0, 1] using YOLO standard normalization
    // YOLO uses RGB format and normalizes to [0, 1]
    const pixels = new Float32Array(this.inputSize * this.inputSize * 3);
    const pixelCount = width * height;
    
    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];
      
      // Normalize to [0, 1] and arrange in CHW format (Channel, Height, Width)
      pixels[i] = r / 255.0; // R channel
      pixels[pixelCount + i] = g / 255.0; // G channel
      pixels[2 * pixelCount + i] = b / 255.0; // B channel
    }

    // Create tensor with shape [1, 3, height, width]
    return new ort.Tensor("float32", pixels, [1, 3, this.inputSize, this.inputSize]);
  }

  /**
   * Non-Maximum Suppression to remove duplicate detections
   */
  private nms(detections: Array<{
    detection: Detection;
    score: number;
  }>): Detection[] {
    if (detections.length === 0) return [];

    // Sort by confidence
    detections.sort((a, b) => b.score - a.score);

    const selected: Detection[] = [];
    const suppressed = new Set<number>();

    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue;

      selected.push(detections[i].detection);

      // Suppress overlapping detections
      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue;

        const iou = this.calculateIoU(
          detections[i].detection.boundingBox,
          detections[j].detection.boundingBox
        );

        if (iou > this.nmsThreshold) {
          suppressed.add(j);
        }
      }
    }

    return selected;
  }

  /**
   * Calculate IoU between two bounding boxes
   */
  private calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return intersection / union;
  }

  /**
   * Enhanced postprocessing with NMS and better coordinate handling
   */
  private postprocess(
    output: ort.Tensor,
    originalWidth: number,
    originalHeight: number
  ): Detection[] {
    const rawDetections: Array<{ detection: Detection; score: number }> = [];
    
    try {
      if (!output || !output.data) {
        console.warn("Invalid output from YOLO model: output is null or undefined");
        return [];
      }
      
      const outputData = output.data as Float32Array;
      const outputShape = output.dims;

      if (!outputShape || outputShape.length < 2) {
        console.warn(`Invalid output shape from YOLO model: ${JSON.stringify(outputShape)}`);
        return [];
      }
      
      if (!outputData || outputData.length === 0) {
        console.warn("Empty output data from YOLO model");
        return [];
      }

      // YOLOv8 output format: [batch, num_detections, 85]
      // 85 = 4 (bbox: center_x, center_y, width, height) + 1 (objectness) + 80 (class scores)
      // For custom models, adjust based on num_classes
      const numDetections = outputShape[1] || 0;
      if (numDetections === 0) {
        return []; // No detections
      }
      
      if (!this.modelInfo) {
        console.warn("Model info not available, using default class count");
        return [];
      }
      
      const numClasses = this.modelInfo.classes.length || 80;
      const elementsPerDetection = 4 + 1 + numClasses;

      // Calculate scale factors for letterboxing
      const scale = Math.min(this.inputSize / originalWidth, this.inputSize / originalHeight);
      const scaledWidth = originalWidth * scale;
      const scaledHeight = originalHeight * scale;
      const padX = (this.inputSize - scaledWidth) / 2;
      const padY = (this.inputSize - scaledHeight) / 2;

      for (let i = 0; i < numDetections; i++) {
        try {
          const offset = i * elementsPerDetection;
          
          // Bounds check
          if (offset + elementsPerDetection > outputData.length) {
            break;
          }

          // Extract bounding box (normalized center_x, center_y, width, height)
          const centerX = outputData[offset];
          const centerY = outputData[offset + 1];
          const width = outputData[offset + 2];
          const height = outputData[offset + 3];
          const objectness = outputData[offset + 4];

          // Validate values
          if (
            !Number.isFinite(centerX) || !Number.isFinite(centerY) ||
            !Number.isFinite(width) || !Number.isFinite(height) ||
            !Number.isFinite(objectness) || objectness < 0.25 // Pre-filter low objectness
          ) {
            continue;
          }

          // Find class with highest confidence
          let maxClassIdx = 0;
          let maxConfidence = outputData[offset + 5] || 0;
          for (let j = 1; j < numClasses; j++) {
            const conf = outputData[offset + 5 + j] || 0;
            if (conf > maxConfidence) {
              maxConfidence = conf;
              maxClassIdx = j;
            }
          }

          const confidence = objectness * maxConfidence;

          // Filter by confidence threshold
          if (confidence >= this.confidenceThreshold && Number.isFinite(confidence)) {
            // Convert from normalized model coordinates to original image coordinates
            // Account for letterboxing
            const modelX = (centerX - padX) / scale;
            const modelY = (centerY - padY) / scale;
            const modelW = width / scale;
            const modelH = height / scale;

            // Convert center to top-left corner
            const x = Math.max(0, Math.min(originalWidth, modelX - modelW / 2));
            const y = Math.max(0, Math.min(originalHeight, modelY - modelH / 2));
            const w = Math.max(10, Math.min(originalWidth - x, modelW)); // Min 10px width
            const h = Math.max(10, Math.min(originalHeight - y, modelH)); // Min 10px height

            // Map class index to detection type
            if (!this.modelInfo || !this.modelInfo.classes[maxClassIdx]) {
              console.warn(`Class index ${maxClassIdx} out of range for model with ${this.modelInfo?.classes.length || 0} classes`);
              continue;
            }
            const className = this.modelInfo.classes[maxClassIdx];
            const detectionType = this.mapClassNameToType(className);

            rawDetections.push({
              detection: {
                id: `${Date.now()}-${i}`,
                type: detectionType,
                confidence: Math.min(1, Math.max(0, confidence)),
                boundingBox: { x, y, width: w, height: h },
                timestamp: new Date(),
              },
              score: confidence,
            });
          }
        } catch (detectionError) {
          console.warn(`Error processing detection ${i}:`, detectionError);
          // Continue with next detection
        }
      }

      // Apply Non-Maximum Suppression
      const nmsDetections = this.nms(rawDetections);
      return nmsDetections;
    } catch (error) {
      console.error("Error in postprocess:", error);
      return [];
    }
  }

  /**
   * Map model class name to our detection type
   */
  private mapClassNameToType(className: string): DetectionType {
    const lower = className.toLowerCase();
    
    if (lower.includes("person") || lower.includes("pedestrian") || lower.includes("people")) {
      return "person";
    }
    if (lower.includes("car") || lower.includes("truck") || lower.includes("bus") || 
        lower.includes("motorcycle") || lower.includes("bicycle") || lower.includes("vehicle") ||
        lower.includes("train")) {
      return "vehicle";
    }
    if (lower.includes("dog") || lower.includes("cat") || lower.includes("animal") ||
        lower.includes("horse") || lower.includes("bird")) {
      return "animal";
    }
    
    return "unknown";
  }

  /**
   * Run detection on an image
   */
  async detect(image: sharp.Sharp): Promise<Detection[]> {
    try {
      if (!this.session) {
        await this.initialize();
      }

      if (!this.session) {
        throw new Error("YOLO model not initialized");
      }

      // Get original image dimensions
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Invalid image metadata");
      }
      const originalWidth = metadata.width;
      const originalHeight = metadata.height;

      // Preprocess
      const inputTensor = await this.preprocess(image);

      // Run inference
      if (!this.session.inputNames || this.session.inputNames.length === 0) {
        throw new Error("Model has no input names");
      }
      
      const feeds: Record<string, ort.Tensor> = {};
      const inputName = this.session.inputNames[0];
      if (!inputName) {
        throw new Error("Model input name is null or undefined");
      }
      feeds[inputName] = inputTensor;

      const results = await this.session.run(feeds);
      
      if (!this.session.outputNames || this.session.outputNames.length === 0) {
        throw new Error("Model has no output names");
      }
      
      const outputName = this.session.outputNames[0];
      if (!outputName) {
        throw new Error("Model output name is null or undefined");
      }
      
      const output = results[outputName];
      if (!output) {
        throw new Error(`Model output '${outputName}' not found in results`);
      }

      // Postprocess
      const detections = this.postprocess(output, originalWidth, originalHeight);

      return detections;
    } catch (error) {
      console.error("Error in YOLO detection:", error);
      // Return empty array on error rather than crashing
      return [];
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo | null {
    return this.modelInfo;
  }

  /**
   * Update confidence threshold dynamically
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Get current confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  async close(): Promise<void> {
    // Cleanup resources
    if (this.session) {
      // ONNX Runtime sessions are automatically cleaned up
      this.session = null;
    }
    this.modelInfo = null;
  }
}
