"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import type { BrowseFilters, BrowseHints } from "@/store/companyStore";
import { fetchBrowseRoles } from "@/lib/CompanyApi";
import { SearchWithHints } from "./SearchWithHints";
import { ChevronDown, Search, X, Check, Briefcase } from "lucide-react";

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
  const [liveRoles, setLiveRoles] = useState<string[]>([]);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  //  Fetch 100% Real-Time Distinct Roles from MongoDB 
  useEffect(() => {
    let isMounted = true;
    fetchBrowseRoles()
      .then((roles) => {
        if (isMounted && Array.isArray(roles)) {
          setLiveRoles(roles.filter(Boolean));
        }
      })
      .catch(() => {
        // Handle gracefully if backend is syncing
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(e.target as Node)
      ) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filtered live roles based on inline role search query
  const filteredRoleOptions = useMemo(() => {
    if (!roleSearchQuery.trim()) return liveRoles;
    const q = roleSearchQuery.toLowerCase().trim();
    return liveRoles.filter((r) => r.toLowerCase().includes(q));
  }, [liveRoles, roleSearchQuery]);

  const isCustomTypedRole =
    roleSearchQuery.trim().length > 0 &&
    !liveRoles.some((r) => r.toLowerCase() === roleSearchQuery.trim().toLowerCase());

  const handleSelectRole = (roleValue: string) => {
    onFilterChange("role", roleValue);
    setRoleDropdownOpen(false);
    setRoleSearchQuery("");
  };

  const handleClearRole = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFilterChange("role", "");
    setRoleSearchQuery("");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. TARGET ROLE — SEARCHABLE REAL-TIME COMBOBOX */}
      <div className="space-y-1 relative" ref={roleDropdownRef}>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Target Role
        </label>
        <button
          type="button"
          onClick={() => {
            setRoleDropdownOpen(!roleDropdownOpen);
            setRoleSearchQuery("");
          }}
          className="w-full bg-[#0e1117] border border-white/10 rounded-xl px-3 py-2.5
                     text-sm text-left flex items-center justify-between gap-2
                     text-slate-200 hover:border-white/20 focus:outline-none focus:border-violet-500/50
                     focus:ring-1 focus:ring-violet-500/20 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {filters.role ? filters.role : "All Specialties"}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {filters.role && (
              <span
                role="button"
                onClick={handleClearRole}
                className="p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5"
                title="Clear role filter"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                roleDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Role Search & Selection Dropdown */}
        {roleDropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-[#0e1117] border border-white/15
                       rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in-0 duration-100"
          >
            {/* Inline Search Bar inside role dropdown */}
            <div className="p-2 border-b border-white/10 bg-black/20 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={roleSearchQuery}
                onChange={(e) => setRoleSearchQuery(e.target.value)}
                placeholder="Search or type custom role…"
                autoFocus
                className="w-full bg-[#141822] border border-white/10 rounded-lg pl-8 pr-3 py-1.5
                           text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            {/* List of Real-Time Roles */}
            <div className="max-h-56 overflow-y-auto py-1">
              {/* All Specialties Option */}
              <button
                type="button"
                onClick={() => handleSelectRole("")}
                className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                  !filters.role
                    ? "bg-violet-500/10 text-violet-300 font-semibold"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>All Specialties</span>
                {!filters.role && <Check className="w-3.5 h-3.5 text-violet-400" />}
              </button>

              {/* Custom Typed Role Option */}
              {isCustomTypedRole && (
                <button
                  type="button"
                  onClick={() => handleSelectRole(roleSearchQuery.trim())}
                  className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-semibold transition-colors border-y border-emerald-500/20"
                >
                  <Search className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    Search custom role: &ldquo;{roleSearchQuery.trim()}&rdquo;
                  </span>
                </button>
              )}

              {/* Real Database Roles */}
              {filteredRoleOptions.map((role) => {
                const isSelected = filters.role.toLowerCase() === role.toLowerCase();
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-violet-500/10 text-violet-300 font-semibold"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{role}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                  </button>
                );
              })}

              {filteredRoleOptions.length === 0 && !isCustomTypedRole && (
                <div className="px-3.5 py-3 text-center text-xs text-slate-500">
                  No roles registered in database yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. MIN SKILL SCORE */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Min Skill Score
        </label>
        <select
          value={filters.minScore}
          onChange={(e) => onFilterChange("minScore", Number(e.target.value))}
          aria-label="Filter by minimum skill score"
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

      {/* 3. COMPLETED PROJECTS */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Completed Projects
        </label>
        <select
          value={filters.minProjects}
          onChange={(e) => onFilterChange("minProjects", Number(e.target.value))}
          aria-label="Filter by completed projects"
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

      {/* 4. DIRECT SEARCH with Real-Time Autocomplete */}
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
