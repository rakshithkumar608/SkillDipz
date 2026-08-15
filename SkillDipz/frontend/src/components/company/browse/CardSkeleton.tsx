import React from "react";

export function CardSkeleton() {
  return (
    <div className="bg-[#0e1117] border border-white/8 rounded-2xl p-4 sm:p-5 animate-pulse space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-white/5 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-32 bg-white/5 rounded-md" />
            <div className="h-3 w-24 bg-white/5 rounded-md" />
          </div>
        </div>
        <div className="space-y-1 text-right shrink-0">
          <div className="h-7 w-14 bg-white/5 rounded-md ml-auto" />
          <div className="h-2.5 w-16 bg-white/5 rounded-md ml-auto" />
        </div>
      </div>

      <div className="flex gap-1.5 pt-1">
        <div className="h-5 w-16 bg-white/5 rounded-lg" />
        <div className="h-5 w-20 bg-white/5 rounded-lg" />
        <div className="h-5 w-14 bg-white/5 rounded-lg" />
      </div>

      <div className="pt-3 border-t border-white/5 flex gap-4">
        <div className="h-3.5 w-20 bg-white/5 rounded-md" />
        <div className="h-3.5 w-24 bg-white/5 rounded-md" />
      </div>
    </div>
  );
}

export function BrowseGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
