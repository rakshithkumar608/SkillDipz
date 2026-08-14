interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  glowClass: string;
}

export function StatCard({ label, value, icon, glowClass }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-slate-900 border border-slate-800 transition-all duration-200 hover:border-slate-700 hover:bg-slate-850 group shadow-md shadow-black/20"
    >
      {/* Glow Spot */}
      <div
        className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20
                    group-hover:opacity-35 transition-opacity pointer-events-none ${glowClass}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
            {value}
          </p>
          <p className="text-xs text-slate-300 font-medium mt-1 leading-snug">
            {label}
          </p>
        </div>
        <div className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0 shadow-inner">
          {icon}
        </div>
      </div>
    </div>
  );
}
