/**
 * Next.js API route to proxy health check requests
 * This ensures the health endpoint works through ngrok
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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
    } catch (fetchError) {
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
