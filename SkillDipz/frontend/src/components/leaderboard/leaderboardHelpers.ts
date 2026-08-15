export function fmt(n: number): string {
  return (n || 0).toLocaleString("en-IN");
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-teal-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (score >= 60) return "bg-teal-500/10 text-teal-400 border-teal-500/20";
  if (score >= 40) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-rose-500/10 text-rose-400 border-rose-500/20";
}

export function rankGradient(rank: number): string {
  if (rank === 1) return "from-amber-400 via-yellow-400 to-amber-600";
  if (rank === 2) return "from-slate-200 via-slate-300 to-slate-400";
  if (rank === 3) return "from-amber-600 via-amber-700 to-amber-800";
  return "from-sky-600 to-indigo-600";
}

export function rankBadgeStyle(rank: number): {
  bg: string;
  text: string;
  border: string;
  glow: string;
  label: string;
} {
  if (rank === 1) {
    return {
      bg: "bg-amber-500/15",
      text: "text-amber-300",
      border: "border-amber-400/40",
      glow: "shadow-lg shadow-amber-500/20",
      label: "Gold Champion",
    };
  }
  if (rank === 2) {
    return {
      bg: "bg-slate-300/15",
      text: "text-slate-200",
      border: "border-slate-300/30",
      glow: "shadow-lg shadow-slate-300/15",
      label: "Silver Runner-Up",
    };
  }
  if (rank === 3) {
    return {
      bg: "bg-amber-700/20",
      text: "text-amber-400",
      border: "border-amber-600/40",
      glow: "shadow-lg shadow-amber-700/15",
      label: "Bronze Achiever",
    };
  }
  return {
    bg: "bg-slate-800/80",
    text: "text-sky-400",
    border: "border-white/10",
    glow: "",
    label: `#${rank}`,
  };
}