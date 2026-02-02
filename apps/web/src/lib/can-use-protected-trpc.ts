/**
 * Clerk has been removed; all access is effectively demo-admin.
 * We can always enable protected tRPC queries in this development build.
 */
export function useCanUseProtectedTrpc(): boolean {
  return true;
}
