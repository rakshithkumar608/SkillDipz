"use client";

import { Clock, LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function ComingSoon({ title, description, icon: Icon = Clock }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shadow-lg shadow-sky-500/10">
        <Icon className="w-10 h-10 text-sky-400 drop-shadow-md" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white drop-shadow-sm">{title}</h2>
        <p className="text-slate-400 max-w-md">
          {description ?? "This feature is actively being built. Check back soon!"}
        </p>
      </div>
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium shadow-sm shadow-amber-500/5">
        <Clock className="w-4 h-4" />
        Coming Soon
      </span>
    </div>
  );
}