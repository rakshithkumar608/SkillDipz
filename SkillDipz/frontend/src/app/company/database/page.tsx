"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  useCompanyStore,
  type BrowseFilters,
  type CandidateDetail,
  type BrowseCandidate,
} from "@/store/companyStore";
import {
  fetchBrowseCandidates,
  fetchBrowseCandidateDetail,
} from "@/lib/CompanyApi";
import { CandidateModal } from "@/components/company/CandidateModal";
import {
  Search,
  Download,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  Building2,
  Building,
  CreditCard,
  Package,
  ShoppingBag,
  Zap,
  Utensils,
  Laptop,
  Sparkles,
} from "lucide-react";

// Helper to render dynamic company brand icon badge based on real target company string
function CompanyBrandBadge({ company }: { company?: string | null }) {
  if (!company) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const name = company.trim();
  const lower = name.toLowerCase();

  let IconComponent = Building2;
  let iconBg = "bg-slate-800 border border-slate-700/80";
  let iconColor = "text-slate-400";

  if (lower.includes("razorpay")) {
    iconBg = "bg-[#0c2340] border border-sky-400/40";
    IconComponent = CreditCard;
    iconColor = "text-sky-400";
  } else if (lower.includes("amazon")) {
    iconBg = "bg-amber-500/15 border border-amber-500/30";
    IconComponent = Package;
    iconColor = "text-amber-400";
  } else if (lower.includes("flipkart")) {
    iconBg = "bg-yellow-500/15 border border-yellow-500/30";
    IconComponent = ShoppingBag;
    iconColor = "text-yellow-400";
  } else if (lower.includes("tcs")) {
    iconBg = "bg-blue-600/15 border border-blue-500/30";
    IconComponent = Building;
    iconColor = "text-blue-400";
  } else if (lower.includes("infosys")) {
    iconBg = "bg-indigo-600/15 border border-indigo-500/30";
    IconComponent = Building2;
    iconColor = "text-indigo-400";
  } else if (lower.includes("google")) {
    iconBg = "bg-rose-500/15 border border-rose-500/30";
    IconComponent = Sparkles;
    iconColor = "text-rose-400";
  } else if (lower.includes("zoho")) {
    iconBg = "bg-emerald-500/15 border border-emerald-500/30";
    IconComponent = Zap;
    iconColor = "text-emerald-400";
  } else if (lower.includes("swiggy")) {
    iconBg = "bg-orange-500/15 border border-orange-500/30";
    IconComponent = Utensils;
    iconColor = "text-orange-400";
  } else if (lower.includes("microsoft")) {
    iconBg = "bg-cyan-500/15 border border-cyan-500/30";
    IconComponent = Laptop;
    iconColor = "text-cyan-400";
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-200">
      <span className={`w-4 h-4 rounded-xs flex items-center justify-center shrink-0 ${iconBg}`}>
        <IconComponent className={`w-2.5 h-2.5 ${iconColor}`} />
      </span>
      <span className="truncate">{name}</span>
    </div>
  );
}

