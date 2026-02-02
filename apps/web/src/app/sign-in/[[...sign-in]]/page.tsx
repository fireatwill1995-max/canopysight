"use client";

import { Button } from "@canopy-sight/ui";
import { useRouter } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  const router = useRouter();

  const handleDemoLogin = () => {
    try {
      sessionStorage.setItem("demo_mode", "true");
      sessionStorage.setItem("demo_user_id", "demo-user-123");
      sessionStorage.setItem("demo_organization_id", "demo-org-123");
      sessionStorage.setItem("demo_user_role", "admin");
      router.push("/dashboard");
    } catch {
      // non-critical
    }
  };

  const hasClerkKey = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Canopy Sight
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Full coverage. Everywhere.</p>
        </div>

        {hasClerkKey ? (
          <div className="flex justify-center">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
            />
          </div>
        ) : null}

        <div className="glass-strong rounded-xl border border-border p-6">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              🧪 Demo Login
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Sign in as a full-access demo admin (no Clerk required).
            </p>
            <Button
              onClick={handleDemoLogin}
              variant="outline"
              className="w-full min-h-[44px] touch-manipulation"
            >
              Continue as Demo Admin
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              No email or password required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
