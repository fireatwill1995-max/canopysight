import sharp from "sharp";
import { config } from "../config";

/**
 * Camera interface for capturing frames
 * Supports both V4L2 (Linux) and mock camera for development
 */
export class Camera {
  private cameraIndex: number;
  private width: number = 1920;
  private height: number = 1080;
  private isInitialized: boolean = false;

  constructor(cameraIndex: number = config.cameraIndex) {
    this.cameraIndex = cameraIndex;
  }

  async initialize(): Promise<void> {
    // TODO: Initialize actual camera hardware (V4L2/libcamera)
    // For now, this is a placeholder that would interface with:
    // - V4L2 on Linux: /dev/video0, /dev/video1, etc.
    // - libcamera on Raspberry Pi OS
    // - USB cameras via V4L2
    
    this.isInitialized = true;
    console.log(`Camera ${this.cameraIndex} initialized`);
  }

  async captureFrame(): Promise<Buffer> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // TODO: Capture actual frame from camera
      // For development/testing, generate a mock frame
      // In production, this would use:
      // - fs.readFileSync for V4L2 capture
      // - libcamera-vid for Raspberry Pi Camera Module
      // - OpenCV for USB cameras
      
      // Mock frame generation for development
      const mockFrame = await sharp({
        create: {
          width: this.width,
          height: this.height,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .jpeg({ quality: 85 })
        .toBuffer();

      if (!mockFrame || mockFrame.length === 0) {
        throw new Error("Failed to generate frame buffer");
      }

      return mockFrame;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error capturing frame from camera ${this.cameraIndex}:`, errorMessage);
      // Re-throw to allow caller to handle
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async captureFrameAsImage(): Promise<sharp.Sharp> {
    try {
      const buffer = await this.captureFrame();
      if (!buffer || buffer.length === 0) {
        throw new Error("Empty frame buffer");
      }
      return sharp(buffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error creating image from frame (camera ${this.cameraIndex}):`, errorMessage);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  getResolution(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  async close(): Promise<void> {
    // TODO: Release camera resources
    this.isInitialized = false;
  }
}
