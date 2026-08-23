"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Target,
  Zap,
  Bug,
  GitBranch,
  Loader2,
  AlertCircle,
  Clock,
  Trophy,
  ChevronRight,
} from "lucide-react";
import {
  getDailyArena,
  startDailyArena,
  submitAnswer,
  completeDailyArena,
  DailyArenaOut,
  StartSessionResponse,
  SubmitAnswerResponse,
  ArenaQuestion,
} from "@/lib/arenaApi";

type Phase =
  | "info"
  | "loading"
  | "countdown"
  | "question"
  | "feedback"
  | "completing"
  | "done"
  | "error";

// ─── Countdown Component ──────────────────────────────────────────────────────

function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    if (count === 0) {
      setTimeout(onDone, 300);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="text-[100px] font-black text-white leading-none"
        >
          {count === 0 ? <span className="text-sky-400">GO!</span> : count}
        </motion.div>
      </AnimatePresence>
      <p className="text-slate-400 font-medium tracking-widest uppercase text-sm">
        Daily Sprint Started...
      </p>
    </div>
  );
}

// ─── Master Single Timer Ring ─────────────────────────────────────────────────

function MasterDailyTimerRing({
  total,
  elapsed,
}: {
  total: number;
  elapsed: number;
}) {
  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const pct = Math.max(0, Math.min(1, 1 - elapsed / total));
  const urgent = remaining <= 30;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  return (
    <div className="relative flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-white/10 rounded-xl">
      <div className="relative w-7 h-7 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
          <circle
            cx="25"
            cy="25"
            r={r}
            fill="none"
            stroke={urgent ? "#f43f5e" : "#38bdf8"}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <Clock className={`w-3 h-3 ${urgent ? "text-rose-400" : "text-sky-400"}`} />
      </div>
      <span
        className={`text-xs font-bold font-mono ${
          urgent ? "text-rose-400 animate-pulse" : "text-sky-400"
        }`}
      >
        {timeStr}
      </span>
    </div>
  );
}

// ─── XP Float ─────────────────────────────────────────────────────────────────

function XPFloat({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed top-20 right-6 z-50 pointer-events-none"
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -60 }}
      transition={{ duration: 1.1 }}
    >
      <span className="text-2xl font-black text-amber-400">+{xp} XP</span>
    </motion.div>
  );
}

const GAME_ICONS: Record<string, React.ElementType> = {
  quick_fire: Zap,
  debug_rush: Bug,
  tech_decision: GitBranch,
};
const GAME_COLORS: Record<string, string> = {
  quick_fire: "text-amber-400",
  debug_rush: "text-rose-400",
  tech_decision: "text-violet-400",
};

