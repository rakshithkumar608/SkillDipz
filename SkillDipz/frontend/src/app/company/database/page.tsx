"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  useCompanyStore,
  type BrowseFilters,
  type CandidateDetail,
} from "@/store/companyStore";
import {
  fetchBrowseCandidates,
  fetchBrowseHints,
  fetchBrowseCandidateDetail,
} from "@/lib/CompanyApi";
import {
  BrowseHeader,
  BrowseFiltersBar,
  BrowseResultsHeader,
  BrowseCandidateCard,
  BrowseGridSkeleton,
  BrowsePagination,
  BrowseEmptyState,
} from "@/components/company/browse";
import { CandidateModal } from "@/components/company/CandidateModal";
import { AlertCircle, Loader2 } from "lucide-react";

export default function BrowseCandidatesPage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const {
    browseCandidates = [],
    browseTotal = 0,
    browseTotalPages = 1,
    browseLoading = false,
    browseError = null,
    browseHints = { names: [], colleges: [], skills: [] },
    hintsLoading = false,
    browseFilters,
    setBrowseResults,
    setBrowseLoading,
    setBrowseError,
    setBrowseHints,
    setHintsLoading,
    setBrowseFilters,
    resetBrowseFilters,
  } = useCompanyStore();

  const [showHints, setShowHints] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const candidateList = Array.isArray(browseCandidates) ? browseCandidates : [];
  const safeHints = browseHints ?? { names: [], colleges: [], skills: [] };

  // ── Auth Route Guard ────────────────────────────────────────────────────────
  useEffect(() => {
    if (_hasHydrated && (!user || user.role !== "COMPANY")) {
      router.push("/login");
    }
  }, [_hasHydrated, user, router]);

  // ── Fetch Candidates Function ───────────────────────────────────────────────
  const loadCandidates = useCallback(
    async (filters: BrowseFilters = browseFilters) => {
      setBrowseLoading(true);
      setBrowseError(null);
      try {
        const res = await fetchBrowseCandidates({
          role: filters?.role || undefined,
          min_score: filters?.minScore || undefined,
          min_projects: filters?.minProjects || undefined,
          search: filters?.search || undefined,
          sort_by: filters?.sortBy ?? "score",
          page: filters?.page ?? 1,
          per_page: 20,
        });
        setBrowseResults(res?.candidates ?? [], res?.total ?? 0, res?.total_pages ?? 1);
      } catch (err: unknown) {
        setBrowseError(
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Failed to load candidate talent directory."
        );
      } finally {
        setBrowseLoading(false);
      }
    },
    [browseFilters, setBrowseLoading, setBrowseError, setBrowseResults]
  );

  // ── Initial Fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (_hasHydrated && user?.role === "COMPANY") {
      loadCandidates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, user]);

  // ── Filter Changes (Dropdowns / Sort) ───────────────────────────────────────
  const handleFilterChange = useCallback(
    (key: keyof BrowseFilters, value: string | number) => {
      const updated: BrowseFilters = {
        role: "",
        minScore: 0,
        minProjects: 0,
        search: "",
        sortBy: "score",
        page: 1,
        ...browseFilters,
        [key]: value,
        page: 1,
      };
      setBrowseFilters({ [key]: value, page: 1 });
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => loadCandidates(updated), 250);
    },
    [browseFilters, setBrowseFilters, loadCandidates]
  );

  // ── Search Input & Hints Debounce ──────────────────────────────────────────
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);

      // Debounced search query to backend
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      const updated: BrowseFilters = {
        role: "",
        minScore: 0,
        minProjects: 0,
        search: "",
        sortBy: "score",
        page: 1,
        ...browseFilters,
        search: value,
        page: 1,
      };
      setBrowseFilters({ search: value, page: 1 });
      fetchTimer.current = setTimeout(() => loadCandidates(updated), 350);

      // Debounced autocomplete suggestions
      if (hintsTimer.current) clearTimeout(hintsTimer.current);
      if (value.trim().length >= 2) {
        setShowHints(true);
        setHintsLoading(true);
        hintsTimer.current = setTimeout(async () => {
          try {
            const hints = await fetchBrowseHints(value.trim());
            setBrowseHints(hints ?? { names: [], colleges: [], skills: [] });
          } catch {
            setBrowseHints({ names: [], colleges: [], skills: [] });
          } finally {
            setHintsLoading(false);
          }
        }, 250);
      } else {
        setShowHints(false);
        setBrowseHints({ names: [], colleges: [], skills: [] });
      }
    },
    [browseFilters, setBrowseFilters, setBrowseHints, setHintsLoading, loadCandidates]
  );

  const handleSearchClear = useCallback(() => {
    setSearchInput("");
    setShowHints(false);
    setBrowseHints({ names: [], colleges: [], skills: [] });
    const updated: BrowseFilters = {
      role: "",
      minScore: 0,
      minProjects: 0,
      search: "",
      sortBy: "score",
      page: 1,
      ...browseFilters,
      search: "",
      page: 1,
    };
    setBrowseFilters({ search: "", page: 1 });
    loadCandidates(updated);
  }, [browseFilters, setBrowseFilters, setBrowseHints, loadCandidates]);

  const handleSelectHint = useCallback(
    (hint: string) => {
      setSearchInput(hint);
      setShowHints(false);
      const updated: BrowseFilters = {
        role: "",
        minScore: 0,
        minProjects: 0,
        search: "",
        sortBy: "score",
        page: 1,
        ...browseFilters,
        search: hint,
        page: 1,
      };
      setBrowseFilters({ search: hint, page: 1 });
      loadCandidates(updated);
    },
    [browseFilters, setBrowseFilters, loadCandidates]
  );

  const handleResetFilters = useCallback(() => {
    resetBrowseFilters();
    setSearchInput("");
    setShowHints(false);
    loadCandidates({
      role: "",
      minScore: 0,
      minProjects: 0,
      search: "",
      sortBy: "score",
      page: 1,
    });
  }, [resetBrowseFilters, loadCandidates]);

  // ── Open Full Candidate Profile Modal ──────────────────────────────────────
  const handleOpenCandidate = useCallback(
    async (studentId: string) => {
      setModalLoading(true);
      setSelectedCandidate(null);
      try {
        const detail = await fetchBrowseCandidateDetail(studentId);
        setSelectedCandidate(detail);
      } catch {
        const card = candidateList.find((c) => c.student_id === studentId);
        if (card) {
          setSelectedCandidate({
            student_id: card.student_id,
            name: card.name,
            avatar_initials: card.avatar_initials,
            email: "",
            college: card.college,
            branch: null,
            target_role: card.target_role,
            skills: card.skills,
            ai_skill_fit_pct: card.skill_index_pct,
            matched_skills: card.skills,
            missing_skills: [],
            phone: null,
            github: null,
            linkedin: null,
            overall_score: card.skill_index_pct,
            tests_completed: card.tests_completed,
            projects_completed: card.projects_completed,
            skill_index_pct: card.skill_index_pct,
          });
        }
      } finally {
        setModalLoading(false);
      }
    },
    [candidateList]
  );

  // ── Pagination Handler ─────────────────────────────────────────────────────
  const handlePageChange = useCallback(
    (p: number) => {
      const updated: BrowseFilters = {
        role: "",
        minScore: 0,
        minProjects: 0,
        search: "",
        sortBy: "score",
        page: 1,
        ...browseFilters,
        page: p,
      };
      setBrowseFilters({ page: p });
      loadCandidates(updated);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [browseFilters, setBrowseFilters, loadCandidates]
  );

  // ── Hydration Skeleton ─────────────────────────────────────────────────────
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 max-w-6xl mx-auto space-y-6">
        <div className="h-10 w-64 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <BrowseGridSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 max-w-6xl mx-auto space-y-6">
      {/* 1. Header */}
      <BrowseHeader />

      {/* 2. Filter Controls & Autocomplete Search */}
      <BrowseFiltersBar
        filters={
          browseFilters ?? {
            role: "",
            minScore: 0,
            minProjects: 0,
            search: "",
            sortBy: "score",
            page: 1,
          }
        }
        onFilterChange={handleFilterChange}
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        onSearchClear={handleSearchClear}
        hints={safeHints}
        hintsLoading={hintsLoading}
        showHints={showHints}
        setShowHints={setShowHints}
        onSelectHint={handleSelectHint}
      />

      {/* 3. Results count & Sort Options */}
      {!browseLoading && !browseError && candidateList.length > 0 && (
        <BrowseResultsHeader
          total={browseTotal ?? candidateList.length}
          sortBy={browseFilters?.sortBy ?? "score"}
          onSortChange={(sort) => handleFilterChange("sortBy", sort)}
        />
      )}

      {/* 4. Error Banner */}
      {browseError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{browseError}</p>
            <button
              type="button"
              onClick={() => loadCandidates()}
              className="text-xs font-semibold underline mt-1.5 hover:text-rose-200"
            >
              Retry Loading Candidates
            </button>
          </div>
        </div>
      )}

      {/* 5. Candidate Grid or Loading / Empty States */}
      {browseLoading ? (
        <BrowseGridSkeleton count={8} />
      ) : candidateList.length === 0 ? (
        <BrowseEmptyState onResetFilters={handleResetFilters} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {candidateList.map((candidate) => (
            <BrowseCandidateCard
              key={candidate.student_id}
              candidate={candidate}
              onClick={() => handleOpenCandidate(candidate.student_id)}
            />
          ))}
        </div>
      )}

      {/* 6. Pagination */}
      {!browseLoading && (
        <BrowsePagination
          currentPage={browseFilters?.page ?? 1}
          totalPages={browseTotalPages ?? 1}
          onPageChange={handlePageChange}
        />
      )}

      {/* 7. Modal Loading Spinner */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-xs sm:text-sm font-medium text-slate-200">
              Loading student portfolio…
            </span>
          </div>
        </div>
      )}

      {/* 8. Candidate Profile Modal */}
      {selectedCandidate && !modalLoading && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
