/**
 * Web app health endpoint — used by Fly.io probes and monitoring tools.
 *
 * GET /health
 * Returns: { status, version, timestamp, environment }
 */
import { NextResponse } from "next/server";

// Read version once at startup from package.json (injected by Next.js build)
const VERSION = process.env.npm_package_version || "0.1.0";

export const dynamic = "force-dynamic"; // never cache
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      version: VERSION,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Type": "application/json",
      },
    }
  );
}