export default function DailyArenaPage() {
  const router = useRouter();
  const [daily, setDaily] = useState<DailyArenaOut | null>(null);
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [phase, setPhase] = useState<Phase>("info");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [showXP, setShowXP] = useState(false);
  const [floatXP, setFloatXP] = useState(0);
  const [error, setError] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStartRef = useRef<number>(0);
  const questionStartRef = useRef<number>(0);

  useEffect(() => {
    getDailyArena()
      .then((d) => {
        setDaily(d);
        if (d.already_completed) {
          setPhase("done");
        }
      })
      .catch(() => {
        setError("Failed to load today's Arena");
        setPhase("error");
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const totalGameTime = session
    ? session.questions.reduce((acc, q) => acc + q.time_limit, 0)
    : 300;

  const handleStart = async () => {
    setPhase("loading");
    try {
      const s = await startDailyArena();
      setSession(s);
      setPhase("countdown");
    } catch (e: any) {
      const msg = e?.response?.data?.detail;
      if (msg && msg.includes("already completed")) {
        setPhase("done");
      } else {
        setError(msg || "Failed to start Daily Arena");
        setPhase("error");
      }
    }
  };

  const handleCountdownDone = useCallback(() => {
    if (!session) return;
    setPhase("question");
    const start = Date.now();
    gameStartRef.current = start;
    questionStartRef.current = start;
    setTotalElapsed(0);

    const totalSecs = session.questions.reduce((acc, q) => acc + q.time_limit, 0);

    timerRef.current = setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setTotalElapsed(e);
      if (e >= totalSecs + 2) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 100);

    setSelectedKey(null);
    setFeedback(null);
  }, [session]);

  const handleAnswer = useCallback(
    async (key: string) => {
      if (!session || phase !== "question" || selectedKey) return;

      const q = session.questions[currentIdx];
      const elapsedMs = Math.round(Date.now() - questionStartRef.current);
      setSelectedKey(key);

      try {
        const res = await submitAnswer({
          session_id: session.session_id,
          question_id: q.question_id,
          answer_key: key,
          elapsed_ms: elapsedMs,
        });
        setFeedback(res);
        setPhase("feedback");
        if (res.xp_earned > 0) {
          setFloatXP(res.xp_earned);
          setShowXP(true);
        }
      } catch {
        setError("Failed to submit answer");
        setPhase("error");
      }
    },
    [session, phase, selectedKey, currentIdx]
  );

  const handleNext = useCallback(async () => {
    if (!session) return;
    const next = currentIdx + 1;
    if (next >= session.questions.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("completing");
      try {
        await completeDailyArena(session.session_id);
        router.push(`/student/skill-tests/results/${session.session_id}`);
      } catch (e: any) {
        setError(e?.response?.data?.detail || "Failed to complete Arena");
        setPhase("error");
      }
    } else {
      questionStartRef.current = Date.now();
      setCurrentIdx(next);
      setSelectedKey(null);
      setFeedback(null);
      setPhase("question");
    }
  }, [session, currentIdx, router]);

  useEffect(() => {
    if (phase !== "question" || !session) return;
    const handler = (e: KeyboardEvent) => {
      const m: Record<string, string> = {
        a: "A",
        b: "B",
        c: "C",
        d: "D",
        "1": "A",
        "2": "B",
        "3": "C",
        "4": "D",
      };
      const k = m[e.key.toLowerCase()];
      if (k) handleAnswer(k);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, currentIdx, session, selectedKey, handleAnswer]);

  // ── Info Screen ──
  if (phase === "info" && daily) {
    const total =
      daily.quick_fire_count + daily.debug_rush_count + daily.tech_decision_count;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900/60 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-md"
        >
          <button
            onClick={() => router.push("/student/skill-tests")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Arena
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">
              Today&apos;s Challenge
            </span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Daily Skill Sprint</h1>
          <p className="text-slate-400 text-sm mb-6">
            Test your skills with {total} dynamic AI challenges tailored to your skill gaps.
            Complete today&apos;s sprint to climb today&apos;s leaderboard.
          </p>

          <div className="grid grid-cols-3 gap-2.5 mb-6">
            {[
              ["quick_fire", daily.quick_fire_count, "Quick Fire"],
              ["debug_rush", daily.debug_rush_count, "Debug Rush"],
              ["tech_decision", daily.tech_decision_count, "Tech Decision"],
            ].map(([type, count, label]) => {
              const Icon = GAME_ICONS[type as string] || Target;
              return (
                <div
                  key={type as string}
                  className="bg-slate-950/60 border border-white/5 rounded-xl p-3 text-center"
                >
                  <Icon
                    className={`w-5 h-5 mx-auto mb-1 ${GAME_COLORS[type as string]}`}
                  />
                  <p className="text-white font-bold text-sm">{count as number}Q</p>
                  <p className="text-slate-500 text-[11px]">{label as string}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between p-3 bg-white/3 rounded-xl border border-white/5 mb-6 text-xs text-slate-400">
            <span>⏱️ ~5 min overall</span>
            <span className="text-amber-400 font-bold">+{daily.total_xp} XP Total</span>
            <span className="text-emerald-400 font-semibold">🔥 +1 Streak</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 py-4 bg-sky-500 hover:bg-sky-400 text-white font-black text-base rounded-2xl shadow-lg shadow-sky-500/25 transition-all"
          >
            <Play className="w-5 h-5 fill-current" /> Start Today&apos;s Sprint
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Loading Screen ──
  if (phase === "loading" || phase === "completing") {
    return (
      <div className="flex min-h-screen bg-slate-950 flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          {phase === "loading" ? "Generating Today's Sprint via AI..." : "Submitting final sprint..."}
        </p>
      </div>
    );
  }

  // ── Error Screen ──
  if (phase === "error") {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-6 text-center space-y-4 max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-slate-200 text-sm font-semibold">{error}</p>
          <button
            onClick={() => router.push("/student/skill-tests")}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  // ── Completed / Locked Screen ──
  if (phase === "done") {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900/60 border border-emerald-500/20 rounded-3xl p-8 max-w-md w-full text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Today&apos;s Arena Complete! 🎉</h2>
            <p className="text-slate-400 text-sm mt-1">
              You&apos;ve completed today&apos;s challenge and locked in your sprint time. Come back tomorrow for a new sprint!
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Link href="/student/skill-tests/leaderboard">
              <button className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400 font-bold rounded-xl transition-all text-sm">
                <Trophy className="w-4 h-4" /> View Today&apos;s Leaderboard
              </button>
            </Link>
            <button
              onClick={() => router.push("/student/skill-tests")}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors text-sm"
            >
              Back to Arena
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Countdown Screen ──
  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <Target className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-white">Daily Arena Sprint</span>
        </div>
        <Countdown onDone={handleCountdownDone} />
      </div>
    );
  }

  if (!session || !session.questions[currentIdx]) return null;

  const q: ArenaQuestion = session.questions[currentIdx];
  const progress = ((currentIdx + 1) / session.total_questions) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col select-none">
      <AnimatePresence>
        {showXP && <XPFloat xp={floatXP} onDone={() => setShowXP(false)} />}
      </AnimatePresence>

      {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-white text-sm">Daily Sprint</span>
        </div>

        <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
          <span>Q</span>
          <span className="text-white">{currentIdx + 1}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{session.total_questions}</span>
        </div>

        {/* Master Timer Ring for entire daily sprint */}
        <MasterDailyTimerRing total={totalGameTime} elapsed={totalElapsed} />
      </div>

      {/* ── Progress Bar ── */}
      <div className="h-1 bg-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500"
          animate={{ width: `${progress}%` }}
          transition={{ ease: "easeInOut", duration: 0.3 }}
        />
      </div>

      {/* ── Question Content ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-md uppercase">
                  {q.skill}
                </span>
                <span className="text-xs text-slate-500">+{q.xp_reward} XP</span>
              </div>

              {q.scenario && (
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4">
                  <p className="text-sm text-slate-300 leading-relaxed">{q.scenario}</p>
                </div>
              )}

              {q.code_snippet && (
                <div className="bg-slate-950 border border-white/10 rounded-xl overflow-hidden font-mono text-sm">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border-b border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/70" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                    </div>
                    <span className="text-xs text-slate-500">code snippet</span>
                  </div>
                  <pre className="p-4 text-slate-200 text-xs sm:text-sm leading-6 overflow-x-auto">
                    {q.code_snippet}
                  </pre>
                </div>
              )}

              <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {q.question}
              </h2>

              <div className="space-y-2.5">
                {q.options.map((opt) => {
                  let cls =
                    "border-white/10 text-slate-300 hover:bg-white/5 hover:border-sky-500/40";
                  if (phase === "feedback" && feedback) {
                    if (opt.key === feedback.correct_key)
                      cls = "border-emerald-500/60 bg-emerald-500/10 text-emerald-400";
                    else if (opt.key === selectedKey)
                      cls = "border-rose-500/60 bg-rose-500/10 text-rose-400";
                    else cls = "border-white/5 text-slate-600";
                  } else if (opt.key === selectedKey) {
                    cls = "border-sky-500 bg-sky-500/10 text-sky-400";
                  }

                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleAnswer(opt.key)}
                      disabled={phase === "feedback"}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left text-sm transition-all ${cls} ${
                        phase === "feedback" ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-white/5 text-sm font-bold">
                        {opt.key}
                      </span>
                      <span className="leading-relaxed">{opt.text}</span>
                      {phase === "feedback" &&
                        feedback &&
                        opt.key === feedback.correct_key && (
                          <CheckCircle2 className="ml-auto w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                      {phase === "feedback" &&
                        feedback &&
                        opt.key === selectedKey &&
                        opt.key !== feedback.correct_key && (
                          <XCircle className="ml-auto w-5 h-5 text-rose-400 shrink-0" />
                        )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Banner */}
              <AnimatePresence>
                {phase === "feedback" && feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-4 border ${
                      feedback.is_correct
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {feedback.is_correct ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-bold text-emerald-400 text-sm">
                            Correct! +{feedback.xp_earned} XP
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="font-bold text-rose-400 text-sm">
                            Incorrect — 0 XP
                          </span>
                        </>
                      )}
                    </div>
                    {feedback.explanation && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {feedback.explanation}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="p-4 border-t border-white/5 bg-slate-900/60 backdrop-blur-md sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          {phase === "question" && (
            <p className="text-center text-xs text-slate-500">
              Press keyboard keys <span className="font-mono text-slate-400">A · B · C · D</span> or click to select
            </p>
          )}
          {phase === "feedback" && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-sky-500 hover:bg-sky-400 active:scale-98 text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/25"
            >
              <span>
                {currentIdx + 1 >= session.total_questions
                  ? "Finish Daily Sprint 🎉"
                  : "Next Question"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
