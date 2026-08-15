"use client";

import React, { useRef, useEffect } from "react";
import { Search, X, Loader2, Users, GraduationCap, Zap } from "lucide-react";
import type { BrowseHints } from "@/store/companyStore";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  hints: BrowseHints;
  hintsLoading: boolean;
  showHints: boolean;
  setShowHints: (show: boolean) => void;
  onSelectHint: (hint: string) => void;
}

export function SearchWithHints({
  value,
  onChange,
  onClear,
  hints,
  hintsLoading,
  showHints,
  setShowHints,
  onSelectHint,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close hints on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowHints(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [setShowHints]);

  const names = Array.isArray(hints?.names) ? hints.names : [];
  const colleges = Array.isArray(hints?.colleges) ? hints.colleges : [];
  const skills = Array.isArray(hints?.skills) ? hints.skills : [];

  const hasAnyHints = names.length > 0 || colleges.length > 0 || skills.length > 0;

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
        Direct Search
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (value.trim().length >= 2) setShowHints(true);
          }}
          placeholder="Search name, college, skill..."
          className="w-full bg-[#0e1117] border border-white/10 rounded-xl pl-9 pr-8 py-2.5
                     text-sm text-slate-200 placeholder-slate-600 focus:outline-none
                     focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Hints Dropdown */}
      {showHints && value.trim().length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-[#0e1117] border border-white/15
                     rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto backdrop-blur-md"
        >
          {hintsLoading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-slate-400 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
              <span>Searching directory suggestions...</span>
            </div>
          ) : hasAnyHints ? (
            <ul className="py-1 divide-y divide-white/5">
              {/* Names */}
              {names.length > 0 && (
                <div>
                  <li className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-black/20">
                    Candidates
                  </li>
                  {names.map((name) => (
                    <li key={`hint-name-${name}`}>
                      <button
                        type="button"
                        onMouseDown={() => onSelectHint(name)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-300
                                   hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="truncate">{name}</span>
                      </button>
                    </li>
                  ))}
                </div>
              )}

              {/* Colleges */}
              {colleges.length > 0 && (
                <div>
                  <li className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-black/20">
                    Colleges / Universities
                  </li>
                  {colleges.map((college) => (
                    <li key={`hint-col-${college}`}>
                      <button
                        type="button"
                        onMouseDown={() => onSelectHint(college)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-300
                                   hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{college}</span>
                      </button>
                    </li>
                  ))}
                </div>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <div>
                  <li className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-black/20">
                    Skills
                  </li>
                  {skills.map((skill) => (
                    <li key={`hint-sk-${skill}`}>
                      <button
                        type="button"
                        onMouseDown={() => onSelectHint(skill)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-300
                                   hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{skill}</span>
                      </button>
                    </li>
                  ))}
                </div>
              )}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-slate-500 italic">
              No matching hints for &ldquo;{value}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
