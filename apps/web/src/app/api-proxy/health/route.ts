/**
 * Next.js API route to proxy health check requests
 * This ensures the health endpoint works through ngrok
 */
import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api-config";

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = getApiBaseUrl();
    const healthUrl = `${apiUrl}/health`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({ status: "unknown" }));

      return NextResponse.json(data, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      clearTimeout(timeoutId);
      
      // If API server is not running, return degraded status
      return NextResponse.json(
        {
          status: "degraded",
          timestamp: new Date().toISOString(),
          message: "API server not reachable",
          database: "unknown",
        },
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        message: "Health check proxy failed",
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
