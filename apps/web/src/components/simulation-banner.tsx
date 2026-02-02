"use client";

import { isSimulationMode, setSimulationMode } from "@/lib/simulation";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@canopy-sight/ui";
import Link from "next/link";

export function SimulationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isSimulationMode());
  }, [pathname]); // Re-check when navigating so banner appears/disappears

  const handleTurnOff = () => {
    setSimulationMode(false);
    setShow(false);
    router.refresh();
  };

  if (!show) return null;

  return (
    <div className="bg-amber-100 dark:bg-amber-950/50 border-b border-amber-300 dark:border-amber-800 px-4 py-2">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-900 dark:text-amber-100">Simulation mode</span>
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Demo data and mock feeds are used across the app so you can test every page.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="border-amber-500 text-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/50 min-h-[36px]">
              Dashboard
            </Button>
          </Link>
          <Link href="/sites">
            <Button variant="outline" size="sm" className="border-amber-500 text-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/50 min-h-[36px]">
              Sites
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTurnOff}
            className="border-amber-600 text-amber-900 hover:bg-amber-200 dark:hover:bg-amber-900/50 min-h-[36px]"
          >
            Turn off simulation
          </Button>
        </div>
      </div>
    </div>
  );
}
