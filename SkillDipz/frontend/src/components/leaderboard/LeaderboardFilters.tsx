import { Loader2, RefreshCw, Target } from "lucide-react";
import { ROLES } from "./leaderboardHelpers";

interface Props {
  scope: "global" | "college";
  role: string;
  loading: boolean;
  jumping: boolean;
  onScopeChange: (s: "global" | "college") => void;
  onRoleChange: (r: string) => void;
  onJumpToMe: () => void;
  onRefresh: () => void;
}

export function LeaderboardFilters({
  scope,
  role,
  loading,
  jumping,
  onScopeChange,
  onRoleChange,
  onJumpToMe,
  onRefresh,
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">

      {/* Global / My College toggle */}
      <div className="flex rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900/60">
        {(["global", "college"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onScopeChange(s)}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              scope === s
                ? "bg-sky-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {s === "college" ? "My College" : "Global"}
          </button>
        ))}
      </div>

      {/* Role dropdown */}
      <select
        value={role}
        onChange={(e) => onRoleChange(e.target.value)}
        className="text-xs bg-slate-900/60 border border-slate-700/60 text-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-sky-500"
      >
        {ROLES.map((r) => (
          <option key={r} value={r} className="bg-slate-900">
            {r === "All Roles"
              ? "All Roles"
              : r.charAt(0).toUpperCase() + r.slice(1)}
          </option>
        ))}
      </select>

      {/* Jump to my rank */}
      <button
        onClick={onJumpToMe}
        disabled={jumping}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {jumping ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Target className="w-3.5 h-3.5" />
        )}
        Jump to My Rank
      </button>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        title="Refresh"
        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
