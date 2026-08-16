import type { Top3Entry } from "@/lib/leaderboardApi";
import {
  BookOpen,
  Flame,
  FolderOpen,
  Medal,
  Award,
  Crown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { rankBadgeStyle } from "./leaderboardHelpers";

interface Props {
  entry: Top3Entry;
  center?: boolean;
  onSelect?: (studentId: string) => void;
}

export function PodiumCard({ entry, center = false, onSelect }: Props) {
  const isFirst = entry.rank === 1;
  const isSecond = entry.rank === 2;
  const badge = rankBadgeStyle(entry.rank);

  const rankConfig = isFirst
    ? {
        medalIcon: <Crown className="w-4 h-4 text-amber-300" />,
        ambientGlow: "from-amber-500/20 via-yellow-500/5 to-transparent",
        cardBorder: "border-amber-400/40 hover:border-amber-300 shadow-xl shadow-amber-500/10",
        avatarBorder: "border-2 border-amber-300 shadow-lg shadow-amber-500/30",
        avatarBg: "bg-linear-to-br from-amber-400 to-yellow-600 text-slate-950",
        scoreColor: "text-amber-300",
        scoreGlow: "text-shadow-amber",
        pillBg: "bg-amber-400/10 border-amber-400/30 text-amber-300",
      }
    : isSecond
    ? {
        medalIcon: <Medal className="w-4 h-4 text-slate-200" />,
        ambientGlow: "from-slate-300/15 via-slate-400/5 to-transparent",
        cardBorder: "border-slate-300/30 hover:border-slate-200 shadow-xl shadow-slate-300/10",
        avatarBorder: "border-2 border-slate-200 shadow-lg shadow-slate-300/20",
        avatarBg: "bg-linear-to-br from-slate-200 to-slate-400 text-slate-950",
        scoreColor: "text-slate-200",
        scoreGlow: "",
        pillBg: "bg-slate-300/10 border-slate-300/30 text-slate-200",
      }
    : {
        medalIcon: <Award className="w-4 h-4 text-amber-400" />,
        ambientGlow: "from-amber-700/15 via-amber-800/5 to-transparent",
        cardBorder: "border-amber-700/35 hover:border-amber-600 shadow-xl shadow-amber-700/10",
        avatarBorder: "border-2 border-amber-500 shadow-lg shadow-amber-700/20",
        avatarBg: "bg-linear-to-br from-amber-600 to-amber-900 text-white",
        scoreColor: "text-amber-400",
        scoreGlow: "",
        pillBg: "bg-amber-700/15 border-amber-600/30 text-amber-300",
      };

  return (
    <div
      onClick={() => onSelect?.(entry.student_id)}
      className={`
        group relative flex flex-col items-center p-5 sm:p-6 rounded-3xl border backdrop-blur-2xl
        transition-all duration-300 hover:-translate-y-1.5 cursor-pointer w-full bg-[#080d19]/90
        ${rankConfig.cardBorder}
        ${center ? "md:-translate-y-3 z-10 scale-[1.02]" : "z-0"}
      `}
    >
      {/* Ambient Top Glow */}
      <div
        className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-linear-to-b ${rankConfig.ambientGlow} rounded-full blur-2xl pointer-events-none`}
      />

      {/* Top Rank Badge */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-4 shadow-sm ${rankConfig.pillBg}`}
      >
        {rankConfig.medalIcon}
        <span>{badge.label}</span>
      </div>

      {/* Avatar */}
      <div className="relative mb-3.5">
        <div
          className={`
            w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center
            text-xl sm:text-2xl font-black transition-transform duration-300 group-hover:scale-105
            ${rankConfig.avatarBg} ${rankConfig.avatarBorder}
          `}
        >
          {entry.avatar_initials}
        </div>
        {isFirst && (
          <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Candidate Details */}
      <div className="text-center w-full min-w-0 mb-3">
        <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-sky-300 transition-colors truncate tracking-tight">
          {entry.name}
        </h3>
        <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
          {entry.college || "Verified Student"}
        </p>
        {entry.target_role && (
          <div className="mt-2">
            <span className="inline-block text-[11px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/25 px-3 py-0.5 rounded-full truncate max-w-full">
              {entry.target_role}
            </span>
          </div>
        )}
      </div>

      {/* Employability Score Display */}
      <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 text-center mb-4 group-hover:border-slate-700 transition-colors">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
          Employability Score
        </p>
        <p className={`text-2xl sm:text-3xl font-black tracking-tight ${rankConfig.scoreColor}`}>
          {entry.overall_score.toFixed(1)}%
        </p>
      </div>

      {/* Activity Stats Grid */}
      <div className="grid grid-cols-3 gap-2 w-full pt-3 border-t border-white/5">
        <div className="flex flex-col items-center bg-slate-950/60 border border-white/5 rounded-xl py-2 px-1">
          <BookOpen className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
          <span className="text-xs font-bold text-white">{entry.assessments_taken}</span>
          <span className="text-[9px] text-slate-400">Tests</span>
        </div>
        <div className="flex flex-col items-center bg-slate-950/60 border border-white/5 rounded-xl py-2 px-1">
          <FolderOpen className="w-3.5 h-3.5 text-purple-400 mb-0.5" />
          <span className="text-xs font-bold text-white">{entry.projects_completed}</span>
          <span className="text-[9px] text-slate-400">Projects</span>
        </div>
        <div className="flex flex-col items-center bg-slate-950/60 border border-white/5 rounded-xl py-2 px-1">
          <Flame className="w-3.5 h-3.5 text-orange-400 mb-0.5" />
          <span className="text-xs font-bold text-white">{entry.current_streak}d</span>
          <span className="text-[9px] text-slate-400">Streak</span>
        </div>
      </div>

      {/* View Candidate Link CTA */}
      <div className="w-full mt-3.5 pt-2.5 flex items-center justify-center gap-1 text-xs font-semibold text-sky-400 group-hover:text-sky-300 transition-colors">
        <span>View Full Profile</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}
