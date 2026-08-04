"use client";

import type { JobCard as JobCardType } from "@/types/jobs";
import {
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CalendarDays,
  Briefcase,
} from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  job: JobCardType;
  onViewDetails: () => void;
  onApply: () => void;
  isApplying?: boolean;
}

function getMatchColor(pct: number) {
  if (pct >= 80) return { ring: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" };
  if (pct >= 60) return { ring: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-400" };
  if (pct >= 40) return { ring: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" };
  return { ring: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" };
}

function getWorkModeLabel(mode?: string) {
  if (!mode) return null;
  const map: Record<string, { label: string; color: string }> = {
    remote: { label: "Remote", color: "text-emerald-400 bg-emerald-500/10" },
    hybrid: { label: "Hybrid", color: "text-sky-400 bg-sky-500/10" },
    office: { label: "On-site", color: "text-amber-400 bg-amber-500/10" },
  };
  return map[mode.toLowerCase()] || { label: mode, color: "text-slate-400 bg-slate-500/10" };
}

function formatDeadline(deadline?: string) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Expired", urgent: true };
  if (diffDays <= 7) return { text: `${diffDays}d left`, urgent: true };
  return { text: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), urgent: false };
}

export default function JobCard({ job, onViewDetails, onApply, isApplying }: Props) {
  const matchColor = getMatchColor(job.profile_match_pct);
  const workMode = getWorkModeLabel(job.work_mode);
  const deadline = formatDeadline(job.deadline);

  // Score display
  const scoreDisplay = job.min_score > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 overflow-hidden"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full ${matchColor.bg} blur-3xl`} />
      </div>

      <div className="relative p-5">
        {/* Header Row: Company + Match Ring */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Company Logo/Emoji */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700/80 to-slate-800/80 border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-lg shadow-lg">
              {job.company_logo_emoji || "🏢"}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{job.company_name}</p>
              <h3 className="text-[15px] font-semibold text-white truncate leading-tight mt-0.5">
                {job.title}
              </h3>
            </div>
          </div>

          {/* Match % Ring */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`relative w-14 h-14 flex items-center justify-center rounded-full ${matchColor.bg} border ${matchColor.border}`}>
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/[0.06]" />
                <circle
                  cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3"
                  className={matchColor.ring}
                  strokeDasharray={`${(job.profile_match_pct / 100) * 150.8} 150.8`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`text-sm font-bold ${matchColor.text}`}>
                {Math.round(job.profile_match_pct)}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Match</span>
          </div>
        </div>

        {/* Meta Row */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          {job.location && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300">
              <MapPin className="w-3 h-3 text-slate-500" />
              {job.location}
            </span>
          )}
          {workMode && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${workMode.color}`}>
              {workMode.label}
            </span>
          )}
          {job.ctc_range && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              💰 {job.ctc_range}
            </span>
          )}
          {job.experience && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300">
              <Briefcase className="w-3 h-3 text-slate-500" />
              {job.experience}
            </span>
          )}
        </div>

        {/* Skills */}
        {job.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {job.required_skills.slice(0, 6).map((skill) => {
              const isMatched = job.matched_skills
                .map((s) => s.toLowerCase())
                .includes(skill.toLowerCase());
              return (
                <span
                  key={skill}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                    isMatched
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {isMatched ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {skill}
                </span>
              );
            })}
            {job.required_skills.length > 6 && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800/60 text-slate-500">
                +{job.required_skills.length - 6} more
              </span>
            )}
          </div>
        )}

        {/* Score + Deadline Row */}
        <div className="flex items-center justify-between mb-4 text-xs">
          <div className="flex items-center gap-3">
            {scoreDisplay && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                  job.eligible
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                Score: {job.min_score}
                {job.eligible ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
              </span>
            )}
            {deadline && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                  deadline.urgent
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-slate-800/60 text-slate-400"
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                {deadline.text}
              </span>
            )}
          </div>
          {job.openings_count > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Users className="w-3 h-3" />
              {job.openings_count} opening{job.openings_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onViewDetails}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800/60 border border-white/[0.06] hover:bg-slate-700/60 hover:text-white hover:border-white/[0.1] transition-all"
          >
            View Details
          </button>

          {job.already_applied ? (
            <button
              disabled
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 cursor-default flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Applied
            </button>
          ) : job.eligible ? (
            <button
              onClick={onApply}
              disabled={isApplying}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isApplying ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Apply Now
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-amber-400/80 bg-amber-500/10 border border-amber-500/15 cursor-not-allowed flex items-center justify-center gap-1.5"
              title={`Improve your score by ${Math.ceil(job.min_score)} pts to apply`}
            >
              <Sparkles className="w-4 h-4" />
              Improve Score
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
