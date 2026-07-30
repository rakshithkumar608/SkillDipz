"use client";

import { useState } from "react";
import { useTargetCompanies } from "@/hooks/useTargetCompanies";
import { listVerifiedCompanies, getCompanyProfile } from "@/lib/targetCompanyApi";
import type {
  MatchedCompany,
  NotYetEligibleCompany,
  CompanyProfileDetail,
  VerifiedCompany,
} from "@/types/targetCompany";
import { Loader2, Plus, RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";
import CompanyMatchCard from "@/components/target-company/CompanyMatchCard";
import NotYetEligibleCard from "@/components/target-company/NotYetEligibleCard";
import CompanyDetailModal from "@/components/target-company/CompanyDetailModal";
import CompanyBrowserModal from "@/components/target-company/CompanyBrowserModal";

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
      toast.error("Failed to load company profile");
      setIsDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSelectFromBrowser = async (company_id: string) => {
    setIsSelectingCompany(company_id);
    try {
      const result = await selectCompany(company_id);
      toast.success(`${result.name} added to your target list!`);
      if (result.missing_skills.length > 0) {
        toast.info(
          `You're missing: ${result.missing_skills.slice(0, 2).join(", ")}. Check your roadmap.`,
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
      toast.success(`${company_name} removed from your target list`);
    } catch {
      toast.error("Failed to remove company");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-400">Loading your matched companies...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700"
        >
          <RefreshCw className="w-4 h-4" /> Retry
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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Target className="w-7 h-7 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Target Companies</h1>
          </div>
          <p className="text-slate-400 mt-1 text-sm">
            Your score:{" "}
            <span className="text-indigo-400 font-semibold">{student_score}</span>
            {" · "}Role:{" "}
            <span className="text-indigo-400 font-semibold capitalize">
              {student_role}
            </span>
            {last_updated_at && (
              <span className="ml-2 text-slate-500 text-xs">
                · Updated {new Date(last_updated_at).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setIsBrowserModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium text-white transition"
          >
            <Plus className="w-4 h-4" /> Add Company
          </button>
        </div>
      </div>

      {/* Selected Companies */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Your Target Companies
          <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-900 text-indigo-300 rounded-full">
            {selected_companies.length}
          </span>
        </h2>

        {selected_companies.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center">
            <Target className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400 text-sm">
              You haven't selected any target companies yet.
            </p>
            <button
              onClick={() => setIsBrowserModalOpen(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium text-white transition"
            >
              Browse Companies →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* Auto-Suggested Companies */}
      {auto_suggested.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">
            ✨ Companies You Might Not Know About
          </h2>
          <p className="text-slate-500 text-xs mb-4">
            Platform found these matches based on your resume — you haven't
            selected them yet.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {auto_suggested.map((company) => (
              <CompanyMatchCard
                key={company.company_id}
                company={company}
                onViewCompany={() => handleViewCompany(company.company_id)}
                onSelect={() => handleSelectFromBrowser(company.company_id)}
                isSelecting={isSelectingCompany === company.company_id}
                showSelectButton
                badgeText="Auto-Match"
              />
            ))}
          </div>
        </section>
      )}

      {/* Improve to Unlock */}
      {companies_not_yet_eligible.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">
            🔒 Improve to Unlock
          </h2>
          <p className="text-slate-500 text-xs mb-4">
            Increase your employability score to become eligible for these
            companies.
          </p>
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
