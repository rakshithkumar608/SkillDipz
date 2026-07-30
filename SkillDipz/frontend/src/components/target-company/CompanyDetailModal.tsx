"use client";

import { X, Globe, MapPin, Loader2 } from "lucide-react";
import type { CompanyProfileDetail } from "@/types/targetCompany";

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  company: CompanyProfileDetail | null;
  onClose: () => void;
}

export default function CompanyDetailModal({
  isOpen,
  isLoading,
  company,
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : company ? (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-3xl flex-shrink-0">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-14 h-14 object-contain rounded"
                  />
                ) : (
                  company.logo_emoji || "🏢"
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{company.name}</h2>
                <p className="text-slate-400 text-sm">{company.industry}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                  {company.headquarters && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {company.headquarters}
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-400 hover:underline"
                    >
                      <Globe className="w-3 h-3" /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {company.description && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">About</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {company.description}
                </p>
              </div>
            )}

            {/* Required Skills */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Required Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {company.must_have_skills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-1 text-xs bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Nice-to-Have */}
            {company.nice_to_have_skills.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">
                  Nice-to-Have
                </h3>
                <div className="flex flex-wrap gap-2">
                  {company.nice_to_have_skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Min Score */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-xl">
              <span className="text-sm text-slate-400">
                Min. Employability Score:
              </span>
              <span className="text-lg font-bold text-white">
                {company.min_score}
              </span>
              <span className="text-xs text-slate-500">
                · {company.active_openings} open positions
              </span>
            </div>

            {/* Interview Rounds */}
            {company.interview_rounds.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Interview Process
                </h3>
                <div className="space-y-2">
                  {company.interview_rounds.map((round, idx) => (
                    <div
                      key={round.order}
                      className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700/40"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {round.name}
                        </p>
                        {round.description && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {round.description}
                          </p>
                        )}
                        {round.duration_mins && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Duration: {round.duration_mins} mins
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interview Tips */}
            {company.interview_tips && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">
                  Interview Tips
                </h3>
                <div className="p-3 bg-amber-950/30 border border-amber-700/30 rounded-lg text-xs text-amber-200 leading-relaxed whitespace-pre-wrap">
                  {company.interview_tips}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500">
            Company not found
          </div>
        )}
      </div>
    </div>
  );
}