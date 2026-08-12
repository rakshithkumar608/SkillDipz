import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/leaderboardApi";
import { MEDALS, rankGradient, scoreColor } from "./leaderboardHelpers";
import { MiniBar } from "./MiniBar";

const SCORE_BREAKDOWN = [
  { key: "resume_quality",       label: "Resume",      cls: "text-amber-400"  },
  { key: "assessment_score",     label: "Assessments", cls: "text-sky-400"    },
  { key: "project_strength",     label: "Projects",    cls: "text-purple-400" },
  { key: "interview_readiness",  label: "Interviews",  cls: "text-rose-400"   },
  { key: "activity_consistency", label: "Consistency", cls: "text-emerald-400"},
] as const;

interface Props {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Main row */}
      <tr
        onClick={() => setExpanded((v) => !v)}
        className={`
          border-b border-slate-800/60 hover:bg-white/3
          transition-colors cursor-pointer
          ${entry.is_me ? "bg-sky-500/10 border-sky-500/30" : ""}
        `}
      >
        {/* Rank */}
        <td className="px-3 sm:px-4 py-3 text-center">
          <span
            className={`
              inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8
              rounded-full text-xs font-black
              ${
                entry.rank <= 3
                  ? `bg-linear-to-br ${rankGradient(entry.rank)} text-white`
                  : "bg-slate-800 text-slate-300"
              }
            `}
          >
            {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
          </span>
        </td>

        {/* Student */}
        <td className="px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {entry.avatar_initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 flex-wrap">
                <span className="truncate max-w-25 sm:max-w-none">
                  {entry.name}
                </span>
                {entry.is_me && (
                  <span className="text-[9px] sm:text-[10px] bg-sky-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
                    YOU
                  </span>
                )}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate max-w-30 sm:max-w-50">
                {entry.college || "—"}
                {entry.branch ? ` · ${entry.branch}` : ""}
              </p>
            </div>
          </div>
        </td>

        {/* Role */}
        <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
          {entry.target_role ? (
            <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              {entry.target_role}
            </span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
        </td>

        {/* Score */}
        <td className="px-3 sm:px-4 py-3 text-center">
          <span className={`text-sm sm:text-base font-black ${scoreColor(entry.overall_score)}`}>
            {entry.overall_score}
          </span>
        </td>

        {/* Tests */}
        <td className="px-3 sm:px-4 py-3 text-center hidden lg:table-cell">
          <span className="text-xs sm:text-sm text-slate-300">
            {entry.assessments_taken}
          </span>
        </td>

        {/* Projects */}
        <td className="px-3 sm:px-4 py-3 text-center hidden lg:table-cell">
          <span className="text-xs sm:text-sm text-slate-300">
            {entry.projects_completed}
          </span>
        </td>

        {/* Assignments */}
        <td className="px-3 sm:px-4 py-3 text-center hidden xl:table-cell">
          <span className="text-xs sm:text-sm text-slate-300">
            {entry.assignments_completed}
          </span>
        </td>

        {/* Streak */}
        <td className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell">
          <span className="text-xs sm:text-sm text-orange-400 font-bold">
            🔥{entry.current_streak}d
          </span>
        </td>
      </tr>

      {/* Expanded score breakdown */}
      {expanded && (
        <tr className="bg-slate-900/50">
          <td colSpan={8} className="px-6 sm:px-8 py-3">
            <div className="flex flex-wrap gap-4 sm:gap-6">
              {SCORE_BREAKDOWN.map(({ key, label, cls }) => {
                const val = entry[key as keyof LeaderboardEntry] as number;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-20 sm:w-24">
                      {label}
                    </span>
                    <MiniBar value={val} />
                    <span className={`text-xs font-bold ${cls}`}>
                      {val.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
