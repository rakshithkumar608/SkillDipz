"use client";

import { useCallback, useEffect, useState } from "react";
import { LeaderboardFilters } from "@/components/leaderboard/LeaderboardFilters";
import { fmt } from "@/components/leaderboard/leaderboardHelpers";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { MyPositionCard } from "@/components/leaderboard/MyPositionCard";
import { Skeleton } from "@/components/profile/ProfileUI";
import { fetchLeaderboard, LeaderboardResponse } from "@/lib/leaderboardApi";
import { Loader2, RefreshCw, Trophy, Users } from "lucide-react";

export default function StudentLeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("All Specialties");
  const [scope, setScope] = useState<"global" | "college">("global");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "tests" | "projects" | "streak">("score");
  const [jumping, setJumping] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(
    async (
      p: number,
      r: string,
      s: "global" | "college",
      q: string,
      sort: "score" | "tests" | "projects" | "streak",
      aroundMe = false
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchLeaderboard({
          role: r === "All Specialties" || r === "All Roles" ? undefined : r,
          search: q || undefined,
          sort_by: sort,
          scope: s,
          page: p,
          per_page: 20,
          around_me: aroundMe,
        });
        setData(res);
        if (aroundMe) setPage(res.page);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Failed to load leaderboard."
        );
      } finally {
        setLoading(false);
        setJumping(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, role, scope, debouncedSearch, sortBy);
  }, [load, page, role, scope, debouncedSearch, sortBy]);

  // Loading Skeleton
  if (loading && !data) {
    return (
      <div className="min-h-screen p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-14 w-64 rounded-2xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Trophy className="w-14 h-14 text-slate-600" />
        <p className="text-slate-400 text-sm text-center">{error}</p>
        <button
          onClick={() => load(page, role, scope, debouncedSearch, sortBy)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/*  Header  */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            Platform Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ranking{" "}
            <span className="text-white font-semibold">
              {fmt(data.total_students)}
            </span>{" "}
            verified students · Real-time activity
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#090f1d]/90 border border-slate-800 shadow-md self-start sm:self-auto">
          <Users className="w-4 h-4 text-sky-400" />
          <p className="text-xs font-bold text-white">
            {fmt(data.total_students)} Active Students
          </p>
        </div>
      </div>

      {/*  My Position Card  */}
      <MyPositionCard data={data} />

      {/*  Leaderboard Table Container  */}
      <div className="rounded-3xl bg-[#080d19]/90 border border-slate-800/80 p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              All Ranked Students
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-white/5">
              {data.total_students} Total
            </span>
          </div>

          {/* Filters Bar */}
          <LeaderboardFilters
            scope={scope}
            role={role}
            searchQuery={searchQuery}
            sortBy={sortBy}
            loading={loading}
            jumping={jumping}
            showScope={true}
            showJumpToMe={true}
            onScopeChange={(s) => {
              setScope(s);
              setPage(1);
            }}
            onRoleChange={(r) => {
              setRole(r);
              setPage(1);
            }}
            onSearchChange={setSearchQuery}
            onSortChange={(s) => {
              setSortBy(s);
              setPage(1);
            }}
            onJumpToMe={() => {
              setJumping(true);
              load(1, role, scope, debouncedSearch, sortBy, true);
            }}
            onRefresh={() => load(page, role, scope, debouncedSearch, sortBy)}
          />
        </div>

        {/* Full Leaderboard Table / Cards */}
        <LeaderboardTable
          data={data}
          loading={loading}
          onPageChange={setPage}
        />
      </div>

      {/* Transition overlay */}
      {loading && data && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xs flex items-center justify-center z-50 pointer-events-none">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
