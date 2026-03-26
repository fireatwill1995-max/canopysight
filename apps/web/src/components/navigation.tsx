"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "canopy_theme";

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/command", label: "Command" },
  { href: "/impact", label: "Impact" },
  { href: "/sites", label: "Sites" },
  { href: "/devices", label: "Devices" },
  { href: "/alerts", label: "Alerts" },
  { href: "/incidents", label: "Incidents" },
  { href: "/playback", label: "Playback" },
  { href: "/analytics", label: "Analytics" },
  { href: "/species", label: "Species" },
  { href: "/settings", label: "Settings" },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark" | null) ?? null;
    const systemPrefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
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
            <div className="hidden sm:flex items-center">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                ● Live
              </span>
            </div>
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
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
