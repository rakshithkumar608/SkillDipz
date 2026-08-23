"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  AlertCircle,
  Loader2,
  BookOpen,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { getSkillBreakdown, SkillsResponse, SkillRecommendation, SKILL_DISPLAY } from "@/lib/arenaApi";

function SkillBar({ skill }: { skill: SkillRecommendation }) {
  const color =
    skill.accuracy >= 80
      ? { bar: "bg-emerald-500", text: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" }
      : skill.accuracy >= 60
      ? { bar: "bg-amber-500", text: "text-amber-400", badge: "bg-amber-500/10 border-amber-500/20 text-amber-400" }
      : { bar: "bg-rose-500", text: "text-rose-400", badge: "bg-rose-500/10 border-rose-500/20 text-rose-400" };

  return (
    <div className={`p-4 rounded-xl border ${skill.is_weak ? "border-rose-500/20 bg-rose-500/5" : "border-white/5 bg-slate-900/40"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">
            {SKILL_DISPLAY[skill.skill] || skill.skill.replace(/_/g, " ")}
          </span>
          {skill.is_weak && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-full">
              Needs work
            </span>
          )}
        </div>
        <span className={`text-sm font-black ${color.text}`}>{skill.accuracy.toFixed(0)}%</span>
      </div>

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
        <motion.div
          className={`h-full ${color.bar} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${skill.accuracy}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {skill.is_weak && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">{skill.recommended_action}</p>
          {skill.roadmap_link && (
            <Link href={skill.roadmap_link}>
              <span className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors ml-3 flex-shrink-0">
                <BookOpen className="w-3 h-3" />
                Learn
                <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkillBreakdown()
      .then(setData)
      .catch(() => setError("Failed to load skills"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const weakSkills = data?.skills.filter((s) => s.is_weak) ?? [];
  const strongSkills = data?.skills.filter((s) => !s.is_weak) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-sky-400" />
          <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">Skill Analysis</span>
        </div>
        <h1 className="text-3xl font-black text-white">Your Skills</h1>
        <p className="text-slate-400 text-sm mt-1">Based on your Arena performance.</p>
      </motion.div>

      {(!data || data.skills.length === 0) ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No data yet</h3>
          <p className="text-slate-400 text-sm mb-6">Play Arena games to unlock your skill breakdown.</p>
          <Link href="/student/skill-tests">
            <button className="px-6 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-400 transition-colors">
              Go to Arena
            </button>
          </Link>
        </div>
      ) : (
        <>
          {/* Weak skills first */}
          {weakSkills.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
              <h2 className="text-sm font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>⚠ Needs Improvement</span>
                <span className="text-slate-600 font-normal normal-case tracking-normal">— focus here</span>
              </h2>
              <div className="space-y-3">
                {weakSkills.map((s, i) => (
                  <motion.div key={s.skill} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <SkillBar skill={s} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Strong skills */}
          {strongSkills.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Strong Areas</span>
              </h2>
              <div className="space-y-3">
                {strongSkills.map((s, i) => (
                  <motion.div key={s.skill} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 + 0.1 }}>
                    <SkillBar skill={s} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Learning Loop CTA */}
          {weakSkills.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-500/20 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-1">
                Improve {SKILL_DISPLAY[data.weakest_skill ?? ""] || data.weakest_skill}
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                Your accuracy is below 60%. Visit your Learning Roadmap for targeted resources, then come back and practice in the Arena.
              </p>
              <div className="flex gap-3">
                <Link href="/student/roadmap">
                  <button className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm font-bold rounded-xl hover:bg-sky-400 transition-colors">
                    <BookOpen className="w-4 h-4" /> Learning Roadmap
                  </button>
                </Link>
                <Link href="/student/skill-tests">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors">
                    Practice Arena
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