export default function StudentDatabasePage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const {
    browseCandidates = [],
    browseTotal = 0,
    browseTotalPages = 1,
    browseLoading = false,
    browseError = null,
    browseFilters,
    setBrowseResults,
    setBrowseLoading,
    setBrowseError,
    setBrowseFilters,
    resetBrowseFilters,
  } = useCompanyStore();

  const [searchInput, setSearchInput] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const candidateList = useMemo(
    () => (Array.isArray(browseCandidates) ? browseCandidates : []),
    [browseCandidates]
  );

  //  Auth Route Guard 
  useEffect(() => {
    if (_hasHydrated && (!user || user.role !== "COMPANY")) {
      router.push("/login");
    }
  }, [_hasHydrated, user, router]);

  //  Fetch Real-Time Candidates from MongoDB 
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
          per_page: 25,
        });
        setBrowseResults(res?.candidates ?? [], res?.total ?? 0, res?.total_pages ?? 1);
      } catch (err: unknown) {
        setBrowseError(
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Failed to load real-time student database records."
        );
      } finally {
        setBrowseLoading(false);
      }
    },
    [browseFilters, setBrowseLoading, setBrowseError, setBrowseResults]
  );

  //  Initial Fetch 
  useEffect(() => {
    if (_hasHydrated && user?.role === "COMPANY") {
      loadCandidates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, user]);

  //  Real-Time Debounced Search Handler 
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);

      const current = browseFilters ?? {
        role: "",
        minScore: 0,
        minProjects: 0,
        search: "",
        sortBy: "score",
        page: 1,
      };
      const updated: BrowseFilters = {
        ...current,
        search: value,
        page: 1,
      };
      setBrowseFilters({ search: value, page: 1 });
      fetchTimer.current = setTimeout(() => loadCandidates(updated), 300);
    },
    [browseFilters, setBrowseFilters, loadCandidates]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    const current = browseFilters ?? {
      role: "",
      minScore: 0,
      minProjects: 0,
      search: "",
      sortBy: "score",
      page: 1,
    };
    const updated: BrowseFilters = {
      ...current,
      search: "",
      page: 1,
    };
    setBrowseFilters({ search: "", page: 1 });
    loadCandidates(updated);
  }, [browseFilters, setBrowseFilters, loadCandidates]);

  //  Pagination Handler 
  const handlePageChange = useCallback(
    (p: number) => {
      const current = browseFilters ?? {
        role: "",
        minScore: 0,
        minProjects: 0,
        search: "",
        sortBy: "score",
        page: 1,
      };
      const updated: BrowseFilters = {
        ...current,
        page: p,
      };
      setBrowseFilters({ page: p });
      loadCandidates(updated);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [browseFilters, setBrowseFilters, loadCandidates]
  );

  // Open Full Candidate Profile Modal 
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
            email: card.email || "",
            phone: card.phone || null,
            college: card.college,
            branch: card.branch || null,
            target_role: card.target_role,
            skills: card.skills,
            ai_skill_fit_pct: card.skill_index_pct,
            matched_skills: card.skills,
            missing_skills: [],
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

  //  Export Real-Time CSV 
  const handleExportCSV = useCallback(() => {
    if (!candidateList.length) return;
    const headers = [
      "Student Name",
      "Email",
      "Phone",
      "College",
      "Matched Domain",
      "Target Company",
      "Score (%)",
      "Completed Projects",
      "Tests Completed",
      "Verified Skills",
    ];

    const rows = candidateList.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.phone || "").replace(/"/g, '""')}"`,
      `"${(c.college || "").replace(/"/g, '""')}"`,
      `"${(c.matched_domain || c.target_role || "").replace(/"/g, '""')}"`,
      `"${(c.target_company || "").replace(/"/g, '""')}"`,
      `${c.skill_index_pct}%`,
      c.projects_completed,
      c.tests_completed,
      `"${(c.skills || []).join(", ").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_placement_database_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [candidateList]);

  //  Hydration Skeleton 
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-350 mx-auto space-y-6">
        <div className="h-10 w-72 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-12 w-full bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-96 w-full bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-350 mx-auto space-y-6 font-sans">
      {/* 1. Page Header  */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Student Placement Database
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Discloses candidates matching specs with authenticated phone directory contacts.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={candidateList.length === 0}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111c30] hover:bg-[#182845] border border-slate-700/80 text-slate-200 hover:text-white text-xs font-semibold shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {/*  2. Real-Time Full-Width Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search students database by name, email, phone, college, skill..."
          className="w-full pl-11 pr-16 py-3 bg-[#0a1020]/90 border border-slate-800/90 rounded-2xl text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500/50 transition-colors shadow-inner"
        />
        {searchInput && (
          <button
            onClick={handleClearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 font-medium bg-slate-800 px-2 py-0.5 rounded-md transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/*  3. Error Banner  */}
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
              Retry Syncing Database
            </button>
          </div>
        </div>
      )}

      {/*  4. Placement Database Table  */}
      <div className="rounded-2xl sm:rounded-3xl bg-[#090f1d]/90 border border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-800/90 bg-[#060b16]/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-5 sm:px-6">STUDENT EMAIL</th>
                <th className="py-4 px-4">PHONE</th>
                <th className="py-4 px-4">COLLEGE</th>
                <th className="py-4 px-4">MATCHED DOMAIN</th>
                <th className="py-4 px-4">TARGET COMPANY</th>
                <th className="py-4 px-4 text-center">SCORE</th>
                <th className="py-4 px-4 text-center">COMPLETED PROJECTS</th>
                <th className="py-4 px-5 sm:px-6 text-right">ACTION</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/60 font-normal">
              {browseLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5 sm:px-6">
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-32 bg-white/5 rounded-sm" />
                        <div className="h-2.5 w-44 bg-white/5 rounded-sm" />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3 w-24 bg-white/5 rounded-sm" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3 w-28 bg-white/5 rounded-sm" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3 w-36 bg-white/5 rounded-sm" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3 w-20 bg-white/5 rounded-sm" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 w-10 bg-white/5 rounded-sm mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 w-6 bg-white/5 rounded-sm mx-auto" />
                    </td>
                    <td className="py-4 px-5 sm:px-6 text-right">
                      <div className="h-7 w-14 bg-white/5 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : candidateList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
                        <Database className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-200">No Student Records Found</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {searchInput
                          ? `No candidates match the search query "${searchInput}".`
                          : "No student candidate profiles registered in the database yet."}
                      </p>
                      {searchInput && (
                        <button
                          onClick={handleClearSearch}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold hover:bg-sky-500/20"
                        >
                          Clear Search Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                candidateList.map((candidate: BrowseCandidate) => (
                  <tr
                    key={candidate.student_id}
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => handleOpenCandidate(candidate.student_id)}
                  >
                    {/* STUDENT EMAIL */}
                    <td className="py-4 px-5 sm:px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
                          {candidate.name}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          {candidate.email || "—"}
                        </span>
                      </div>
                    </td>

                    {/* PHONE */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="text-xs text-slate-300 font-mono tracking-tight">
                        {candidate.phone || "—"}
                      </span>
                    </td>

                    {/* COLLEGE */}
                    <td className="py-4 px-4">
                      <span className="text-xs text-slate-300 whitespace-nowrap">
                        {candidate.college || "Independent Candidate"}
                      </span>
                    </td>

                    {/* MATCHED DOMAIN */}
                    <td className="py-4 px-4">
                      <span className="text-xs text-slate-300 whitespace-nowrap">
                        {candidate.matched_domain || candidate.target_role || "Software Developer"}
                      </span>
                    </td>

                    {/* TARGET COMPANY */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <CompanyBrandBadge company={candidate.target_company} />
                    </td>

                    {/* SCORE */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className="text-xs sm:text-sm font-bold text-teal-400">
                        {Math.round(candidate.skill_index_pct)}%
                      </span>
                    </td>

                    {/* COMPLETED PROJECTS */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className="text-xs sm:text-sm text-slate-300">
                        {candidate.projects_completed}
                      </span>
                    </td>

                    {/* ACTION */}
                    <td className="py-4 px-5 sm:px-6 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCandidate(candidate.student_id);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#0e182e] hover:bg-sky-500/20 border border-sky-500/40 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-all cursor-pointer shadow-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary & Pagination */}
        <div className="px-5 py-3.5 border-t border-slate-800/80 bg-[#060b16]/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            Displaying <strong className="text-slate-200">{candidateList.length}</strong> of{" "}
            <strong className="text-slate-200">{browseTotal}</strong> live student records
          </span>

          {browseTotalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, (browseFilters?.page || 1) - 1))}
                disabled={(browseFilters?.page || 1) <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 font-medium px-1">
                Page {browseFilters?.page || 1} / {browseTotalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(browseTotalPages, (browseFilters?.page || 1) + 1))}
                disabled={(browseFilters?.page || 1) >= browseTotalPages}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal Loading Spinner */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-xs sm:text-sm font-medium text-slate-200">
              Loading student profile credentials…
            </span>
          </div>
        </div>
      )}

      {/*  6. Full Candidate Profile Modal  */}
      {selectedCandidate && !modalLoading && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
