"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCompanyAuthStore } from "@/store/companyAuthStore";
import {
  fetchLeaderboard,
  type LeaderboardResponse,
} from "@/lib/leaderboardApi";
import { fetchBrowseCandidateDetail } from "@/lib/CompanyApi";
import type { CandidateDetail } from "@/store/companyStore";
import { LeaderboardFilters } from "@/components/leaderboard/LeaderboardFilters";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { CandidateModal } from "@/components/company/CandidateModal";
import { fmt } from "@/components/leaderboard/leaderboardHelpers";
import {
  Trophy,
  RefreshCw,
  Loader2,
  Users,
  AlertCircle,
} from "lucide-react";

export default function CompanyLeaderboardPage() {
  const router = useRouter();
  const { user, _hasHydrated: userHydrated } = useAuthStore();
  const { company, _hasHydrated: companyHydrated } = useCompanyAuthStore();

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("All Specialties");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "tests" | "projects" | "streak">("score");

  // Candidate Profile Modal
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Leaderboard data from MongoDB
  const load = useCallback(
    async (p: number, r: string, q: string, sort: "score" | "tests" | "projects" | "streak") => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchLeaderboard({
          role: r === "All Specialties" || r === "All Roles" ? undefined : r,
          search: q || undefined,
          sort_by: sort,
          scope: "global",
          page: p,
          per_page: 20,
        });
        setData(res);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Failed to load platform leaderboard."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const isHydrated = companyHydrated || userHydrated;
    const isAuthed = !!(company || user);
    if (isHydrated && isAuthed) {
      load(page, role, debouncedSearch, sortBy);
    }
  }, [load, page, role, debouncedSearch, sortBy, companyHydrated, userHydrated, company, user]);

  // Open full candidate profile modal
  const handleSelectCandidate = useCallback(async (studentId: string) => {
    setModalLoading(true);
    try {
      const detail = await fetchBrowseCandidateDetail(studentId);
      setSelectedCandidate(detail);
    } catch {
      // Gracefully handle if profile is loading
    } finally {
      setModalLoading(false);
    }
  }, []);

  // Hydration Skeleton
  const isHydrated = companyHydrated || userHydrated;
  if (!isHydrated) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-16 bg-slate-900/60 rounded-3xl border border-slate-800" />
        <div className="h-96 bg-slate-900/60 rounded-3xl border border-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-7xl mx-auto space-y-6">
      {/*  1. Page Header  */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <span className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            Standard Platform Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Global rankings evaluated across both testing and custom live projects.
          </p>
        </div>

        {data && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#090f1d]/90 border border-slate-800 shadow-md shrink-0 self-start sm:self-auto">
            <Users className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold leading-none">
                Total Candidates
              </p>
              <p className="text-xs font-bold text-white leading-tight mt-0.5">
                {fmt(data.total_students)} Evaluated
              </p>
            </div>
          </div>
        )}
      </div>

      {/*  2. Error Banner  */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs sm:text-sm">{error}</p>
          </div>
          <button
            onClick={() => load(page, role, debouncedSearch, sortBy)}
            className="flex items-center gap-1 text-xs font-bold text-rose-300 hover:text-white underline ml-4"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/*  3. Main Leaderboard Card Box (Matching Reference Layout)  */}
      <div className="rounded-3xl bg-[#080d19]/90 border border-slate-800/80 p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-5">
        {/* Container Top Controls Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              All Registered Candidates
            </h2>
            {data && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-white/5">
                {data.total_students} Ranked
              </span>
            )}
          </div>

          {/* Search Bar + Searchable All Specialties Combobox + Sort */}
          <LeaderboardFilters
            scope="global"
            role={role}
            searchQuery={searchQuery}
            sortBy={sortBy}
            loading={loading}
            showScope={false}
            showJumpToMe={false}
            onRoleChange={(r) => {
              setRole(r);
              setPage(1);
            }}
            onSearchChange={setSearchQuery}
            onSortChange={(s) => {
              setSortBy(s);
              setPage(1);
            }}
            onRefresh={() => load(page, role, debouncedSearch, sortBy)}
          />
        </div>

        {/* Candidate Rows List */}
        {loading && !data ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse"
              />
            ))}
          </div>
        ) : data ? (
          <LeaderboardTable
            data={data}
            loading={loading}
            onPageChange={setPage}
            onSelectCandidate={handleSelectCandidate}
          />
        ) : null}
      </div>

      {/* 4. Modal Loading Spinner  */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-200">
              Loading verified candidate profile...
            </span>
          </div>
        </div>
      )}

      {/*5. Full Candidate Profile Modal */}
      {selectedCandidate && !modalLoading && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
