/** @type {import('next').NextConfig} */
// When using ngrok, set NGROK_URL in .env.local (e.g. https://xxx.ngrok-free.dev) so chunk URLs resolve correctly
const ngrokUrl = process.env.NGROK_URL?.replace(/\/$/, "");
const nextConfig = {
  output: "standalone", // for Fly/Docker: self-contained server (run with node apps/web/server.js)
  // Monorepo: workspace packages are traced when building from apps/web with turbo
  reactStrictMode: true,
  transpilePackages: ["@canopy-sight/ui"],
  // In dev via ngrok: set NGROK_URL in .env.local (e.g. https://xxx.ngrok-free.dev) so chunk URLs resolve (avoids ChunkLoadError /_next/undefined)
  ...(process.env.NODE_ENV === "development" && ngrokUrl && { assetPrefix: ngrokUrl }),
  // Allow ngrok and other tunnel origins in development (HMR, cross-origin)
  allowedDevOrigins: [
    "https://*.ngrok-free.dev",
    "https://*.ngrok.io",
    "https://*.ngrok.app",
  ],
  // Optimize bundle size
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ["@canopy-sight/ui", "@tanstack/react-query"],
  },
  // Proxy API requests to local API server
  // Note: API routes in /app/api-proxy take precedence over rewrites
  // So /api-proxy/trpc uses the API route, /api-proxy/health uses the API route
  // Other paths use the rewrite
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path((?!trpc|health).*)",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.svg",
        permanent: false,
      },
    ];
  },
  // WebSocket proxy - Next.js doesn't support WebSocket rewrites natively
  // So WebSocket connections will need to go directly to the API server
  // For ngrok, we'll need a separate tunnel for the API or use the same tunnel
  // with a different path (which requires custom server setup)
  // Allow images from ngrok and other external sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.ngrok-free.dev",
      },
      {
        protocol: "https",
        hostname: "**.ngrok.io",
      },
    ],
  },
};

module.exports = nextConfig;
