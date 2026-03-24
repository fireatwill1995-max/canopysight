import { IncomingMessage, ServerResponse } from "http";
import { createGzip, createDeflate } from "zlib";
import { logger } from "@canopy-sight/config";

/**
 * Response compression middleware for the API server.
 *
 * - Compresses JSON responses using gzip or deflate based on Accept-Encoding
 * - Skips compression for SSE streams (text/event-stream)
 * - Skips compression for responses smaller than 1KB
 *
 * Note: If you prefer the `compression` npm package, install it via:
 *   npm install compression @types/compression
 * and replace this manual implementation.
 */

const MIN_COMPRESSION_SIZE = 1024; // 1KB threshold

export function compressionMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const acceptHeader = req.headers["accept"] || "";

    // Skip compression for SSE streams
    if (acceptHeader.includes("text/event-stream")) {
      return next();
    }

    // Store original write and end methods
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const chunks: Buffer[] = [];
    let encoding: "gzip" | "deflate" | null = null;

    if (acceptEncoding.includes("gzip")) {
      encoding = "gzip";
    } else if (acceptEncoding.includes("deflate")) {
      encoding = "deflate";
    }

    // If no compression encoding supported, skip
    if (!encoding) {
      return next();
    }

    // Override write to collect chunks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    } as typeof res.write;

    // Override end to compress collected data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (chunk?: any, ...args: any[]): ServerResponse {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = Buffer.concat(chunks);

      // Skip compression for small responses
      if (body.length < MIN_COMPRESSION_SIZE) {
        res.write = originalWrite;
        res.end = originalEnd;
        return originalEnd(body);
      }

      // Skip compression for non-text content types
      const contentType = res.getHeader("content-type");
      if (
        contentType &&
        !String(contentType).includes("json") &&
        !String(contentType).includes("text") &&
        !String(contentType).includes("javascript") &&
        !String(contentType).includes("xml")
      ) {
        res.write = originalWrite;
        res.end = originalEnd;
        return originalEnd(body);
      }

      const compressor = encoding === "gzip" ? createGzip() : createDeflate();
      const compressedChunks: Buffer[] = [];

      compressor.on("data", (data: Buffer) => compressedChunks.push(data));
      compressor.on("end", () => {
        const compressed = Buffer.concat(compressedChunks);
        res.setHeader("Content-Encoding", encoding!);
        res.setHeader("Content-Length", compressed.length);
        res.removeHeader("content-length"); // Remove original content-length
        res.setHeader("Vary", "Accept-Encoding");
        res.write = originalWrite;
        res.end = originalEnd;
        originalEnd(compressed);
      });
      compressor.on("error", (err) => {
        logger.error("Compression error, sending uncompressed", {
          error: err.message,
        });
        res.write = originalWrite;
        res.end = originalEnd;
        originalEnd(body);
      });

      compressor.write(body);
      compressor.end();

      return res;
    } as typeof res.end;

    next();
  };
}
