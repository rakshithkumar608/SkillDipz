"use client";

import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  Plus,
  Briefcase,
} from "lucide-react";
import type { MatchedCompany } from "@/types/targetCompany";

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
    icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    color: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-700/30",
  },
  eligible: {
    icon: <CheckCircle className="w-4 h-4 text-blue-400" />,
    color: "text-blue-400",
    bg: "bg-blue-950/40 border-blue-700/30",
  },
  skill_gap: {
    icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
    color: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-700/30",
  },
  not_yet: {
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    color: "text-red-400",
    bg: "bg-red-950/40 border-red-700/30",
  },
};

function SkillBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${colorClass}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

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

  return (
    <div
      className={`relative rounded-xl border p-5 space-y-4 transition-all hover:shadow-lg hover:shadow-indigo-900/20 ${status.bg}`}
    >
      {badgeText && (
        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 bg-indigo-900/60 text-indigo-300 border border-indigo-700/40 rounded-full">
          {badgeText}
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-10 h-10 object-contain rounded"
            />
          ) : (
            company.logo_emoji || "🏢"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-base truncate">
              {company.name}
            </h3>
            {status.icon}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {company.industry}
            {company.headquarters && ` · ${company.headquarters}`}
          </p>
        </div>
      </div>

      {/* Match Score Bars */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Skill Match</span>
            <span className={status.color}>
              {company.skill_match_pct.toFixed(0)}%
            </span>
          </div>
          <SkillBar
            pct={company.skill_match_pct}
            colorClass={
              company.skill_match_pct >= 80
                ? "bg-emerald-500"
                : company.skill_match_pct >= 50
                ? "bg-amber-500"
                : "bg-red-500"
            }
          />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Score</span>
            <span className={company.eligible ? "text-emerald-400" : "text-red-400"}>
              {company.your_score}/{company.min_score}
              {company.eligible ? " ✅" : " ❌"}
            </span>
          </div>
          <SkillBar
            pct={company.score_readiness_pct}
            colorClass={company.eligible ? "bg-emerald-500" : "bg-red-500"}
          />
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-1.5">
        {company.matched_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.matched_skills.slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 rounded-full"
              >
                ✓ {s}
              </span>
            ))}
          </div>
        )}
        {company.missing_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.missing_skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 bg-red-900/40 border border-red-700/40 text-red-300 rounded-full"
              >
                ✗ {s}
              </span>
            ))}
            {company.missing_skills.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">
                +{company.missing_skills.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Interview Rounds */}
      {company.interview_rounds.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Interview Process:</p>
          <div className="flex flex-wrap gap-1">
            {company.interview_rounds.map((round) => (
              <span
                key={round.order}
                className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700"
              >
                {round.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Briefcase className="w-3.5 h-3.5" />
          <span>
            {company.active_openings} open position
            {company.active_openings !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          {showRemoveButton && onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 text-slate-500 hover:text-red-400 transition rounded"
              title="Remove from targets"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {showSelectButton && onSelect && (
            <button
              onClick={onSelect}
              disabled={isSelecting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-60"
            >
              {isSelecting ? (
                <span className="animate-pulse">Adding…</span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Add
                </>
              )}
            </button>
          )}
          <button
            onClick={onViewCompany}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View
          </button>
        </div>
      </div>
    </div>
  );
}