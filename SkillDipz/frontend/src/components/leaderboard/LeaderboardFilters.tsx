import { useEffect, useRef, useState, useMemo } from "react";
import {
  Loader2,
  RefreshCw,
  Search,
  X,
  Target,
  ChevronDown,
  Briefcase,
  Check,
} from "lucide-react";
import { fetchLeaderboardRoles } from "@/lib/leaderboardApi";

interface Props {
  scope?: "global" | "college";
  role: string;
  searchQuery?: string;
  sortBy?: "score" | "tests" | "projects" | "streak";
  loading: boolean;
  jumping?: boolean;
  showScope?: boolean;
  showJumpToMe?: boolean;
  onScopeChange?: (s: "global" | "college") => void;
  onRoleChange: (r: string) => void;
  onSearchChange?: (q: string) => void;
  onSortChange?: (s: "score" | "tests" | "projects" | "streak") => void;
  onJumpToMe?: () => void;
  onRefresh: () => void;
}

export function LeaderboardFilters({
  scope = "global",
  role,
  searchQuery = "",
  sortBy = "score",
  loading,
  jumping = false,
  showScope = true,
  showJumpToMe = false,
  onScopeChange,
  onRoleChange,
  onSearchChange,
  onSortChange,
  onJumpToMe,
  onRefresh,
}: Props) {
  const [dbRoles, setDbRoles] = useState<string[]>([]);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleSearchInput, setRoleSearchInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live distinct roles from MongoDB
  useEffect(() => {
    let isMounted = true;
    fetchLeaderboardRoles()
      .then((roles) => {
        if (isMounted && Array.isArray(roles) && roles.length > 0) {
          setDbRoles(roles.filter(Boolean));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filtered live roles based on inline search
  const filteredRoles = useMemo(() => {
    if (!roleSearchInput.trim()) return dbRoles;
    const q = roleSearchInput.toLowerCase().trim();
    return dbRoles.filter((r) => r.toLowerCase().includes(q));
  }, [dbRoles, roleSearchInput]);

  const handleSelectRole = (r: string) => {
    onRoleChange(r);
    setRoleDropdownOpen(false);
    setRoleSearchInput("");
  };

  const handleClearRole = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRoleChange("All Specialties");
    setRoleSearchInput("");
  };

  const isRoleActive = role && role !== "All Specialties" && role !== "All Roles";

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full">
      {/* 1. Prominent Search Candidate Input */}
      {onSearchChange && (
        <div className="relative flex-1 min-w-45 sm:min-w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search candidate by name, college, role, or skill..."
            className="w-full bg-[#0a0f1d] border border-slate-800 rounded-xl sm:rounded-2xl pl-10 pr-9 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 2. Filter Controls Right Row */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Global / College Scope Toggle */}
        {showScope && onScopeChange && (
          <div className="flex rounded-xl overflow-hidden border border-slate-800 bg-[#0a0f1d] p-0.5">
            {(["global", "college"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onScopeChange(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  scope === s
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s === "college" ? "My College" : "Global"}
              </button>
            ))}
          </div>
        )}

        {/* 3. Searchable All Specialties / Role Dropdown Combobox */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setRoleDropdownOpen(!roleDropdownOpen);
              setRoleSearchInput("");
            }}
            className={`
              flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl sm:rounded-2xl text-xs font-semibold
              bg-[#0a0f1d] border transition-all cursor-pointer shadow-sm
              ${
                isRoleActive
                  ? "border-sky-500/50 text-sky-300 bg-sky-500/10"
                  : "border-slate-800 text-slate-200 hover:border-slate-700"
              }
            `}
          >
            <div className="flex items-center gap-1.5 min-w-0 max-w-40 sm:max-w-48 truncate">
              <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {isRoleActive ? role : "All Specialties"}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isRoleActive && (
                <span
                  role="button"
                  onClick={handleClearRole}
                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10"
                  title="Clear specialty filter"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  roleDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {/* Floating Dropdown with Search */}
          {roleDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              {/* Search Inside Specialties */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roleSearchInput}
                  onChange={(e) => setRoleSearchInput(e.target.value)}
                  placeholder="Search specialty or role..."
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Roles List */}
              <div className="max-h-52 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-800">
                <button
                  type="button"
                  onClick={() => handleSelectRole("All Specialties")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                    !isRoleActive
                      ? "bg-sky-500/15 text-sky-300 font-bold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>All Specialties (All Candidates)</span>
                  {!isRoleActive && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </button>

                {filteredRoles.map((r) => {
                  const isSelected = role.toLowerCase() === r.toLowerCase();
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleSelectRole(r)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                        isSelected
                          ? "bg-sky-500/15 text-sky-300 font-bold"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{r}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}

                {filteredRoles.length === 0 && (
                  <div className="px-3 py-3 text-center text-xs text-slate-500">
                    No matching specialties found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Sort By Dropdown */}
        {onSortChange && (
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) =>
                onSortChange(
                  e.target.value as "score" | "tests" | "projects" | "streak"
                )
              }
              className="text-xs bg-[#0a0f1d] border border-slate-800 text-slate-200 rounded-xl sm:rounded-2xl px-3 py-2 pr-7 outline-none focus:border-sky-500 cursor-pointer shadow-sm font-semibold"
            >
              <option value="score" className="bg-slate-900 text-white">
                Sort: Top Score
              </option>
              <option value="tests" className="bg-slate-900 text-white">
                Sort: Tests Checked
              </option>
              <option value="projects" className="bg-slate-900 text-white">
                Sort: Projects Done
              </option>
              <option value="streak" className="bg-slate-900 text-white">
                Sort: Active Streak
              </option>
            </select>
          </div>
        )}

        {/* Jump to my rank */}
        {showJumpToMe && onJumpToMe && (
          <button
            type="button"
            onClick={onJumpToMe}
            disabled={jumping}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl sm:rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {jumping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Target className="w-3.5 h-3.5" />
            )}
            <span>My Rank</span>
          </button>
        )}

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh real-time data"
          className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#0a0f1d] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-400" : ""}`} />
        </button>
      </div>
    </div>
  );
}
