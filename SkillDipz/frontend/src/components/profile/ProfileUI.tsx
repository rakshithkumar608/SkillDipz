export function Card({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div 
        className={`bg-[#0b0f19]/90 backdrop-blur-xl border border-slate-800/80
        rounded-2xl shadow-2xl transition-all duration-200
        hover:border-slate-700/60 ${className}`}
        >
            {children}
        </div>
    );
}

export function SectionHeader({
    icon: Icon,
    title,
    accent = "sky",
} : {
    icon: React.ElementType;
    title: string;
    accent?: string;
}) {
    const colors: Record<string, string> = {
    sky:     "bg-sky-500/10 border-sky-500/20 text-sky-400",
    violet:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
    indigo:  "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    };
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${colors[accent]}`}>
                <Icon className="w-4 h-4"/>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
                {title}
            </h2>
        </div>
    );
}

export function Badge({
  children,
  color = "sky",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const colors: Record<string, string> = {
    sky:     "bg-sky-500/15 text-sky-300 border-sky-500/25",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    violet:  "bg-violet-500/15 text-violet-300 border-violet-500/25",
    amber:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
    rose:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
    orange:  "bg-orange-500/15 text-orange-300 border-orange-500/25",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full
        text-xs font-semibold border ${colors[color] ?? colors.sky}`}
    >
      {children}
    </span>
  );
}