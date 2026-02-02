/**
 * Next.js API route to proxy tRPC requests
 * This ensures tRPC requests work through ngrok and return proper JSON errors
 */
import { NextRequest, NextResponse } from "next/server";

// tRPC INTERNAL_SERVER_ERROR code (JSON-RPC 2.0 / tRPC spec)
const TRPC_INTERNAL_SERVER_ERROR = -32603;

/** Return a tRPC-compatible error body so the client can parse it (avoids "Unable to transform response" / "Missing result") */
function trpcErrorResponse(message: string, isBatch: boolean, batchSize: number = 1) {
  const body = {
    message,
    code: TRPC_INTERNAL_SERVER_ERROR,
    data: { code: "INTERNAL_SERVER_ERROR" as const, httpStatus: 500 },
  };
  const payload = isBatch
    ? Array.from({ length: batchSize }, () => ({ error: body }))
    : { error: body };
  return NextResponse.json(payload, {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

// Simple logger for Next.js API routes (server-side only)
// In production, these would be sent to error tracking service
const logError = (message: string, data?: unknown) => {
  // Only log in development to avoid console noise
  // In production, send to error tracking (Sentry, etc.)
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error(`[tRPC Proxy] ${message}`, data);
  }
};

export async function GET(request: NextRequest) {
  return handleTrpcRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleTrpcRequest(request, "POST");
}

async function handleTrpcRequest(request: NextRequest, method: string) {
  const { pathname, searchParams } = new URL(request.url);
  const isBatch = searchParams.get("batch") === "1";
  // Batch size = number of procedures in path (e.g. "device.list,site.list" -> 2)
  const pathPart = pathname.split("/trpc/")[1]?.trim() || "";
  const batchSize = pathPart ? Math.max(1, pathPart.split(",").length) : 1;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    // Extract the tRPC path from /api-proxy/trpc/...
    const trpcPath = pathname.replace("/api-proxy/trpc", "/trpc");
    const queryString = searchParams.toString();
    const trpcUrl = `${apiUrl}${trpcPath}${queryString ? `?${queryString}` : ""}`;

    // Get headers from request
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Forward demo mode headers
    const demoMode = request.headers.get("x-demo-mode");
    const demoUserId = request.headers.get("x-demo-user-id");
    const demoOrgId = request.headers.get("x-demo-organization-id");
    const demoRole = request.headers.get("x-demo-user-role");

    if (demoMode) {
      headers["x-demo-mode"] = demoMode;
    }
    if (demoUserId) {
      headers["x-demo-user-id"] = demoUserId;
    }
    if (demoOrgId) {
      headers["x-demo-organization-id"] = demoOrgId;
    }
    if (demoRole) {
      headers["x-demo-user-role"] = demoRole;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      // Add body for POST requests
      if (method === "POST") {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      }

      const response = await fetch(trpcUrl, fetchOptions);
      clearTimeout(timeoutId);

      // Get response text first to check if it's JSON
      const responseText = await response.text();
      
      // Check content type
      const contentType = response.headers.get("content-type") || "";
      
      // Try to parse as JSON, if it fails, return error JSON
      let responseData;
      if (contentType.includes("application/json") || responseText.trim().startsWith("{")) {
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          logError("Failed to parse tRPC response as JSON", {
            responseText: responseText.substring(0, 200),
            status: response.status,
          });
          return trpcErrorResponse("Invalid JSON response from server", isBatch, batchSize);
        }
      } else {
        logError("tRPC endpoint returned non-JSON response", {
          contentType,
          status: response.status,
          responsePreview: responseText.substring(0, 200),
        });
        const message = responseText.includes("Internal Server Error")
          ? "Database connection failed. Please check if the database is running."
          : "Server error occurred";
        return trpcErrorResponse(message, isBatch, batchSize);
      }

      // Don't pass through empty batch (causes "Missing result" on client)
      if (isBatch && Array.isArray(responseData) && responseData.length === 0) {
        logError("Upstream returned empty batch array", { status: response.status });
        return trpcErrorResponse("Empty response from API", isBatch, batchSize);
      }
      if (response.status >= 400 && isBatch && Array.isArray(responseData) && responseData.length < batchSize) {
        logError("Upstream batch response length mismatch", {
          status: response.status,
          got: responseData.length,
          expected: batchSize,
        });
        return trpcErrorResponse("Invalid batch response from API", isBatch, batchSize);
      }

      // Return the parsed JSON response
      return NextResponse.json(responseData, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const rawMessage =
        fetchError instanceof Error ? fetchError.message : "Network error";
      const isConnectionError =
        rawMessage.includes("fetch failed") ||
        rawMessage.includes("Failed to fetch") ||
        rawMessage.includes("ECONNREFUSED") ||
        rawMessage.toLowerCase().includes("connection refused");
      const message = isConnectionError
        ? `API server unreachable at ${trpcUrl}. Make sure the API is running (e.g. npm run dev from the repo root).`
        : rawMessage;
      logError("Proxy fetch to API failed", {
        url: trpcUrl,
        error: rawMessage,
      });
      return trpcErrorResponse(message, isBatch, batchSize);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return trpcErrorResponse(message, isBatch, batchSize);
  }
}
