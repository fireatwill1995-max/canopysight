"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@canopy-sight/ui";
import { isDemoMode, getDemoUser, clearDemoMode } from "@/lib/demo-auth";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "canopy_theme";

// Mobile menu icons using inline SVG
const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sites", label: "Sites" },
  { href: "/devices", label: "Devices" },
  { href: "/alerts", label: "Alerts" },
  { href: "/incidents", label: "Incidents" },
  { href: "/playback", label: "Playback" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [demoMode, setDemoMode] = useState(false);
  const [demoUser, setDemoUser] = useState<ReturnType<typeof getDemoUser>>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const handleDemoSignOut = () => {
    clearDemoMode();
    router.push("/sign-in");
  };

  const renderAuthUI = () =>
    demoMode && demoUser ? (
      <div className="hidden sm:flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 text-xs sm:text-sm font-medium border border-yellow-200 shadow-sm">
          <span className="text-base sm:text-lg">🧪</span>
          <span className="hidden md:inline">Demo: {demoUser.firstName} {demoUser.lastName}</span>
          <span className="md:hidden">Demo</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleDemoSignOut} className="shrink-0">
          Sign out
        </Button>
      </div>
    ) : (
      <div className="hidden sm:flex items-center gap-2">
        <span className="px-3 sm:px-4 py-2 rounded-lg bg-muted text-foreground text-xs sm:text-sm font-medium border border-border">
          <span className="hidden md:inline">Guest</span>
        </span>
        <Button variant="default" size="sm" asChild className="shrink-0">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );

  const renderAuthUIMobile = () =>
    demoMode && demoUser ? (
      <>
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 text-sm font-medium border border-yellow-200">
          <span className="text-lg">🧪</span>
          <span>Demo: {demoUser.firstName} {demoUser.lastName}</span>
        </div>
        <Button variant="outline" className="w-full" onClick={handleDemoSignOut}>
          Sign out
        </Button>
      </>
    ) : (
      <Button variant="default" className="w-full" asChild>
        <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
      </Button>
    );

  useEffect(() => {
    // Check demo mode on mount and when pathname changes
    const checkDemoMode = () => {
      setDemoMode(isDemoMode());
      setDemoUser(getDemoUser());
    };
    
    checkDemoMode();
    
    // Re-check when storage changes (e.g., demo mode toggled in another tab)
    const handleStorageChange = () => {
      checkDemoMode();
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [pathname]);

  // Theme (dark-mode, low-distraction UI requirement)
  useEffect(() => {
    const root = document.documentElement;
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark" | null) ?? null;
    const systemPrefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initial: "light" | "dark" = stored ?? (systemPrefersDark ? "dark" : "light");
    setTheme(initial);
    root.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next: "light" | "dark" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    root.classList.toggle("dark", next === "dark");
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="border-b border-border bg-background/85 dark:bg-background/90 backdrop-blur-xl shadow-sm sticky top-0 z-50 transition-colors duration-200">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link 
              href="/dashboard" 
              className="text-xl sm:text-2xl font-bold text-foreground hover:opacity-80 transition-all duration-200"
            >
              Canopy Sight™
            </Link>
            {/* Desktop Navigation */}
            <div className="hidden lg:flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 xl:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === item.href || pathname?.startsWith(item.href + "/")
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle dark mode"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {renderAuthUI()}
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-border pt-4">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 touch-manipulation ${
                    pathname === item.href || pathname?.startsWith(item.href + "/")
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted active:bg-accent"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={toggleTheme}
                className="px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 touch-manipulation text-foreground hover:bg-muted border border-border flex items-center justify-between"
              >
                <span>Theme</span>
                <span>{theme === "dark" ? "☀️ Light" : "🌙 Dark"}</span>
              </button>
              {renderAuthUIMobile()}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
