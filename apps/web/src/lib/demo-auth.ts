// Auth stub — Clerk removed. Single-org model: always authenticated as admin.
// Replace this module with a real auth provider when adding multi-tenancy.

export function isDemoMode(): boolean {
  return false;
}

export function getDemoUser(): null {
  return null;
}

export function clearDemoMode(): void {
  // no-op
}
