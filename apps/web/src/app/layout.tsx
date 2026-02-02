import type { Metadata } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
import { Navigation } from "@/components/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import "@canopy-sight/ui/src/styles/globals.css";

// Lazy load heavy components that aren't needed immediately
const DemoBanner = dynamic(() => import("@/components/demo-banner").then(mod => ({ default: mod.DemoBanner })), {
  ssr: false, // Don't render on server
  loading: () => null, // Don't show loading state for banner
});

const SimulationBanner = dynamic(() => import("@/components/simulation-banner").then(mod => ({ default: mod.SimulationBanner })), {
  ssr: false,
  loading: () => null,
});

const ConnectionStatus = dynamic(() => import("@/components/connection-status").then(mod => ({ default: mod.ConnectionStatus })), {
  ssr: false,
  loading: () => null,
});

const ServerStatus = dynamic(() => import("@/components/server-status").then(mod => ({ default: mod.ServerStatus })), {
  ssr: false,
  loading: () => null,
});

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

export const metadata: Metadata = {
  title: "Canopy Sight - Full coverage. Everywhere.",
  description: "Real-world sensing and operational intelligence. Clarity over complexity.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", sizes: "any" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Use placeholder so build/prerender succeed when key is missing; app still works with Demo Login
const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
  "pk_test_placeholder";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} font-sans antialiased relative`}>
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/sign-in"
        >
          {/* CANOPY. mountain watermark – same as canopyinc.co, behind all content */}
          <div className="canopy-watermark" aria-hidden="true" />
          {/* CANOPY text watermark – moves slowly across the screen */}
          <div className="canopy-text-watermark" aria-hidden="true">
            <div className="canopy-text-watermark-track">
              <span className="canopy-text-watermark-text">CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY </span>
              <span className="canopy-text-watermark-text" aria-hidden="true">CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY CANOPY </span>
            </div>
          </div>
          <div className="relative z-10 min-h-screen flex flex-col">
            <ErrorBoundary fallback={ErrorFallback}>
              <Providers>
                <DemoBanner />
                <SimulationBanner />
                <Navigation />
                <ServerStatus />
                {children}
                <ConnectionStatus />
              </Providers>
            </ErrorBoundary>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
