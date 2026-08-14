"use client";

import { useEffect } from "react";
import type { CandidateDetail } from "@/store/companyStore";
import {
  CheckCircle2,
  Mail,
  Phone,
  X,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

interface Props {
  candidate: CandidateDetail;
  onClose: () => void;
}

function fitColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-rose-400";
}

export function CandidateModal({ candidate, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const displaySkills =
    candidate.matched_skills.length > 0 ? candidate.matched_skills : candidate.skills.slice(0, 8);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl
                      animate-in zoom-in-95 duration-200 scrollbar-thin scrollbar-thumb-slate-700">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700
                     flex items-center justify-center text-slate-300 hover:text-white transition-colors z-10 border border-slate-700"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-start gap-3.5 sm:gap-4 pr-12">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500
                          flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
            <span className="text-base sm:text-lg font-bold text-white tracking-wider">
              {candidate.avatar_initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {candidate.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 truncate mt-0.5">
              {[candidate.college, candidate.branch].filter(Boolean).join(" · ") || "Student Developer"}
            </p>
            {candidate.target_role && (
              <p className="text-xs mt-1 text-sky-400 font-medium truncate">
                Target Role: <span className="text-sky-300 font-semibold">{candidate.target_role}</span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${fitColor(candidate.ai_skill_fit_pct)}`}>
              {candidate.ai_skill_fit_pct}%
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
              SKILLS MATCH
            </p>
          </div>
        </div>

        {/* Acquired Skills Portfolio */}
        <div className="mx-4 sm:mx-6 mb-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-850 border border-slate-750">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            ACQUIRED SKILLS PORTFOLIO
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {displaySkills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
                           rounded-lg border border-slate-700 bg-slate-800 text-slate-100 shadow-sm"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                {skill}
              </span>
            ))}
          </div>

          {candidate.missing_skills.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2 mt-3.5">
                SKILL GAPS
              </p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {candidate.missing_skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg
                               border border-rose-500/30 bg-rose-500/15 text-rose-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Verified Contact Info */}
        <div className="mx-4 sm:mx-6 mb-5 p-3.5 sm:p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
            VERIFIED CONTACT INFO
          </p>
          {candidate.phone ? (
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-100">
              <Phone className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="font-medium">{candidate.phone}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Contact info hidden (student privacy setting is not public)
            </p>
          )}
          {candidate.email && (
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-200">
              <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{candidate.email}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          <button
            onClick={() => {
              window.location.href = `mailto:${candidate.email}?subject=Interview Request – SkillDipz Partner`;
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl
                       bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400
                       text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg shadow-sky-500/20 active:scale-[0.98]"
          >
            <Mail className="w-4 h-4 shrink-0" />
            Request Interview
          </button>

          {candidate.github ? (
            <a
              href={candidate.github.startsWith("http") ? candidate.github : `https://github.com/${candidate.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl
                         bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold
                         border border-white/10 transition-all duration-200 shadow-sm active:scale-[0.98]"
            >
              <FaGithub className="w-4 h-4 shrink-0" />
              Candidate GitHub
            </a>
          ) : (
            <button
              disabled
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl
                         bg-slate-800/40 text-slate-500 text-xs sm:text-sm font-semibold border border-white/5 cursor-not-allowed"
            >
              <FaGithub className="w-4 h-4 shrink-0" />
              No GitHub
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
