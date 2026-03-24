/** @type {import('next').NextConfig} */
const path = require("path");
// When using ngrok, set NGROK_URL in .env.local (e.g. https://xxx.ngrok-free.dev) so chunk URLs resolve correctly
const ngrokUrl = process.env.NGROK_URL?.replace(/\/$/, "");
const rootDir = path.join(__dirname, "../..");
const nextConfig = {
  output: "standalone", // for Fly/Docker: self-contained server
  reactStrictMode: true,
  transpilePackages: ["@canopy-sight/ui", "@canopy-sight/auth", "@canopy-sight/validators"],
  // Resolve workspace packages from monorepo root so Next.js finds them during build
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@canopy-sight/ui": path.resolve(rootDir, "packages/ui"),
      "@canopy-sight/auth": path.resolve(rootDir, "packages/auth"),
      "@canopy-sight/api": path.resolve(rootDir, "apps/api"),
      "@canopy-sight/validators": path.resolve(rootDir, "packages/validators"),
    };
    return config;
  },
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
    optimizePackageImports: [
      "@canopy-sight/ui",
      "@tanstack/react-query",
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
  // Proxy API requests to local API server
  // Note: API routes in /app/api-proxy take precedence over rewrites
  // So /api-proxy/trpc uses the API route, /api-proxy/health uses the API route
  // Other paths use the rewrite
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
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
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
      {
        protocol: "https",
        hostname: "cdn.canopysight.com",
      },
    ],
  },
};

module.exports = nextConfig;
