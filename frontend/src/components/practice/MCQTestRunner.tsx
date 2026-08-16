"use client";

import {
  AssessmentResult,
  AssessmentSessionData,
  submitAssessment,
} from "@/lib/practiceApi";
import { useCheatPrevention } from "@/hooks/useCheatPrevention";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock, Loader2, Shield, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  session: AssessmentSessionData;
  initialSecondsLeft?: number;
  initialAnswers?: Record<string, string>;
  onClose: () => void;
  onCompleted: (result: AssessmentResult) => void;
}

export default function MCQTestRunner({
  session,
  initialSecondsLeft,
  initialAnswers = {},
  onClose,
  onCompleted,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    initialSecondsLeft ?? session.time_limit_mins * 60
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSubmit = useCallback(async (timedOut = false) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (timedOut) toast.warning("Time's up! Submitting...");
    try {
      const result = await submitAssessment(session.session_id, answers);
      onCompleted(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Submission failed.");
      setSubmitting(false);
    }
  }, [answers, session.session_id, submitting, onCompleted]);

  // Cheat prevention
  const { tabSwitchCount, isWarning } = useCheatPrevention({
    maxViolations: 3,
    onMaxViolations: () => handleSubmit(true),
    enabled: true,
  });

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const q = session.questions[idx];
  const total = session.questions.length;
  const answeredCount = Object.keys(answers).length;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Cheat Prevention Badge */}
        {isWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-5 mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-400 shadow-lg shadow-red-500/10"
          >
            <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider">Cheat Prevention Shield Active</p>
              <p className="text-[11px] text-red-400/70 mt-0.5">
                Unauthorized tab swaps:{" "}
                <span className="font-black text-red-300">{tabSwitchCount}/3</span>
              </p>
            </div>
            <Shield className="w-4 h-4 text-red-500/50 shrink-0" />
          </motion.div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/6 shrink-0">
          <div>
            <h2 className="font-bold text-white">{session.topic_title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Q {idx + 1}/{total} · {answeredCount}/{total} answered
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              isUrgent
                ? "bg-red-500/15 border-red-500/30 text-red-400 animate-pulse"
                : "bg-white/5 border-white/8 text-slate-300"
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/5 shrink-0">
          <div
            className="h-full bg-linear-to-r from-indigo-500 to-sky-500 transition-all duration-300"
            style={{ width: `${((idx + 1) / total) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <p className="text-white font-medium leading-relaxed text-base">{q.question}</p>
          <div className="space-y-2.5">
            {q.options.map((opt) => {
              const selected = answers[q.question_id] === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.question_id]: opt.key }))
                  }
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                    selected
                      ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-200 shadow-sm shadow-indigo-500/10"
                      : "bg-white/3 border-white/8 text-slate-300 hover:bg-white/6 hover:border-white/15"
                  }`}
                >
                  <span className="font-bold mr-2 text-slate-400">{opt.key}.</span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 border-t border-white/6 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="px-4 py-2 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white disabled:opacity-30"
          >
            ← Prev
          </button>

          {/* Question dots */}
          <div className="flex-1 flex gap-1 flex-wrap justify-center">
            {session.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all ${
                  i === idx
                    ? "bg-indigo-500 text-white scale-110"
                    : answers[session.questions[i].question_id]
                    ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-slate-500 hover:bg-white/10"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {idx < total - 1 ? (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-white/8 text-slate-300 text-sm hover:text-white"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Submit
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}