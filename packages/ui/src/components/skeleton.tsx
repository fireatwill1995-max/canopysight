import * as React from "react";
import { cn } from "../lib/utils";

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

// Card Skeleton
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

// List Item Skeleton
export function ListItemSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </>
  );
}

// Stats Card Skeleton
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card shadow-sm p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </>
  );
}

// Table Skeleton
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Page Skeleton (for full page loading)
export function PageSkeleton() {
  return (
    <div className="canopy-page space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsSkeleton count={4} />
      </div>
      
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// Alert/Incident Card Skeleton
export function AlertCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-3/4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </>
  );
}

// Device Card Skeleton
export function DeviceCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
        </div>
      ))}
    </>
  );
}

// Site Card Skeleton
export function SiteCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </>
  );
}

// Detail Page Skeleton
export function DetailPageSkeleton() {
  return (
    <div className="canopy-page space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// Mesh Topology Skeleton
export function MeshTopologySkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-8">
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

export { Skeleton };
