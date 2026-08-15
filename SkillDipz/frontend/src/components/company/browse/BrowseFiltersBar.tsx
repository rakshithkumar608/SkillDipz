"use client";

import React from "react";
import type { BrowseFilters, BrowseHints } from "@/store/companyStore";
import { SearchWithHints } from "./SearchWithHints";

interface Props {
  filters: BrowseFilters;
  onFilterChange: (key: keyof BrowseFilters, value: string | number) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  hints: BrowseHints;
  hintsLoading: boolean;
  showHints: boolean;
  setShowHints: (show: boolean) => void;
  onSelectHint: (hint: string) => void;
}

export const ROLE_OPTIONS = [
  { value: "", label: "All Specialties" },
  { value: "Full Stack", label: "Full Stack Developer" },
  { value: "Backend", label: "Backend Engineer" },
  { value: "Frontend", label: "Frontend Developer" },
  { value: "Data Scientist", label: "Data Scientist" },
  { value: "DevOps", label: "DevOps Engineer" },
  { value: "Mobile", label: "Mobile Developer" },
  { value: "ML Engineer", label: "ML Engineer" },
];

export const SCORE_OPTIONS = [
  { value: 0, label: "Any Rating" },
  { value: 60, label: "60% or higher" },
  { value: 70, label: "70% or higher" },
  { value: 80, label: "80% or higher" },
  { value: 90, label: "90% or higher" },
];

export const PROJECT_OPTIONS = [
  { value: 0, label: "Any Projects" },
  { value: 1, label: "1+ Project complete" },
  { value: 2, label: "2+ Projects complete" },
  { value: 3, label: "3+ Projects complete" },
];

export function BrowseFiltersBar({
  filters,
  onFilterChange,
  searchInput,
  onSearchChange,
  onSearchClear,
  hints,
  hintsLoading,
  showHints,
  setShowHints,
  onSelectHint,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* TARGET ROLE */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Target Role
        </label>
        <select
          value={filters.role}
          onChange={(e) => onFilterChange("role", e.target.value)}
          className="w-full bg-[#0e1117] border border-white/10 rounded-xl px-3 py-2.5
                     text-sm text-slate-200 focus:outline-none focus:border-violet-500/50
                     focus:ring-1 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0e1117] text-slate-200">
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* MIN SKILL SCORE */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Min Skill Score
        </label>
        <select
          value={filters.minScore}
          onChange={(e) => onFilterChange("minScore", Number(e.target.value))}
          className="w-full bg-[#0e1117] border border-white/10 rounded-xl px-3 py-2.5
                     text-sm text-slate-200 focus:outline-none focus:border-violet-500/50
                     focus:ring-1 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
        >
          {SCORE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0e1117] text-slate-200">
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* COMPLETED PROJECTS */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Completed Projects
        </label>
        <select
          value={filters.minProjects}
          onChange={(e) => onFilterChange("minProjects", Number(e.target.value))}
          className="w-full bg-[#0e1117] border border-white/10 rounded-xl px-3 py-2.5
                     text-sm text-slate-200 focus:outline-none focus:border-violet-500/50
                     focus:ring-1 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
        >
          {PROJECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0e1117] text-slate-200">
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* DIRECT SEARCH with Autocomplete */}
      <SearchWithHints
        value={searchInput}
        onChange={onSearchChange}
        onClear={onSearchClear}
        hints={hints}
        hintsLoading={hintsLoading}
        showHints={showHints}
        setShowHints={setShowHints}
        onSelectHint={onSelectHint}
      />
    </div>
  );
}
