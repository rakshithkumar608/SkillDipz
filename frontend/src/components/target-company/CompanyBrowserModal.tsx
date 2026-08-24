"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Loader2,
  CheckCircle2,
  Plus,
  Building2,
  Briefcase,
  MapPin,
  Sparkles,
  Layers,
  Filter,
} from "lucide-react";
import { listVerifiedCompanies } from "@/lib/targetCompanyApi";
import type { VerifiedCompany } from "@/types/targetCompany";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isOpen: boolean;
  studentRole: string;
  selectedCompanyIds: Set<string>;
  onSelect: (company_id: string) => void;
  isSelecting: string | null;
  onClose: () => void;
}

export default function CompanyBrowserModal({
  isOpen,
  studentRole,
  selectedCompanyIds,
  onSelect,
  isSelecting,
  onClose,
}: Props) {
  const [companies, setCompanies] = useState<VerifiedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "role">("all");

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await listVerifiedCompanies(
          filterMode === "role" ? studentRole : undefined
        );
        setCompanies(data || []);
      } catch {
        setCompanies([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, filterMode, studentRole]);

  if (!isOpen) return null;

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.industry.toLowerCase().includes(q) ||
      (c.headquarters && c.headquarters.toLowerCase().includes(q)) ||
      (c.must_have_skills && c.must_have_skills.some((s) => s.toLowerCase().includes(q)))
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl bg-gradient-to-b from-[#0D1322] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Explore & Target Companies
                </h2>
                <p className="text-xs text-slate-400">
                  Select top enterprises to track real-time AI skill alignment
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Controls */}
          <div className="px-6 py-4 space-y-3 border-b border-slate-800/80 bg-slate-900/30">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search companies by name, industry, or required skill..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-3.5 py-1.5 rounded-xl font-medium border transition-all ${
                  filterMode === "all"
                    ? "bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-600/20"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                All Partner Corporates ({companies.length})
              </button>
              {studentRole && (
                <button
                  onClick={() => setFilterMode("role")}
                  className={`px-3.5 py-1.5 rounded-xl font-medium border transition-all flex items-center gap-1.5 ${
                    filterMode === "role"
                      ? "bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-600/20"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Matching My Role ({studentRole})</span>
                </button>
              )}
            </div>
          </div>

          {/* Company List Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                <p className="text-xs text-slate-400 font-medium">
                  Loading verified hiring partners…
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Building2 className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">
                  No companies found
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Try adjusting your search criteria to find available corporate partners.
                </p>
              </div>
            ) : (
              filtered.map((company) => {
                const isSelected = selectedCompanyIds.has(company.company_id);
                const isCurrentlySelecting = isSelecting === company.company_id;

                return (
                  <div
                    key={company.company_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-sky-500/40 transition-all duration-200 shadow-md group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/60 p-1 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:border-slate-600 transition-colors">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-full h-full object-contain rounded-lg"
                          />
                        ) : (
                          <span className="text-2xl select-none">
                            {company.logo_emoji || "🏢"}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm sm:text-base truncate group-hover:text-sky-300 transition-colors">
                            {company.name}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {company.industry}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {company.headquarters && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {company.headquarters}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <Briefcase className="w-3 h-3" />
                            Min. Score: {company.min_score}
                          </span>
                        </div>

                        {company.must_have_skills && company.must_have_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {company.must_have_skills.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 font-medium"
                              >
                                {s}
                              </span>
                            ))}
                            {company.must_have_skills.length > 3 && (
                              <span className="text-[10px] text-slate-500 px-1 py-0.5">
                                +{company.must_have_skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0 self-end sm:self-center">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Targeted
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelect(company.company_id)}
                          disabled={isCurrentlySelecting}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
                        >
                          {isCurrentlySelecting ? (
                            <span className="animate-pulse">Adding…</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Target Company</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
