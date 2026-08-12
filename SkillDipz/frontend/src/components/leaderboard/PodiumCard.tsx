import type { Top3Entry } from "@/lib/leaderboardApi";
import { BookOpen, Flame, FolderOpen, Medal, Trophy, Award } from "lucide-react";

interface Props {
  entry: Top3Entry;
  center?: boolean;
}

export function PodiumCard({ entry, center = false }: Props) {
  const isFirst = entry.rank === 1;
  const isSecond = entry.rank === 2;

  // Decent, refined color palette per rank
  const rankConfig = isFirst
    ? {
        label: "1st Place",
        medalEmoji: "🥇",
        badgeStyle: "bg-amber-400/10 text-amber-300 border-amber-400/30",
        avatarRing: "ring-4 ring-amber-400/40 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950",
        cardBorder: "border-amber-400/30 hover:border-amber-400/60 shadow-amber-500/10",
        cardBg: "bg-gradient-to-b from-amber-500/5 via-slate-900/90 to-slate-950/95",
        scoreColor: "text-amber-400",
        icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />,
      }
    : isSecond
    ? {
        label: "2nd Place",
        medalEmoji: "🥈",
        badgeStyle: "bg-slate-300/10 text-slate-200 border-slate-300/30",
        avatarRing: "ring-4 ring-slate-300/30 bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950",
        cardBorder: "border-slate-400/20 hover:border-slate-300/40 shadow-slate-400/5",
        cardBg: "bg-gradient-to-b from-slate-400/5 via-slate-900/90 to-slate-950/95",
        scoreColor: "text-slate-200",
        icon: <Medal className="w-3.5 h-3.5 text-slate-300" />,
      }
    : {
        label: "3rd Place",
        medalEmoji: "🥉",
        badgeStyle: "bg-amber-700/10 text-amber-300 border-amber-700/30",
        avatarRing: "ring-4 ring-amber-600/30 bg-gradient-to-br from-amber-600 to-amber-800 text-white",
        cardBorder: "border-amber-700/25 hover:border-amber-600/45 shadow-amber-700/5",
        cardBg: "bg-gradient-to-b from-amber-700/5 via-slate-900/90 to-slate-950/95",
        scoreColor: "text-amber-300",
        icon: <Award className="w-3.5 h-3.5 text-amber-500" />,
      };

  return (
    <div
      className={`
        relative flex flex-col items-center p-5 sm:p-6 rounded-2xl border backdrop-blur-xl
        transition-all duration-300 hover:-translate-y-1 shadow-xl w-full
        ${rankConfig.cardBorder} ${rankConfig.cardBg}
        ${center ? "scale-[1.02] z-10" : "z-0"}
      `}
    >
      {/* Top Rank Badge with Medal Icon */}
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-4 ${rankConfig.badgeStyle}`}>
        <span>{rankConfig.medalEmoji}</span>
        <span>{rankConfig.label}</span>
      </div>

      {/* Avatar with Metallic Ring */}
      <div className="relative mb-3">
        <div
          className={`
            w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center
            text-xl font-black shadow-lg ${rankConfig.avatarRing}
          `}
        >
          {entry.avatar_initials}
        </div>
      </div>

      {/* Student Details */}
      <div className="text-center w-full min-w-0 mb-3">
        <h3 className="text-sm sm:text-base font-bold text-white truncate tracking-tight">
          {entry.name}
        </h3>
        {entry.college && (
          <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
            {entry.college}
          </p>
        )}
        {entry.target_role && (
          <span className="inline-block text-[10px] font-medium text-sky-300 bg-sky-500/10 border border-sky-500/25 px-2.5 py-0.5 rounded-full mt-1.5">
            {entry.target_role}
          </span>
        )}
      </div>

      {/* Employability Score Display */}
      <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 text-center mb-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
          Employability Score
        </p>
        <p className={`text-2xl sm:text-3xl font-extrabold ${rankConfig.scoreColor}`}>
          {entry.overall_score.toFixed(1)}
        </p>
      </div>

      {/* Activity Stats Footer */}
      <div className="grid grid-cols-3 gap-2 w-full pt-3 border-t border-slate-800/80">
        <div className="flex flex-col items-center bg-slate-950/40 border border-slate-800/60 rounded-lg py-1.5 px-1">
          <BookOpen className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
          <span className="text-xs font-bold text-white">{entry.assessments_taken}</span>
          <span className="text-[9px] text-slate-400">Tests</span>
        </div>
        <div className="flex flex-col items-center bg-slate-950/40 border border-slate-800/60 rounded-lg py-1.5 px-1">
          <FolderOpen className="w-3.5 h-3.5 text-purple-400 mb-0.5" />
          <span className="text-xs font-bold text-white">{entry.projects_completed}</span>
          <span className="text-[9px] text-slate-400">Projects</span>
        </div>
        <div className="flex flex-col items-center bg-slate-950/40 border border-slate-800/60 rounded-lg py-1.5 px-1">
          <Flame className="w-3.5 h-3.5 text-orange-400 mb-0.5" />
          <span className="text-xs font-bold text-white">{entry.current_streak}d</span>
          <span className="text-[9px] text-slate-400">Streak</span>
        </div>
      </div>
    </div>
  );
}

