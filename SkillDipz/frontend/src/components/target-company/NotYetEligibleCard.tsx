"use client";

import { Lock, TrendingUp } from "lucide-react";
import type { NotYetEligibleCompany } from "@/types/targetCompany";
import Link from "next/link";

interface Props {
  company: NotYetEligibleCompany;
}

export default function NotYetEligibleCard({ company }: Props) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 flex items-start gap-4 hover:border-slate-600 transition">
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl flex-shrink-0 opacity-60">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-8 h-8 object-contain rounded"
          />
        ) : (
          company.logo_emoji || "🏢"
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="font-medium text-slate-300 text-sm">{company.name}</h3>
          <span className="text-xs text-slate-500">· {company.industry}</span>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          <span>
            Required:{" "}
            <span className="text-red-400 font-medium">{company.min_score}</span>
          </span>
          <span>
            Your score:{" "}
            <span className="text-slate-300">{company.your_score}</span>
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <TrendingUp className="w-3 h-3" />
            +{company.score_gap} pts needed
          </span>
        </div>

        {company.missing_skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {company.missing_skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/student/roadmap"
        className="flex-shrink-0 text-xs px-3 py-1.5 border border-indigo-700/50 text-indigo-400 hover:bg-indigo-950 rounded-lg transition"
      >
        Improve →
      </Link>
    </div>
  );
}