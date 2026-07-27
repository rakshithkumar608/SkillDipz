import { ProfileData } from "@/lib/profile";

const SCORE_ROWS = [
  {
    key: "coding",
    label: "Coding Proficiency",
    weight: "Code tests + CF",
    color: "bg-sky-400",
  },
  {
    key: "conceptual",
    label: "Conceptual Knowledge",
    weight: "MCQ assessments",
    color: "bg-violet-400",
  },
  {
    key: "learning",
    label: "Learning Progress",
    weight: "Roadmap completion",
    color: "bg-teal-400",
  },
  {
    key: "project",
    label: "Project Strength",
    weight: "Submissions",
    color: "bg-emerald-400",
  },
  {
    key: "profile",
    label: "Profile Completeness",
    weight: "10% weight",
    color: "bg-amber-400",
  },
] as const;

export function ScoreBreakdownPanel({
  breakdown,
}: {
  breakdown: ProfileData["score_breakdown"];
}) {
  return (
    <div className="space-y-3.5">
      {SCORE_ROWS.map(({ key, label, weight, color }) => {
        const val = breakdown[key];
        return (
          <div className="space-y-1" key={key}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">
                  {label}
                </span>
                <span className="ml-2 text-[10px] text-slate-600">
                  {weight}
                </span>
              </div>
              <span className="text-sm font-bold text-white tabular-nums">
                {val.toFixed(1)}
              </span>
            </div>
            <div className="w-full bg-slate-800/60 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${color} transition-all duration-700`}
                style={{ width: `${Math.min(val, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
