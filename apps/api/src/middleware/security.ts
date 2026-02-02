import helmet from "helmet";
import express from "express";

/**
 * Security middleware setup
 */
export function setupSecurityMiddleware(app: express.Application): void {
  // Helmet.js for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOriginsList = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ];
    
    // Also allow ngrok domains
    const ngrokPatterns = [
      /^https:\/\/.*\.ngrok-free\.dev$/,
      /^https:\/\/.*\.ngrok\.io$/,
      /^https:\/\/.*\.ngrok-app\.app$/,
    ];

    if (origin) {
      // Check if origin is in allowed list
      if (allowedOriginsList.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
      // Check if origin matches ngrok patterns
      else if (ngrokPatterns.some(pattern => pattern.test(origin))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      [
        "Content-Type",
        "Authorization",
        "x-demo-mode",
        "x-demo-user-id",
        "x-demo-organization-id",
        "x-demo-user-role",
      ].join(", ")
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}
