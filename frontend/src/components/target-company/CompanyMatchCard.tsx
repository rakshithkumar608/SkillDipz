"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Plus,
  Briefcase,
  Sparkles,
  MapPin,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  Building2,
  Layers,
} from "lucide-react";
import type { MatchedCompany } from "@/types/targetCompany";
import { motion } from "framer-motion";

interface CompanyMatchCardProps {
  company: MatchedCompany;
  onViewCompany: () => void;
  onRemove?: () => void;
  onSelect?: () => void;
  isSelecting?: boolean;
  showRemoveButton?: boolean;
  showSelectButton?: boolean;
  badgeText?: string;
}

const statusConfig = {
  full_match: {
    label: "Full Match",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    glow: "group-hover:border-emerald-500/40 shadow-emerald-950/20",
    barColor: "bg-gradient-to-r from-emerald-500 to-teal-400",
  },
  eligible: {
    label: "Ready to Apply",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />,
    badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    glow: "group-hover:border-sky-500/40 shadow-sky-950/20",
    barColor: "bg-gradient-to-r from-sky-500 to-blue-500",
  },
  skill_gap: {
    label: "Skill Gap Identified",
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    glow: "group-hover:border-amber-500/40 shadow-amber-950/20",
    barColor: "bg-gradient-to-r from-amber-500 to-orange-400",
  },
  not_yet: {
    label: "Requires Improvement",
    icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
    badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    glow: "group-hover:border-rose-500/40 shadow-rose-950/20",
    barColor: "bg-gradient-to-r from-rose-500 to-red-500",
  },
};

export default function CompanyMatchCard({
  company,
  onViewCompany,
  onRemove,
  onSelect,
  isSelecting,
  showRemoveButton,
  showSelectButton,
  badgeText,
}: CompanyMatchCardProps) {
  const status = statusConfig[company.eligibility_status] ?? statusConfig.not_yet;
  const matchPct = Math.min(100, Math.max(0, company.skill_match_pct || 0));
  const readinessPct = Math.min(100, Math.max(0, company.score_readiness_pct || 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`group relative rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800/80 p-5 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all duration-300 ${status.glow}`}
    >
      {/* Decorative Top Accent Glow */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-500/20 to-transparent group-hover:via-sky-400/40 transition-colors" />

      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Company Logo or Initial */}
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 p-1 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:border-slate-600 transition-colors">
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

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  onClick={onViewCompany}
                  className="font-bold text-white text-base sm:text-lg truncate tracking-tight hover:text-sky-300 transition-colors cursor-pointer"
                >
                  {company.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="truncate">{company.industry}</span>
                {company.headquarters && (
                  <>
                    <span className="text-slate-600">&bull;</span>
                    <span className="flex items-center gap-1 text-slate-400 truncate">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {company.headquarters}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${status.badgeBg}`}
            >
              {status.icon}
              <span>{badgeText || status.label}</span>
            </span>
          </div>
        </div>

        {/* AI Match & Score Dual Metrics Bar */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 mb-4">
          {/* Metric 1: Skill Match */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
                <Sparkles className="w-3 h-3 text-sky-400" />
                AI Skill Fit
              </span>
              <span className="font-bold text-white text-xs">
                {matchPct.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${status.barColor}`}
                style={{ width: `${matchPct}%` }}
              />
            </div>
          </div>

          {/* Metric 2: Employability Score Benchmark */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Score Target
              </span>
              <span className="font-mono text-xs font-semibold text-slate-200">
                <span className={company.eligible ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {company.your_score}
                </span>
                <span className="text-slate-500"> / {company.min_score}</span>
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  company.eligible
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-amber-500 to-rose-500"
                }`}
                style={{ width: `${readinessPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Skill Alignment Tags */}
        <div className="space-y-2 mb-4">
          {/* Matched Skills */}
          {company.matched_skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] uppercase font-bold text-emerald-400/80 mr-1 tracking-wider">
                Matched:
              </span>
              {company.matched_skills.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg font-medium"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  {s}
                </span>
              ))}
              {company.matched_skills.length > 4 && (
                <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                  +{company.matched_skills.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Missing Skills / Growth Areas */}
          {company.missing_skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] uppercase font-bold text-amber-400/80 mr-1 tracking-wider">
                Gaps:
              </span>
              {company.missing_skills.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg font-medium"
                >
                  <XCircle className="w-2.5 h-2.5 text-rose-400" />
                  {s}
                </span>
              ))}
              {company.missing_skills.length > 3 && (
                <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                  +{company.missing_skills.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Interview Process Stepper Preview */}
        {company.interview_rounds.length > 0 && (
          <div className="pt-2.5 border-t border-slate-800/60 mb-4">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
                Evaluation Rounds ({company.interview_rounds.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {company.interview_rounds.map((round, idx) => (
                <div
                  key={round.order || idx}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/40 text-[11px] text-slate-300 whitespace-nowrap"
                >
                  <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{round.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between pt-3.5 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Briefcase className="w-3.5 h-3.5 text-sky-400" />
          <span>
            {company.active_openings} active opening{company.active_openings !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showRemoveButton && onRemove && (
            <button
              onClick={onRemove}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Remove from target companies"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {showSelectButton && onSelect && (
            <button
              onClick={onSelect}
              disabled={isSelecting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              {isSelecting ? (
                <span className="animate-pulse">Adding…</span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Target Company</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onViewCompany}
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 transition-all shadow-sm"
          >
            <span>Dossier</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}