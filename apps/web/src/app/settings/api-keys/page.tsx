"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@canopy-sight/ui";
import { Button } from "@canopy-sight/ui";
import Link from "next/link";

export default function ApiKeysSettingsPage() {
  return (
    <main className="canopy-page space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
          API Keys & Integrations
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Configure external services like database, AI providers, and maps. For security, secrets are managed via
          environment variables, not stored in the browser.
        </p>
      </div>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Environment-based configuration</CardTitle>
          <CardDescription>
            Canopy Sight uses `.env` files and server-side configuration to keep secrets safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            This demo build intentionally does not expose or edit API keys from the browser. Instead, keys are managed
            in your development or deployment environment as documented in the setup guide.
          </p>
          <div className="text-xs text-gray-500">
            See{" "}
            <Link href="/SETUP_ENV" className="underline">
              `SETUP_ENV.md`
            </Link>{" "}
            in the repo for a full list of required variables.
          </div>
        </CardContent>
      </Card>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>Key categories</CardTitle>
          <CardDescription>High-level view of what you configure via environment variables.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100">
            <div className="font-semibold mb-1">Authentication & Demo Mode</div>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
              <li>Demo login and access level</li>
              <li>Clerk keys (if re-enabled in future)</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100">
            <div className="font-semibold mb-1">Database & Storage</div>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
              <li>PostgreSQL connection string</li>
              <li>Object storage for video clips (S3, etc.)</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100">
            <div className="font-semibold mb-1">AI & Analytics</div>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
              <li>Anthropic / OpenAI keys</li>
              <li>Telemetry and observability endpoints</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100">
            <div className="font-semibold mb-1">Maps & External APIs</div>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
              <li>Google Maps key</li>
              <li>3rd-party safety platforms</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="card-gradient">
        <CardHeader>
          <CardTitle>How to rotate keys safely</CardTitle>
          <CardDescription>Operational guidance for production deployments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>In production you should:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Store secrets in your cloud provider&apos;s secret manager (not in Git).</li>
            <li>Rotate keys regularly and immediately after any suspected leak.</li>
            <li>Use separate keys for dev, staging, and production.</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

