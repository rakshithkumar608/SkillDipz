"use client";

import React from "react";
import {
  X,
  Globe,
  MapPin,
  Loader2,
  Building2,
  Briefcase,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Calendar,
  Lightbulb,
  ExternalLink,
  Layers,
} from "lucide-react";
import type { CompanyProfileDetail } from "@/types/targetCompany";
import { motion, AnimatePresence } from "framer-motion";

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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-gradient-to-b from-[#0D1322] via-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl scrollbar-thin scrollbar-thumb-slate-800"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-20 border border-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-80 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-sm text-slate-400 font-medium">
                Fetching verified corporate dossier…
              </p>
            </div>
          ) : company ? (
            <div>
              {/* Header Hero Banner */}
              <div className="p-6 sm:p-8 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-900/40 border-b border-slate-800/80 relative">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 p-2 flex items-center justify-center flex-shrink-0 shadow-xl">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <span className="text-3xl sm:text-4xl select-none">
                        {company.logo_emoji || "🏢"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0 pr-8">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        {company.name}
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <ShieldCheck className="w-3 h-3" />
                        Verified Partner
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-400 font-medium">
                      {company.industry}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                      {company.headquarters && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {company.headquarters}
                        </span>
                      )}
                      {company.website && (
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors font-medium"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Min. Score Benchmark
                    </span>
                    <span className="text-lg font-bold text-white">
                      {company.min_score} <span className="text-xs font-normal text-slate-500">/ 100</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Active Openings
                    </span>
                    <span className="text-lg font-bold text-emerald-400">
                      {company.active_openings} {company.active_openings === 1 ? "Role" : "Roles"}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Interview Rounds
                    </span>
                    <span className="text-lg font-bold text-sky-400">
                      {company.interview_rounds.length} Stages
                    </span>
                  </div>
                </div>

                {/* About Company */}
                {company.description && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Corporate Overview
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {company.description}
                    </p>
                  </div>
                )}

                {/* Required & Nice-to-Have Skills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Must Have Skills */}
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Must-Have Competencies
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {company.must_have_skills.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Nice to Have Skills */}
                  {company.nice_to_have_skills.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Bonus Skills
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {company.nice_to_have_skills.map((s) => (
                          <span
                            key={s}
                            className="px-2.5 py-1 text-xs bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-lg font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Interview Hiring Process Visual Stepper */}
                {company.interview_rounds.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      Evaluation & Interview Pipeline
                    </h3>
                    <div className="space-y-2.5">
                      {company.interview_rounds.map((round, idx) => (
                        <div
                          key={round.order || idx}
                          className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">
                                {round.name}
                              </p>
                              {round.duration_mins && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  ~{round.duration_mins} mins
                                </span>
                              )}
                            </div>
                            {round.description && (
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                {round.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recruiter Insider Prep Tips */}
                {company.interview_tips && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      Recruiter & Tech Lead Insider Tips
                    </h3>
                    <p className="text-xs text-amber-200/90 leading-relaxed whitespace-pre-wrap font-sans">
                      {company.interview_tips}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm">
              Company profile details could not be loaded.
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}