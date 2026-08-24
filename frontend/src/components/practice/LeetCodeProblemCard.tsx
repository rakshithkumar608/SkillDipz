"use client";

import { LeetCodeProblemSummary } from "@/lib/practiceApi";
import { CheckCircle2, Code2, ChevronRight, Zap, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  problem: LeetCodeProblemSummary;
  onSelect: () => void;
}

const DIFF_STYLES: Record<string, { badge: string; border: string }> = {
  EASY: {
    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    border: "hover:border-emerald-500/40",
  },
  MEDIUM: {
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    border: "hover:border-amber-500/40",
  },
  HARD: {
    badge: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    border: "hover:border-rose-500/40",
  },
};

export default function LeetCodeProblemCard({ problem, onSelect }: Props) {
  const isLocked = problem.is_unlocked === false;
  const styles = DIFF_STYLES[problem.difficulty] || DIFF_STYLES["MEDIUM"];

  const handleClick = () => {
    if (isLocked) {
      toast.info(problem.lock_reason || "This coding challenge is locked. Complete previous challenges or watch roadmap videos to unlock.");
      return;
    }
    onSelect();
  };

  return (
    <div
      onClick={handleClick}
      className={`group bg-slate-900/70 border ${
        isLocked ? "border-slate-800/40 opacity-75 cursor-not-allowed" : `border-white/5 ${styles.border} cursor-pointer hover:bg-slate-900/90`
      } rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-200 shadow-md hover:shadow-indigo-500/5`}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        {/* Title & Status */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isLocked ? (
            <div className="w-5 h-5 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-400 shrink-0">
              <Lock className="w-3 h-3" />
            </div>
          ) : problem.is_solved ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
          )}

          <h3 className={`font-bold text-sm transition-colors truncate ${isLocked ? "text-slate-400" : "text-white group-hover:text-indigo-300"}`}>
            {problem.title}
          </h3>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${styles.badge}`}
          >
            {problem.difficulty}
          </span>
        </div>

        {/* Concept Pill & Specs */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
            #{problem.concept}
          </span>

          <span className="text-[11px] text-slate-500 font-mono">
            Acceptance: {problem.acceptance_rate}%
          </span>

          <span className="text-[11px] text-slate-500 font-mono">
            {problem.test_cases_count} Test Cases
          </span>
        </div>

        {isLocked && problem.lock_reason && (
          <p className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 pt-0.5">
            <Lock className="w-2.5 h-2.5" />
            <span>{problem.lock_reason}</span>
          </p>
        )}
      </div>

      {/* CTA Button */}
      {isLocked ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-xs font-semibold shrink-0 flex items-center gap-1"
        >
          <Lock className="w-3 h-3" />
          <span>Locked</span>
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm"
        >
          <span>{problem.is_solved ? "Review" : "Solve"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
