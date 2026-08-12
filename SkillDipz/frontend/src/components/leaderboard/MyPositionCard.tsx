import { TrendingDown, TrendingUp, User } from "lucide-react";
import type { LeaderboardResponse } from "@/lib/leaderboardApi";
import { fmt, scoreColor } from "./leaderboardHelpers";

interface Props {
  data: LeaderboardResponse;
}

export function MyPositionCard({ data }: Props) {
  const d = data.my_rank_details;
  const change = d.rank_change_7d;

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 backdrop-blur-xl p-4 shadow-xl shadow-sky-500/10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">

      {/* Left — rank summary */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-linear-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30 shrink-0">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            You are ranked{" "}
            <span className="text-sky-400 text-base sm:text-lg font-black">
              #{fmt(d.rank)}
            </span>{" "}
            out of{" "}
            <span className="text-white font-bold">{fmt(d.total_students)}</span>{" "}
            students
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Score:{" "}
            <span className={`font-bold ${scoreColor(d.overall_score)}`}>
              {d.overall_score}
            </span>
            &nbsp;·&nbsp;Top{" "}
            <span className="text-white font-bold">
              {(100 - d.percentile).toFixed(2)}%
            </span>
          </p>
        </div>
      </div>

      {/* Right — extra stats */}
      <div className="flex gap-4 flex-wrap">
        {d.college_rank != null && (
          <div className="text-center">
            <p className="text-xs text-slate-400">College Rank</p>
            <p className="text-sm font-bold text-white">
              #{d.college_rank}
              <span className="text-slate-500 font-normal text-xs">
                /{d.college_total}
              </span>
            </p>
          </div>
        )}
        <div className="text-center">
          <p className="text-xs text-slate-400">7-day Change</p>
          <p
            className={`text-sm font-bold flex items-center gap-1 ${
              change > 0
                ? "text-emerald-400"
                : change < 0
                ? "text-rose-400"
                : "text-slate-400"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : change < 0 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : null}
            {change > 0 ? `+${change}` : change === 0 ? "—" : change} spots
          </p>
        </div>
      </div>
    </div>
  );
}
