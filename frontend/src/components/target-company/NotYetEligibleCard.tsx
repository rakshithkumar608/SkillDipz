"use client";

import React from "react";
import { Lock, TrendingUp, ArrowRight, Target, Sparkles, MapPin } from "lucide-react";
import type { NotYetEligibleCompany } from "@/types/targetCompany";
import Link from "next/link";
import { motion } from "framer-motion";

interface Props {
  company: NotYetEligibleCompany;
}

export default function NotYetEligibleCard({ company }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-2xl bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-950/70 border border-slate-800/80 hover:border-amber-500/40 p-5 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-300"
    >
      <div className="flex items-start gap-4 min-w-0">
        {/* Company Logo / Locked Indicator */}
        <div className="relative w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 p-1 flex items-center justify-center flex-shrink-0 shadow-inner">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-full h-full object-contain rounded-lg opacity-70 group-hover:opacity-100 transition-opacity"
            />
          ) : (
            <span className="text-2xl select-none opacity-70">
              {company.logo_emoji || "🏢"}
            </span>
          )}
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
            <Lock className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base truncate group-hover:text-amber-300 transition-colors">
              {company.name}
            </h3>
            <span className="text-xs text-slate-500">&bull;</span>
            <span className="text-xs text-slate-400 truncate">{company.industry}</span>
          </div>

          {/* Score Deficit Metrics */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">
              Target: <strong className="text-amber-400 font-semibold">{company.min_score}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400">
              Your Score: <strong className="text-slate-200">{company.your_score}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-semibold">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              +{company.score_gap} pts gap
            </span>
          </div>

          {/* Missing Skills Pills */}
          {company.missing_skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Missing:
              </span>
              {company.missing_skills.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-400 font-medium"
                >
                  {s}
                </span>
              ))}
              {company.missing_skills.length > 3 && (
                <span className="text-[10px] text-slate-500 px-1.5 py-0.5">
                  +{company.missing_skills.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex-shrink-0 self-end sm:self-center">
        <Link
          href="/student/roadmap"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 shadow-md shadow-amber-950/20 transition-all group-hover:scale-105"
        >
          <span>Skill Up to Unlock</span>
          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
        </Link>
      </div>
    </motion.div>
  );
}