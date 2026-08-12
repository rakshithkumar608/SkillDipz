"use client";

import { LeaderboardFilters } from "@/components/leaderboard/LeaderboardFilters";
import { fmt } from "@/components/leaderboard/leaderboardHelpers";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { MyPositionCard } from "@/components/leaderboard/MyPositionCard";
import { PodiumCard } from "@/components/leaderboard/PodiumCard";
import { Skeleton } from "@/components/profile/ProfileUI";
import { fetchLeaderboard, LeaderboardResponse } from "@/lib/leaderboardApi";
import { Loader2, Medal, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("All Roles");
  const [scope, setScope] = useState<"global" | "college">("global");
  const [jumping, setJumping] = useState(false);

  const load = useCallback(
    async (p: number, r: string, s: "global" | "college", aroundMe = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchLeaderboard({
          role: r === "All Roles" ? undefined : r,
          scope: s,
          page: p,
          per_page: 50,
          around_me: aroundMe,
        });
        setData(res);
        if (aroundMe) setPage(res.page);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Failed to load leaderboard.",
        );
      } finally {
        setLoading(false);
        setJumping(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(page, role, scope);
  }, [load, page, role, scope]);

  // loading Skeleton
  if (loading && !data) {
    return (
      <div className="min-h-screen p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-8" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
          <Skeleton className="h-44 sm:h-52" />
          <Skeleton className="h-52 sm:h-60" />
          <Skeleton className="h-44 sm:h-52" />
        </div>
        <Skeleton className="h-16" />
        <Skeleton className="h-75 sm:h-100" />
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
          onClick={() => load(page, role, scope)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ranking{" "}
            <span className="text-white font-semibold">
              {fmt(data.total_students)}
            </span>{" "}
            students · Real-time · Activity-based
          </p>
        </div>

        <LeaderboardFilters
          scope={scope}
          role={role}
          loading={loading}
          jumping={jumping}
          onScopeChange={(s) => {
            setScope(s);
            setPage(1);
          }}
          onRoleChange={(r) => {
            setRole(r);
            setPage(1);
          }}
          onJumpToMe={() => {
            setJumping(true);
            load(1, role, scope, true);
          }}
          onRefresh={() => load(page, role, scope)}
        />
      </div>

      {/* Top-3 podium section */}
      {data.top_3.length >= 1 && (
        <section className="relative my-6">
          <div className="flex items-center gap-2 mb-6">
            <Medal className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Top Performers
            </h2>
          </div>

          {/* ── 3 students: 2nd (left) | 1st (center, elevated) | 3rd (right) ── */}
          {data.top_3.length === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-4xl mx-auto pt-2">
              {/* 🥈 2nd place */}
              <div className="order-2 md:order-1">
                <PodiumCard entry={data.top_3[1]} />
              </div>
              {/* 🥇 1st place (elevated) */}
              <div className="order-1 md:order-2 md:-translate-y-3 z-10">
                <PodiumCard entry={data.top_3[0]} center={true} />
              </div>
              {/* 🥉 3rd place */}
              <div className="order-3 md:order-3">
                <PodiumCard entry={data.top_3[2]} />
              </div>
            </div>
          )}

          {/* ── 2 students: 1st (left) | 2nd (right) ── */}
          {data.top_3.length === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end max-w-2xl mx-auto pt-2">
              <div className="z-10">
                <PodiumCard entry={data.top_3[0]} center={true} />
              </div>
              <div>
                <PodiumCard entry={data.top_3[1]} />
              </div>
            </div>
          )}

          {/* ── 1 student: Single highlight card ── */}
          {data.top_3.length === 1 && (
            <div className="flex justify-center max-w-sm mx-auto pt-2">
              <div className="w-full">
                <PodiumCard entry={data.top_3[0]} center={true} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* My Position */}
      <MyPositionCard data={data}/>

      {/* Full Table + Pagination */}
      <LeaderboardTable 
      data={data}
      loading={loading}
      onPageChange={setPage}
      />

      {/* Transition overlay */}
      {loading && data && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
