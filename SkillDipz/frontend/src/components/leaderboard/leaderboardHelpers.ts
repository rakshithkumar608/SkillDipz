export function fmt(n:number): string {
    return n.toLocaleString("en-IN");
}

export function scoreColor(score: number): string {
    if(score>= 80) return "text-emerald-400";
    if(score>=60) return "text-sky-400";
    if(score>=40) return "text-amber-400";
    return "text-rose-400";
}

export function rankGradient(rank: number): string {
    if (rank === 1) return "from-amber-400 to-yellow-300";
    if (rank === 2) return "from-slate-300 to-slate-200";
    if (rank === 3) return "from-amber-700 to-amber-500";
    return "from-sky-600 to-indigo-600";
}

export function rankGlow(rank: number): string {
    if (rank === 1) return "shadow-amber-400/30 border-amber-400/40";
  if (rank === 2) return "shadow-slate-300/20 border-slate-300/30";
  return "shadow-amber-600/20 border-amber-600/30";
}

export const MEDALS = ["🥇", "🥈", "🥉"];

export const ROLES = ["All Roles", "backend", "fullstack", "data", "devops", "ai"];