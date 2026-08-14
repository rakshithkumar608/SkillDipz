import { TalentCard } from "@/store/companyStore";

interface Props {
  candidate: TalentCard;
  onClick: () => void;
}

function fitColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-rose-400";
}

export function TalentCardRow({ candidate, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/40 transition-colors duration-150 text-left group"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        {/* Avatar */}
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
          <span className="text-xs sm:text-sm font-bold text-white tracking-wider">
            {candidate.avatar_initials}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-semibold text-white group-hover:text-sky-300 truncate transition-colors">
            {candidate.name}
          </p>
          <p className="text-xs text-slate-300 truncate mt-0.5 font-normal">
            {[candidate.college, candidate.target_role]
              .filter(Boolean)
              .join(" · ") || "Student Developer"}
          </p>

          {/* Skill tags */}
          {candidate.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1.5">
              {candidate.skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 text-[10px] sm:text-[11px] font-medium rounded-md
                             bg-slate-800 text-slate-200 border border-slate-700"
                >
                  {skill}
                </span>
              ))}
              {candidate.skills.length > 3 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-800 rounded-md border border-slate-700/50">
                  +{candidate.skills.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Skill Fit */}
      <div className="text-right shrink-0 pl-2">
        <p className={`text-base sm:text-xl font-bold tracking-tight ${fitColor(candidate.ai_skill_fit_pct)}`}>
          {candidate.ai_skill_fit_pct}%
        </p>
        <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
          AI SKILL FIT
        </p>
      </div>
    </button>
  );
}
