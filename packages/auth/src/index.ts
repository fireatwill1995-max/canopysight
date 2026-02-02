export { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
export { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Role-based access control helpers
export type UserRole = "admin" | "supervisor" | "viewer";

export const ROLES: Record<UserRole, string[]> = {
  admin: ["admin", "supervisor", "viewer"],
  supervisor: ["supervisor", "viewer"],
  viewer: ["viewer"],
};

export function hasRole(userRole: string, requiredRole: UserRole): boolean {
  return ROLES[requiredRole]?.includes(userRole) ?? false;
}

export function requireRole(userRole: string, requiredRole: UserRole): void {
  if (!hasRole(userRole, requiredRole)) {
    throw new Error(`Insufficient permissions. Required role: ${requiredRole}`);
  }
}
