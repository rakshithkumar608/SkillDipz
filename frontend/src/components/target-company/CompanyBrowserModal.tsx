"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2, CheckCircle, Plus } from "lucide-react";
import { listVerifiedCompanies } from "@/lib/targetCompanyApi";
import type { VerifiedCompany } from "@/types/targetCompany";

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
  const [filterAll, setFilterAll] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await listVerifiedCompanies(
          filterAll ? undefined : studentRole
        );
        setCompanies(data);
      } catch {
        // Silent — empty list
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, filterAll, studentRole]);

  if (!isOpen) return null;

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Browse Companies</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setFilterAll(true)}
              className={`px-3 py-1.5 rounded-full border transition ${
                filterAll
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              All Companies
            </button>
            <button
              onClick={() => setFilterAll(false)}
              className={`px-3 py-1.5 rounded-full border transition ${
                !filterAll
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              Matching My Role
            </button>
          </div>
        </div>

        {/* Company List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No companies found matching your search.
            </div>
          ) : (
            filtered.map((company) => {
              const isSelected = selectedCompanyIds.has(company.company_id);
              const isCurrentlySelecting =
                isSelecting === company.company_id;

              return (
                <div
                  key={company.company_id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-slate-600 transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl flex-shrink-0">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-8 h-8 object-contain rounded"
                      />
                    ) : (
                      company.logo_emoji || "🏢"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {company.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {company.industry}
                      {company.headquarters && ` · ${company.headquarters}`}
                    </p>
                    {company.must_have_skills.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Needs:{" "}
                        {company.must_have_skills.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-slate-500">
                      Min: {company.min_score}
                    </span>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelect(company.company_id)}
                        disabled={isCurrentlySelecting}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-60"
                      >
                        {isCurrentlySelecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Select
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
      </div>
    </div>
  );
}
