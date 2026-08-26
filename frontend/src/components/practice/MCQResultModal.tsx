"use client";

import { AssessmentResult } from "@/lib/practiceApi";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";

interface Props { 
  result: AssessmentResult;
  topicTitle: string;
  onClose: () => void;
}

export default function MCQResultModal({result, topicTitle, onClose}: Props) {
  const is100Passed = result.score_pct === 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Score Header */}
        <div className={`p-7 text-center ${is100Passed ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
          <div
            className="text-6xl font-black mb-1"
            style={{ color: is100Passed ? "#34d399" : "#fbbf24" }}
          >
            {result.score_pct}%
          </div>
          <p className="text-slate-300 font-semibold">{topicTitle}</p>
          <p className="text-slate-500 text-sm mt-1">
            {result.correct} / {result.total} correct
          </p>
          {is100Passed ? (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-emerald-400 text-sm font-bold">
              <Sparkles className="w-4 h-4" /> 100% Completed & Mastered!
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
              🔒 100% needed to complete · Next retake in 24 hours
            </div>
          )}
        </div>

        {/* kills verified */}
        {result.skills_verified.length > 0 && (
          <div className="px-6 py-4 border-b border-white/6">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
              Skill Verified
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.skills_verified.map((s) => (
                <span
                  key={s}
                  className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-medium"
                >
                  ✓ {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Review */}
        <div className="max-h-60 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Review</p>
          {result.explanations.map((e) => (
            <div
              key={e.question_id}
              className={`p-3 rounded-xl border text-xs ${
                e.is_correct
                  ? "bg-emerald-500/5 border-emerald-500/15"
                  : "bg-red-500/5 border-red-500/15"
              }`}
            >
              <div className="flex items-start gap-2">
                {e.is_correct ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-slate-300 font-medium line-clamp-2">{e.question}</p>
                  {!e.is_correct && (
                    <p className="text-slate-500 mt-0.5">
                      Correct: <span className="text-emerald-400 font-semibold">{e.correct_key}</span>
                    </p>
                  )}
                  {e.explanation && (
                    <p className="text-slate-500 mt-1 italic">{e.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-white/6">
        <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  )
}