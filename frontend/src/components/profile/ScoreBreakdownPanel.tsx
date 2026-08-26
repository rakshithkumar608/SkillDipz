"use client";

import { ProfileData } from "@/lib/profile";
import { CircularScoreRing } from "@/components/common/CircularScoreRing";

const SCORE_ROWS = [
  {
    key: "coding",
    label: "Coding Proficiency",
    weight: "Coding arena & solves",
    gradient: ["#0284c7", "#38bdf8"] as [string, string],
    textColor: "text-sky-400",
  },
  {
    key: "conceptual",
    label: "Conceptual Knowledge",
    weight: "MCQ skill tests",
    gradient: ["#7c3aed", "#a78bfa"] as [string, string],
    textColor: "text-violet-400",
  },
  {
    key: "learning",
    label: "Learning Progress",
    weight: "Roadmap curriculum",
    gradient: ["#0d9488", "#2dd4bf"] as [string, string],
    textColor: "text-teal-400",
  },
  {
    key: "project",
    label: "Project Strength",
    weight: "Submitted projects",
    gradient: ["#059669", "#34d399"] as [string, string],
    textColor: "text-emerald-400",
  },
  {
    key: "profile",
    label: "Profile Completeness",
    weight: "Profile credentials",
    gradient: ["#d97706", "#fbbf24"] as [string, string],
    textColor: "text-amber-400",
  },
] as const;

export function ScoreBreakdownPanel({
  breakdown,
}: {
  breakdown: ProfileData["score_breakdown"];
}) {
  return (
    <div className="space-y-2.5">
      {SCORE_ROWS.map(({ key, label, weight, gradient, textColor }) => {
        const val = breakdown[key] ?? 0;
        return (
          <div
            key={key}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 transition-all hover:bg-slate-800/40"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CircularScoreRing
                value={val}
                gradientId={`ring-profile-${key}`}
                colorGradient={gradient}
                size={42}
                strokeWidth={3.5}
                textColor={textColor}
                showDecimal={true}
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-200 block truncate">
                  {label}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {weight}
                </span>
              </div>
            </div>
            <div className="text-right pl-2 shrink-0">
              <span className={`text-xs font-bold tabular-nums ${textColor}`}>
                {val.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
