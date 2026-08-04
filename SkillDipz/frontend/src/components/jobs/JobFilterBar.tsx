"use client";

import { useEffect, useState } from "react";
import { useJobsStore } from "@/store/jobsStore";
import { getJobFilters } from "@/lib/jobsApi";
import type { JobFiltersOptions } from "@/types/jobs";
import {
  Filter,
  MapPin,
  SortDesc,
  Eye,
  Briefcase,
  RotateCcw,
  X,
  Search,
} from "lucide-react";

const SORT_OPTIONS = [
  { value: "match_score", label: "Best Match" },
  { value: "newest", label: "Newest First" },
  { value: "highest_ctc", label: "Highest CTC" },
];

const SHOW_OPTIONS = [
  { value: "all", label: "All Jobs" },
  { value: "eligible", label: "Eligible Only" },
  { value: "applied", label: "Applied" },
];

interface Props {
  studentRole?: string;
}

export default function JobFilterBar({ studentRole }: Props) {
  const { filters, setFilter, resetFilters } = useJobsStore();
  const [filterOptions, setFilterOptions] = useState<JobFiltersOptions>({
    roles: [],
    locations: [],
    work_modes: [],
  });

  const [roleInput, setRoleInput] = useState(filters.role);
  const [locationInput, setLocationInput] = useState(filters.location);

  // Synchronize local input state if external filter state changes (e.g. on Reset)
  useEffect(() => {
    setRoleInput(filters.role);
  }, [filters.role]);

  useEffect(() => {
    setLocationInput(filters.location);
  }, [filters.location]);

  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      try {
        const options = await getJobFilters();
        if (isMounted) {
          setFilterOptions(options);
        }
      } catch (err) {
        console.error("Failed to load job filter options:", err);
      }
    };
    fetchOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRoleSearch = () => {
    setFilter("role", roleInput.trim());
  };

  const handleLocationSearch = () => {
    setFilter("location", locationInput.trim());
  };

  const handleReset = () => {
    resetFilters(studentRole);
    setRoleInput(studentRole || "");
    setLocationInput("");
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-medium text-slate-300">Search & Filter</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Role Input Box */}
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            list="role-suggestions"
            placeholder="Type Role (e.g. Backend)..."
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRoleSearch();
              }
            }}
            className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.08] text-sm text-slate-200 placeholder:text-slate-500 hover:border-sky-500/30 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {roleInput && (
              <button
                type="button"
                onClick={() => {
                  setRoleInput("");
                  setFilter("role", "");
                }}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
                title="Clear role filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleRoleSearch}
              title="Search Role"
              className="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 hover:text-sky-300 transition-colors flex items-center justify-center"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          <datalist id="role-suggestions">
            {filterOptions.roles.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>

        {/* Location Input Box */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            list="location-suggestions"
            placeholder="Search Location (e.g. Bangalore)..."
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLocationSearch();
              }
            }}
            className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.08] text-sm text-slate-200 placeholder:text-slate-500 hover:border-sky-500/30 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {locationInput && (
              <button
                type="button"
                onClick={() => {
                  setLocationInput("");
                  setFilter("location", "");
                }}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
                title="Clear location filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleLocationSearch}
              title="Search Location"
              className="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 hover:text-sky-300 transition-colors flex items-center justify-center"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          <datalist id="location-suggestions">
            {filterOptions.locations.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </div>

        {/* Sort */}
        <div className="relative">
          <SortDesc className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <select
            value={filters.sort}
            onChange={(e) =>
              setFilter(
                "sort",
                e.target.value as "match_score" | "newest" | "highest_ctc"
              )
            }
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.08] text-sm text-slate-200 appearance-none cursor-pointer hover:border-sky-500/30 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Show */}
        <div className="relative">
          <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <select
            value={filters.show}
            onChange={(e) =>
              setFilter("show", e.target.value as "all" | "eligible" | "applied")
            }
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.08] text-sm text-slate-200 appearance-none cursor-pointer hover:border-sky-500/30 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          >
            {SHOW_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/40 border border-white/[0.06] text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:border-white/[0.1] transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>
    </div>
  );
}
