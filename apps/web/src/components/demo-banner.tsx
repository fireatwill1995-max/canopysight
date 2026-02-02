"use client";

import { isDemoMode, clearDemoMode } from "@/lib/demo-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@canopy-sight/ui";

export function DemoBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoMode());
  }, []);

  const handleExitDemo = () => {
    clearDemoMode();
    document.cookie = "demo_mode=; path=/; max-age=0";
    router.push("/sign-in");
  };

  if (!show) return null;

  return (
    <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-800 font-semibold">🧪 Demo Mode Active</span>
          <span className="text-yellow-700 text-sm">
            You are logged in as a demo user for testing purposes
          </span>
        </div>
        <Button
          onClick={handleExitDemo}
          variant="outline"
          size="sm"
          className="border-yellow-400 text-yellow-800 hover:bg-yellow-200"
        >
          Exit Demo Mode
        </Button>
      </div>
    </div>
  );
}
