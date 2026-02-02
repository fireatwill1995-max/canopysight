"use client";

import { Button } from "@canopy-sight/ui";

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center text-gray-900 dark:text-gray-100">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error.message || "An unexpected error occurred"}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={reset} variant="default">
              Try again
            </Button>
            <Button onClick={() => window.location.href = "/dashboard"} variant="outline">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
