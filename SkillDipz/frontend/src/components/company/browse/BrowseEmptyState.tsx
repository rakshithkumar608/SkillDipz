import React from "react";
import { Users, RotateCcw } from "lucide-react";

interface Props {
  onResetFilters: () => void;
}

export function BrowseEmptyState({ onResetFilters }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl bg-[#0e1117]/60 border border-white/5">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/5">
        <Users className="w-7 h-7 text-violet-400" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">
        No candidate profiles match your criteria
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed mb-5">
        Try broadening your filters, reducing minimum skill score, or adjusting your search keywords.
      </p>
      <button
        type="button"
        onClick={onResetFilters}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                   bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition-all active:scale-[0.98]"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset All Filters
      </button>
    </div>
  );
}
