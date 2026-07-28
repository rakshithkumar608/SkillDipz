import { ProfileData } from "@/lib/profile";
import { CheckCircle2 } from "lucide-react";

export function CompletenessPanel({ profile }: { profile: ProfileData }) {
  const pct = profile.completeness_pct;
  const gradColor =
    pct >= 80
      ? { track: "#34d399", stop1: "#34d399", stop2: "#2dd4bf" }
      : pct >= 50
        ? { track: "#f59e0b", stop1: "#f59e0b", stop2: "#eab308" }
        : { track: "#f43f5e", stop1: "#f43f5e", stop2: "#ec4899" };
  const C = 2 * Math.PI * 32;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* Circle — container must match the SVG size exactly */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="-rotate-90 w-20 h-20" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="#1e293b"
              strokeWidth="7"
            />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="url(#cgGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * C} ${C}`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
            <defs>
              <linearGradient id="cgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gradColor.stop1} />
                <stop offset="100%" stopColor={gradColor.stop2} />
              </linearGradient>
            </defs>
          </svg>
          {/* Percentage label centred over the ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-white">{pct}%</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Profile Completeness</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {profile.completeness_score}/10 pts
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Adds{" "}
            <span className="text-sky-400 font-semibold">
              {(pct * 0.1).toFixed(1)} pts
            </span>{" "}
            to Employability Score
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {profile.completeness_fields.map((f) => (
          <div
            key={f.label}
            className={`flex items-center justify-between p-2.5 rounded-xl transition-all
              ${
                f.done
                  ? "bg-emerald-500/5 border border-emerald-500/15"
                  : "bg-slate-900/40 border border-slate-800/40"
              }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                  ${f.done ? "bg-emerald-500/20" : "bg-slate-800/80"}`}
              >
                {f.done ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-600 block" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  f.done ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {f.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">+{f.weight} pts</span>
              {!f.done && f.action && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {f.action}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
