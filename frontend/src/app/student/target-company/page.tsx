"use client";

import React, { useState } from "react";
import { useTargetCompanies } from "@/hooks/useTargetCompanies";
import { getCompanyProfile } from "@/lib/targetCompanyApi";
import type { CompanyProfileDetail } from "@/types/targetCompany";
import {
  Loader2,
  Plus,
  RefreshCw,
  Target,
  Sparkles,
  ShieldCheck,
  Building2,
  Lock,
  TrendingUp,
  Compass,
  Briefcase,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import CompanyMatchCard from "@/components/target-company/CompanyMatchCard";
import NotYetEligibleCard from "@/components/target-company/NotYetEligibleCard";
import CompanyDetailModal from "@/components/target-company/CompanyDetailModal";
import CompanyBrowserModal from "@/components/target-company/CompanyBrowserModal";
import { motion } from "framer-motion";
import { formatTimeAgo } from "@/lib/dateUtils";

export default function TargetCompanyPage() {
  const { data, isLoading, error, selectCompany, removeCompany, refresh } =
    useTargetCompanies();

  const [selectedCompanyDetail, setSelectedCompanyDetail] =
    useState<CompanyProfileDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isBrowserModalOpen, setIsBrowserModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSelectingCompany, setIsSelectingCompany] = useState<string | null>(null);

  const handleViewCompany = async (company_id: string) => {
    setIsDetailLoading(true);
    setIsDetailModalOpen(true);
    try {
      const profile = await getCompanyProfile(company_id);
      setSelectedCompanyDetail(profile);
    } catch {
      toast.error("Failed to load corporate profile details");
      setIsDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSelectFromBrowser = async (company_id: string) => {
    setIsSelectingCompany(company_id);
    try {
      const result = await selectCompany(company_id);
      toast.success(`${result.name} added to your target portfolio!`);
      if (result.missing_skills.length > 0) {
        toast.info(
          `Skill Gap Identified: Focus on ${result.missing_skills.slice(0, 2).join(", ")}. Check your roadmap to close this gap.`,
          { duration: 5000 }
        );
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add company");
    } finally {
      setIsSelectingCompany(null);
    }
  };

  const handleRemoveCompany = async (company_id: string, company_name: string) => {
    try {
      await removeCompany(company_id);
      toast.success(`${company_name} removed from your targets`);
    } catch {
      toast.error("Failed to remove target company");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Target className="w-7 h-7 animate-pulse" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-sky-400 absolute -bottom-1 -right-1" />
        </div>
        <p className="text-sm font-medium text-slate-400">
          Calculating real-time AI skill alignments across target companies…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Target className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Target Companies Unavailable</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-xl text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  const {
    student_score = 0,
    student_role = "",
    selected_companies = [],
    auto_suggested = [],
    companies_not_yet_eligible = [],
    last_updated_at,
  } = data || {};

  // Compute aggregate stats
  const avgMatch = selected_companies.length > 0
    ? Math.round(selected_companies.reduce((acc, c) => acc + (c.skill_match_pct || 0), 0) / selected_companies.length)
    : 0;

  const totalOpenings = selected_companies.reduce((acc, c) => acc + (c.active_openings || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/90 p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-inner">
                <Target className="w-7 h-7 text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Target Companies
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Track your real-time AI skill readiness for dream hiring partners
                </p>
              </div>
            </div>

            {/* Student Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Score: <strong className="text-emerald-400 font-bold">{student_score}</strong>
              </span>

              {student_role && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 font-medium capitalize">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  Track: <strong className="text-sky-400">{student_role}</strong>
                </span>
              )}

              {last_updated_at && (
                <span className="text-slate-500 text-[11px] font-mono">
                  &bull; Synced {formatTimeAgo(last_updated_at)}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={refresh}
              title="Refresh match calculations"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition-all shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsBrowserModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/25 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Add Target Company</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-6 mt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Active Targets
            </span>
            <span className="text-xl sm:text-2xl font-black text-white">
              {selected_companies.length}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Avg. AI Skill Fit
            </span>
            <span className="text-xl sm:text-2xl font-black text-sky-400">
              {avgMatch}%
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Active Openings
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400">
              {totalOpenings} Roles
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Unlockable Targets
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-400">
              {companies_not_yet_eligible.length}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Selected Target Companies */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Your Target Portfolio
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-full">
              {selected_companies.length}
            </span>
          </div>

          {selected_companies.length > 0 && (
            <button
              onClick={() => setIsBrowserModalOpen(true)}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
            >
              <span>Explore More Partners</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {selected_companies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-10 sm:p-14 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center text-slate-500">
              <Target className="w-8 h-8 text-slate-500" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">
                No Target Companies Selected
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Choose top enterprise tech teams and startups you aim to join. SkillDipz will compute your live AI skill fit and bridge the gaps.
              </p>
            </div>
            <button
              onClick={() => setIsBrowserModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/25 transition-all hover:scale-105"
            >
              <Compass className="w-4 h-4" />
              <span>Browse & Target Companies</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {selected_companies.map((company) => (
              <CompanyMatchCard
                key={company.company_id}
                company={company}
                onViewCompany={() => handleViewCompany(company.company_id)}
                onRemove={() =>
                  handleRemoveCompany(company.company_id, company.name)
                }
                showRemoveButton
              />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2: AI-Suggested Matches */}
      {auto_suggested.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                AI-Discovered High Match Companies
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full">
                {auto_suggested.length} Auto-Matches
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Discovered from your verified skills and domain performance that you haven&apos;t targeted yet.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {auto_suggested.map((company) => (
              <CompanyMatchCard
                key={company.company_id}
                company={company}
                onViewCompany={() => handleViewCompany(company.company_id)}
                onSelect={() => handleSelectFromBrowser(company.company_id)}
                isSelecting={isSelectingCompany === company.company_id}
                showSelectButton
                badgeText="AI Auto-Match"
              />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: Improve to Unlock */}
      {companies_not_yet_eligible.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Benchmark Targets & Unlock Roadmap
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full">
                {companies_not_yet_eligible.length} Locked
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Close these score and skill gaps on your roadmap to become eligible for direct interview invites.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {companies_not_yet_eligible.map((company) => (
              <NotYetEligibleCard key={company.company_id} company={company} />
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      <CompanyDetailModal
        isOpen={isDetailModalOpen}
        isLoading={isDetailLoading}
        company={selectedCompanyDetail}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedCompanyDetail(null);
        }}
      />

      <CompanyBrowserModal
        isOpen={isBrowserModalOpen}
        studentRole={student_role}
        selectedCompanyIds={
          new Set(selected_companies.map((c) => c.company_id))
        }
        onSelect={handleSelectFromBrowser}
        isSelecting={isSelectingCompany}
        onClose={() => setIsBrowserModalOpen(false)}
      />
    </div>
  );
}
