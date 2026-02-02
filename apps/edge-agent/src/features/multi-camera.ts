import { Camera } from "../capture/camera";
import sharp from "sharp";

/**
 * Multi-camera support and 360° stitching
 * Combines multiple camera feeds into panoramic view
 */
export class MultiCameraManager {
  private cameras: Camera[] = [];
  private stitchingEnabled: boolean = false;

  constructor(cameraCount: number = 1) {
    for (let i = 0; i < cameraCount; i++) {
      this.cameras.push(new Camera(i));
    }
  }

  /**
   * Initialize all cameras
   */
  async initialize(): Promise<void> {
    const initPromises = this.cameras.map((camera) => camera.initialize());
    await Promise.all(initPromises);
    console.log(`✅ Initialized ${this.cameras.length} cameras`);
  }

  /**
   * Capture frames from all cameras
   */
  async captureAllFrames(): Promise<sharp.Sharp[]> {
    const frames = await Promise.all(
      this.cameras.map((camera) => camera.captureFrameAsImage())
    );
    return frames;
  }

  /**
   * Stitch multiple camera feeds into 360° panorama
   */
  async stitch360(frames: sharp.Sharp[]): Promise<sharp.Sharp> {
    if (frames.length < 2) {
      return frames[0] || sharp({ create: { width: 1920, height: 1080, channels: 3, background: { r: 0, g: 0, b: 0 } } });
    }

    try {
      // Get frame dimensions
      const metadata = await frames[0].metadata();
      const frameWidth = metadata.width || 640;
      const frameHeight = metadata.height || 480;

      // Create panorama canvas (width = sum of frame widths)
      const panoramaWidth = frameWidth * frames.length;
      const panoramaHeight = frameHeight;

      // Stitch frames horizontally
      const buffers = await Promise.all(frames.map((f) => f.toBuffer()));
      
      // Create composite image
      const composite = sharp({
        create: {
          width: panoramaWidth,
          height: panoramaHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      });

      const inputs = buffers.map((buffer, i) => ({
        input: buffer,
        left: i * frameWidth,
        top: 0,
      }));

      return composite.composite(inputs);
    } catch (error) {
      console.error("Error stitching 360° view:", error);
      // Return first frame as fallback
      return frames[0];
    }
  }

  /**
   * Get single stitched frame for detection
   */
  async getStitchedFrame(): Promise<sharp.Sharp> {
    const frames = await this.captureAllFrames();
    
    if (this.stitchingEnabled && frames.length > 1) {
      return this.stitch360(frames);
    }
    
    return frames[0] || sharp({ create: { width: 1920, height: 1080, channels: 3, background: { r: 0, g: 0, b: 0 } } });
  }

  /**
   * Enable/disable stitching
   */
  setStitchingEnabled(enabled: boolean): void {
    this.stitchingEnabled = enabled;
  }

  /**
   * Close all cameras
   */
  async close(): Promise<void> {
    await Promise.all(this.cameras.map((camera) => camera.close()));
  }
}
