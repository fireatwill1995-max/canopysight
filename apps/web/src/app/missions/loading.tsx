import { Skeleton, ListItemSkeleton } from "@canopy-sight/ui";

export default function MissionsLoading() {
  return (
    <div className="canopy-page space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Mission list */}
      <div className="space-y-3">
        <ListItemSkeleton count={6} />
      </div>
    </div>
  );
}
