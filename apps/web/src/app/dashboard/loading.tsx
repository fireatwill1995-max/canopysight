import { Skeleton, StatsSkeleton, CardSkeleton } from "@canopy-sight/ui";

export default function DashboardLoading() {
  return (
    <div className="canopy-page space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsSkeleton count={4} />
      </div>

      {/* Chart placeholder */}
      <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
