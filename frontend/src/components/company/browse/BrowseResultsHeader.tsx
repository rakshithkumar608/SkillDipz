"use client";

import React from "react";
import type { BrowseFilters } from "@/store/companyStore";

interface Props {
  total: number;
  sortBy: BrowseFilters["sortBy"];
  onSortChange: (sortBy: BrowseFilters["sortBy"]) => void;
}

export function BrowseResultsHeader({ total, sortBy, onSortChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <p className="text-xs sm:text-sm text-slate-400">
        <span className="text-white font-semibold">{total}</span> candidate
        {total !== 1 ? "s" : ""} verified in directory
      </p>

      {/* Sort Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">Sort:</span>
        <div className="flex gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => onSortChange("score")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              sortBy === "score"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Skill Score
          </button>
          <button
            type="button"
            onClick={() => onSortChange("projects")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              sortBy === "projects"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => onSortChange("tests")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              sortBy === "tests"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Tests
          </button>
        </div>
      </div>
    </div>
  );
}
