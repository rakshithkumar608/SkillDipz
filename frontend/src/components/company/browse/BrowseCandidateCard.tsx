"use client";

import React from "react";
import type { BrowseCandidate } from "@/store/companyStore";
import { CheckCircle2, FolderGit2, Sparkles } from "lucide-react";

interface Props {
  candidate: BrowseCandidate;
  onClick: () => void;
}

// Deterministic avatar gradient based on initials/name
function getAvatarGradient(name: string): string {
  const ch = (name || "A").trim().charAt(0).toUpperCase();
  const code = ch.charCodeAt(0) || 65;
  const gradients = [
    "from-violet-500 to-purple-600 shadow-violet-500/20",
    "from-sky-500 to-indigo-600 shadow-sky-500/20",
    "from-emerald-500 to-teal-600 shadow-emerald-500/20",
    "from-amber-500 to-orange-600 shadow-amber-500/20",
    "from-rose-500 to-pink-600 shadow-rose-500/20",
    "from-cyan-500 to-blue-600 shadow-cyan-500/20",
    "from-teal-500 to-emerald-600 shadow-teal-500/20",
    "from-fuchsia-500 to-violet-600 shadow-fuchsia-500/20",
  ];
  return gradients[code % gradients.length];
}

function getScoreColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-rose-400";
}

export function BrowseCandidateCard({ candidate, onClick }: Props) {
  const gradientClass = getAvatarGradient(candidate.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-[#0e1117] border border-white/8 rounded-2xl p-4 sm:p-5
                 hover:border-violet-500/40 hover:bg-[#131720] transition-all duration-200
                 group focus:outline-none focus:ring-2 focus:ring-violet-500/40 flex flex-col justify-between"
    >
      {/* Top row: Avatar + Info + Score Index */}
      <div className="w-full flex items-start justify-between gap-3">
        {/* Avatar + Name & College */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-xl sm:rounded-2xl bg-linear-to-br ${gradientClass}
                        flex items-center justify-center shrink-0 shadow-md`}
          >
            <span className="text-sm sm:text-base font-bold text-white tracking-wider">
              {candidate.avatar_initials}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-violet-300 truncate transition-colors">
              {candidate.name}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
              {candidate.college || "Student Developer"}
            </p>
            {candidate.target_role && (
              <p className="text-[11px] text-sky-400/90 font-medium truncate mt-0.5">
                {candidate.target_role}
              </p>
            )}
          </div>
        </div>

        {/* Skill Index % */}
        <div className="text-right shrink-0 pl-2">
          <p
            className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${getScoreColor(
              candidate.skill_index_pct
            )}`}
          >
            {candidate.skill_index_pct}%
          </p>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">
            SKILL INDEX
          </p>
        </div>
      </div>

      {/* Skills list tags */}
      {Array.isArray(candidate?.skills) && candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {candidate.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-lg
                         bg-white/5 text-slate-300 border border-white/8"
            >
              <Sparkles className="w-2.5 h-2.5 text-violet-400/80 shrink-0" />
              {skill}
            </span>
          ))}
          {(candidate.additional_skills_count ?? 0) > 0 && (
            <span
              className="px-2 py-0.5 text-[10px] font-semibold rounded-lg
                         bg-violet-500/10 text-violet-300 border border-violet-500/20"
            >
              +{candidate.additional_skills_count} more
            </span>
          )}
        </div>
      )}

      {/* Bottom verified activity row */}
      <div className="w-full flex items-center gap-3 mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-slate-200 font-semibold">{candidate.tests_completed}</span> tests
        </span>
        <span className="text-slate-700">·</span>
        <span className="flex items-center gap-1.5">
          <FolderGit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-slate-200 font-semibold">{candidate.projects_completed}</span> projects
        </span>
      </div>
    </button>
  );
}
