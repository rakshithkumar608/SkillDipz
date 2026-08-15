"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore, TalentCard } from "@/store/companyStore";
import { fetchCompanyDashboard, fetchCandidateDetail } from "@/lib/CompanyApi";
import { StatCard } from "@/components/company/StatCard";
import { TalentCardRow } from "@/components/company/TalentCardRow";
import { CandidateModal } from "@/components/company/CandidateModal";
import { useCompanySocket, CompanyWsEvent } from "@/hooks/useCompanySocket";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Star,
  Users,
  Zap,
} from "lucide-react";


function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 ${className}`} />;
}

//  Number formatter 

function fmt(n: number): string {
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, "") + " L";
  if (n >= 1000)   return n.toLocaleString("en-IN");
  return String(n);
}

//  Page 

export default function EmployerDashboardPage() {
  const router = useRouter();
  const { user, accessToken, _hasHydrated } = useAuthStore();
  const {
    dashboard, selectedCandidate, candidateLoading,
    isLoading, error,
    setDashboard, setSelectedCandidate, setCandidateLoading,
    setLoading, setError,
  } = useCompanyStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchCompanyDashboard(10));
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [setDashboard, setError, setLoading]);

  // ── Load dashboard once store is hydrated & user is authenticated ──
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!dashboard) {
      load();
    }
  }, [_hasHydrated, user, dashboard, router, load]);

  // ── Real-time WebSocket — listen for new candidates ───
  const handleWsEvent = useCallback((event: CompanyWsEvent) => {
    if (event.type === "new_candidate") {
      const { student_name, skill_match_pct } = event.payload;
      toast.success(
        `${student_name} selected your company`,
        {
          description: `AI Skill Fit: ${skill_match_pct}%`,
          duration: 6000,
          icon: "🎯",
        }
      );
      load();
    }
  }, [load]);

  // Connect to WS using company user's ID + token
  useCompanySocket(user?.id, accessToken, handleWsEvent);

  //  Open candidate modal 
  const openCandidate = useCallback(async (card: TalentCard) => {
    setCandidateLoading(true);
    setSelectedCandidate(null);
    try {
      setSelectedCandidate(await fetchCandidateDetail(card.student_id));
    } catch {
      // Graceful fallback with card data if detail fetch fails
      setSelectedCandidate({
        student_id:       card.student_id,
        name:             card.name,
        avatar_initials:  card.avatar_initials,
        email:            "",
        college:          card.college,
        branch:           null,
        target_role:      card.target_role,
        skills:           card.skills,
        ai_skill_fit_pct: card.ai_skill_fit_pct,
        matched_skills:   card.skills,
        missing_skills:   [],
        phone:            null,
        github:           null,
        linkedin:         null,
        overall_score:    0,
      });
    } finally {
      setCandidateLoading(false);
    }
  }, [setCandidateLoading, setSelectedCandidate]);

  // If waiting for hydration
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-14 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-28" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const stats      = dashboard?.stats;
  const talentPool = dashboard?.outstanding_talent_pools ?? [];
  const companyDisplayName = dashboard?.company_name ?? user?.full_name ?? "Hiring Partner";

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 sm:py-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Welcome, Hiring Partner! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed max-w-xl">
            Review student performance metrics, screen candidate directories, and configure placements.
          </p>
        </div>

        {dashboard && (
          <div className="self-start sm:self-auto shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            {dashboard.company_logo_emoji
              ? <span className="text-xl sm:text-2xl">{dashboard.company_logo_emoji}</span>
              : <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">{companyDisplayName}</p>
              <p className="text-[9px] sm:text-[10px] text-emerald-400 font-bold uppercase tracking-wider">VERIFIED PARTNER</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl sm:rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium leading-normal">{error}</p>
            <button onClick={load} className="text-xs font-semibold underline mt-1.5 hover:text-rose-200">
              Retry Load
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoading || !stats
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 sm:h-28" />)
          : <>
              <StatCard
                label="Active Students on Platform"
                value={fmt(stats.active_students_on_platform)}
                icon={<Users className="w-5 h-5 text-purple-400" />}
                glowClass="bg-purple-500"
              />
              <StatCard
                label="Verified Skilled Developers"
                value={fmt(stats.verified_skilled_developers)}
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                glowClass="bg-emerald-500"
              />
              <StatCard
                label="Partner Hiring Corporates"
                value={fmt(stats.partner_hiring_corporates)}
                icon={<Building2 className="w-5 h-5 text-sky-400" />}
                glowClass="bg-sky-500"
              />
              <StatCard
                label="Average Recruitment Time Saved"
                value={`${stats.average_recruitment_time_saved_pct}%`}
                icon={<Zap className="w-5 h-5 text-amber-400" />}
                glowClass="bg-amber-500"
              />
            </>
        }
      </div>

      {/* Talent Pool Section */}
      <div className="rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl shadow-black/20">

        {/* Section Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h2 className="text-xs sm:text-sm font-semibold text-slate-100">Outstanding Active Talent Pools</h2>
          </div>
          <button
            onClick={() => router.push("/company/browse")}
            className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
          >
            <span className="hidden sm:inline">View All Candidates</span>
            <span className="sm:hidden">View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4">
                <Skeleton className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-48" />
                </div>
                <Skeleton className="h-7 w-12 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && talentPool.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-3 sm:mb-4 border border-white/5">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 text-slate-400" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-1">No candidates in talent pool yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed">
              Students who target your company on their portal will appear here in real-time.
            </p>
          </div>
        )}

        {/* List of Talent Cards */}
        {!isLoading && talentPool.map((candidate) => (
          <TalentCardRow
            key={candidate.student_id}
            candidate={candidate}
            onClick={() => openCandidate(candidate)}
          />
        ))}
      </div>

      {/* Candidate Profile Modal Loading Spinner */}
      {candidateLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <span className="text-xs sm:text-sm font-medium text-slate-200">Loading student portfolio…</span>
          </div>
        </div>
      )}

      {/* Candidate Modal */}
      {selectedCandidate && !candidateLoading && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}