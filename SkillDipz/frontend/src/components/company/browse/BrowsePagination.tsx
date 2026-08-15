"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function BrowsePagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-4 pb-8">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || disabled}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl
                   bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white
                   border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Previous Page"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Previous</span>
      </button>

      <div className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs sm:text-sm text-slate-400">
        Page <span className="text-white font-bold">{currentPage}</span> of{" "}
        <span className="text-white font-bold">{totalPages}</span>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages || disabled}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl
                   bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white
                   border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Next Page"
      >
        <span>Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
