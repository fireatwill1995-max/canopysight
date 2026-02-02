/**
 * Demo authentication utilities for testing
 * This allows bypassing Clerk authentication in development
 */

export interface DemoUser {
  userId: string;
  organizationId: string;
  userRole: "admin" | "supervisor" | "viewer";
  email: string;
  firstName: string;
  lastName: string;
}

export const DEMO_USER: DemoUser = {
  userId: "demo-user-123",
  organizationId: "demo-org-123",
  userRole: "admin",
  email: "demo@canopysight.com",
  firstName: "Demo",
  lastName: "User",
};

function hasDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  // Very small cookie parser (we only care about demo_mode=true)
  return document.cookie.split(";").some((c) => c.trim() === "demo_mode=true");
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  // Demo mode can be enabled via sessionStorage (client) and/or cookie (middleware bypass).
  // Checking both prevents a mismatch where middleware allows the page but API calls miss demo headers.
  return sessionStorage.getItem("demo_mode") === "true" || hasDemoCookie();
}

export function getDemoUser(): DemoUser | null {
  if (!isDemoMode()) return null;

  return {
    userId: sessionStorage.getItem("demo_user_id") || DEMO_USER.userId,
    organizationId: sessionStorage.getItem("demo_organization_id") || DEMO_USER.organizationId,
    userRole: (sessionStorage.getItem("demo_user_role") as DemoUser["userRole"]) || DEMO_USER.userRole,
    email: DEMO_USER.email,
    firstName: DEMO_USER.firstName,
    lastName: DEMO_USER.lastName,
  };
}

export function clearDemoMode(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("demo_mode");
  sessionStorage.removeItem("demo_user_id");
  sessionStorage.removeItem("demo_organization_id");
  sessionStorage.removeItem("demo_user_role");
}
