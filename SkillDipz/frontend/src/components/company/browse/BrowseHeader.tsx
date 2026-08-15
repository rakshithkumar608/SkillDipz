import React from "react";
import { Users } from "lucide-react";

export function BrowseHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Browse Verified Talent
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400">
          Screen portfolio profiles with objective skill metrics verified live via sandbox test cases.
        </p>
      </div>
    </div>
  );
}
