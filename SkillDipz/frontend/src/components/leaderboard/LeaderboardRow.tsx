import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/leaderboardApi";
import { rankBadgeStyle, scoreColor } from "./leaderboardHelpers";
import { MiniBar } from "./MiniBar";
import {
  ChevronRight,
  ChevronDown,
  Crown,
  Medal,
  Award,
  BookOpen,
  FolderOpen,
  Flame,
} from "lucide-react";

const SCORE_BREAKDOWN = [
  { key: "resume_quality", label: "Resume", cls: "text-amber-400" },
  { key: "assessment_score", label: "Assessments", cls: "text-sky-400" },
  { key: "project_strength", label: "Projects", cls: "text-purple-400" },
  { key: "interview_readiness", label: "Interviews", cls: "text-rose-400" },
  { key: "activity_consistency", label: "Consistency", cls: "text-emerald-400" },
] as const;

interface Props {
  entry: LeaderboardEntry;
  onSelectCandidate?: (studentId: string) => void;
}

export function LeaderboardRow({ entry, onSelectCandidate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const badge = rankBadgeStyle(entry.rank);

  const renderRankIcon = () => {
    if (entry.rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-md shadow-amber-500/10">
          <Crown className="w-4 h-4" />
        </div>
      );
    }
    if (entry.rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-slate-300/15 border border-slate-300/30 text-slate-200 flex items-center justify-center shadow-md shadow-slate-300/10">
          <Medal className="w-4 h-4" />
        </div>
      );
    }
    if (entry.rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-700/20 border border-amber-600/40 text-amber-400 flex items-center justify-center shadow-md shadow-amber-700/10">
          <Award className="w-4 h-4" />
        </div>
      );
    }
    return (
      <span className="text-xs font-bold text-sky-400 font-mono tracking-tight">
        #{entry.rank}
      </span>
    );
  };

  const handleRowClick = () => {
    if (onSelectCandidate) {
      onSelectCandidate(entry.student_id);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div className="space-y-1.5">
      <div
        onClick={handleRowClick}
        className={`
          group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl
          border border-slate-800/80 bg-[#090f1d]/85 hover:bg-slate-850/95 hover:border-slate-700
          transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl
          ${entry.is_me ? "bg-sky-500/10 border-sky-500/40" : ""}
          ${entry.rank <= 3 ? "border-slate-800" : ""}
        `}
      >
        {/* Left: Rank + Avatar + Name + Subtitle */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Rank Badge */}
          <div className="w-10 sm:w-12 flex items-center justify-center shrink-0">
            {renderRankIcon()}
          </div>

          {/* Avatar with Initials */}
          <div
            className={`
              w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center
              text-xs sm:text-sm font-bold text-white shrink-0 shadow-md
              ${
                entry.rank === 1
                  ? "bg-linear-to-br from-amber-400 to-yellow-600 text-slate-950 font-black"
                  : entry.rank === 2
                  ? "bg-linear-to-br from-slate-200 to-slate-400 text-slate-950 font-black"
                  : entry.rank === 3
                  ? "bg-linear-to-br from-amber-600 to-amber-900 text-white font-black"
                  : "bg-linear-to-br from-sky-500 to-indigo-600"
              }
            `}
          >
            {entry.avatar_initials}
          </div>

          {/* Candidate Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                {entry.name}
              </h4>
              {entry.is_me && (
                <span className="text-[9px] font-bold bg-sky-500 text-white px-2 py-0.5 rounded-full">
                  YOU
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
              {[entry.college, entry.target_role || entry.branch]
                .filter(Boolean)
                .join(" · ") || "Verified Candidate"}
            </p>
          </div>
        </div>

        {/* Middle/Right: Activity badges (Desktop) */}
        <div className="hidden lg:flex items-center gap-2.5 mr-6 shrink-0">
          {entry.assessments_taken > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-lg">
              <BookOpen className="w-3 h-3" />
              {entry.assessments_taken} Tests Checked
            </span>
          )}
          {entry.projects_completed > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
              <FolderOpen className="w-3 h-3" />
              {entry.projects_completed} Projects Evaluated
            </span>
          )}
          {entry.current_streak > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
              <Flame className="w-3 h-3" />
              {entry.current_streak}d
            </span>
          )}
        </div>

        {/* Right: Score + Tests Checked + Arrow */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="text-right">
            <p
              className={`text-base sm:text-xl font-black tracking-tight ${scoreColor(
                entry.overall_score
              )}`}
            >
              {entry.overall_score.toFixed(0)}%
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              {entry.assessments_taken} TESTS CHECKED
            </p>
          </div>

          {/* Quick breakdown toggle or modal trigger */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Toggle component breakdown"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Score Breakdown Bar */}
      {expanded && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 mx-2 animate-in fade-in-0 zoom-in-98 duration-150">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              AI Employability Assessment Breakdown
            </span>
            {onSelectCandidate && (
              <button
                type="button"
                onClick={() => onSelectCandidate(entry.student_id)}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
              >
                Open Full Candidate Profile & Interview
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {SCORE_BREAKDOWN.map(({ key, label, cls }) => {
              const val = entry[key as keyof LeaderboardEntry] as number;
              return (
                <div
                  key={key}
                  className="bg-slate-950/60 border border-white/5 rounded-xl p-2.5 flex flex-col gap-1"
                >
                  <span className="text-[10px] text-slate-400 font-medium">
                    {label}
                  </span>
                  <div className="flex items-center justify-between">
                    <MiniBar value={val} />
                    <span className={`text-xs font-bold ${cls} ml-2`}>
                      {val.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
