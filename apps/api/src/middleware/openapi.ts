import { OpenAPIV3 } from "openapi-types";
import { appRouter } from "../router";

/**
 * Generate OpenAPI 3.0 specification from tRPC router
 * This creates a Swagger/OpenAPI documentation endpoint
 */
export function generateOpenAPISpec(): OpenAPIV3.Document {
  const spec: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: {
      title: "Canopy Sight API",
      version: "1.0.0",
      description: "AI-powered rail safety monitoring system API",
      contact: {
        name: "Canopy Sight Support",
        email: "support@canopysight.com",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3001",
        description: "Development server",
      },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        demoAuth: {
          type: "apiKey",
          in: "header",
          name: "x-demo-mode",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Error message",
            },
            code: {
              type: "string",
              description: "Error code",
            },
          },
        },
        Site: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            address: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            organizationId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Device: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            siteId: { type: "string" },
            status: { type: "string", enum: ["online", "offline", "maintenance", "error"] },
            deviceType: { type: "string" },
            lastHeartbeat: { type: "string", format: "date-time" },
            organizationId: { type: "string" },
          },
        },
        DetectionEvent: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["person", "vehicle", "animal", "unknown"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            timestamp: { type: "string", format: "date-time" },
            riskScore: { type: "number", minimum: 0, maximum: 100 },
            siteId: { type: "string" },
            deviceId: { type: "string" },
          },
        },
        Alert: {
          type: "object",
          properties: {
            id: { type: "string" },
            severity: { type: "string", enum: ["advisory", "warning", "critical"] },
            status: { type: "string", enum: ["active", "acknowledged", "resolved", "dismissed"] },
            title: { type: "string" },
            message: { type: "string" },
            siteId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    tags: [
      { name: "Sites", description: "Site management operations" },
      { name: "Devices", description: "Device management operations" },
      { name: "Detections", description: "Detection event operations" },
      { name: "Alerts", description: "Alert management operations" },
      { name: "Analytics", description: "Analytics and reporting operations" },
      { name: "System", description: "System health and monitoring" },
    ],
  };

  // Note: Full tRPC to OpenAPI conversion would require parsing the router structure
  // This is a simplified version. For production, consider using @trpc-openapi or similar

  return spec;
}

/**
 * Serve OpenAPI spec as JSON
 */
export function serveOpenAPISpec(
  _req: import("express").Request,
  res: import("express").Response
): void {
  const spec = generateOpenAPISpec();
  res.setHeader("Content-Type", "application/json");
  res.json(spec);
}

/**
 * Serve Swagger UI
 */
export function serveSwaggerUI(
  _req: import("express").Request,
  res: import("express").Response
): void {
  const spec = generateOpenAPISpec();
  const specUrl = "/api/openapi.json";
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Canopy Sight API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
  `;
  
  res.setHeader("Content-Type", "text/html");
  res.send(html);
}
