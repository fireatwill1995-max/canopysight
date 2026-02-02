"use client";

import { useRouter } from "next/navigation";
import { Button } from "@canopy-sight/ui";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  const router = useRouter();
  const hasClerkKey = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Canopy Sight
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Full coverage. Everywhere.</p>
        </div>
        {hasClerkKey ? (
          <div className="flex justify-center">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
            />
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign up with Clerk when keys are configured. Use demo login for now.
            </p>
            <Button
              onClick={() => router.push("/sign-in")}
              className="min-h-[44px] touch-manipulation w-full"
            >
              Go to Sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
