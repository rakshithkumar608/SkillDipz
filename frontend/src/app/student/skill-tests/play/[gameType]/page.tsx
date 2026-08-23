"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Zap,
  Bug,
  GitBranch,
  Loader2,
  AlertCircle,
  Clock,
  Flame,
  Trophy,
} from "lucide-react";
import {
  startSession,
  submitAnswer,
  completeSession,
  ArenaQuestion,
  StartSessionResponse,
  SubmitAnswerResponse,
  CompleteSessionResponse,
  GAME_TYPE_LABELS,
} from "@/lib/arenaApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "loading"
  | "countdown"
  | "question"
  | "feedback"
  | "completing"
  | "done"
  | "error";

interface AnswerState {
  questionIndex: number;
  selectedKey: string | null;
  response: SubmitAnswerResponse | null;
}

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-[120px] font-black text-white leading-none"
        >
          {count === 0 ? <span className="text-sky-400">GO!</span> : count}
        </motion.div>
      </AnimatePresence>
      <p className="text-slate-400 font-medium tracking-widest uppercase text-sm">
        Game timer begins...
      </p>
    </div>
  );
}

// ─── Single Overall Timer Ring ────────────────────────────────────────────────

function MasterTimerRing({
  total,
  elapsed,
}: {
  total: number;
  elapsed: number;
}) {
  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const pct = Math.max(0, Math.min(1, 1 - elapsed / total));
  const urgent = remaining <= 30;
  const r = 24;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  return (
    <div className="relative flex items-center gap-2.5 px-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-xl">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            stroke={urgent ? "#f43f5e" : "#38bdf8"}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <Clock className={`w-3.5 h-3.5 ${urgent ? "text-rose-400" : "text-sky-400"}`} />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
          Total Time
        </span>
        <span
          className={`text-sm font-bold font-mono leading-tight ${
            urgent ? "text-rose-400 animate-pulse" : "text-sky-400"
          }`}
        >
          {timeStr}
        </span>
      </div>
    </div>
  );
}

// ─── XP Float Animation ───────────────────────────────────────────────────────

function XPFloat({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed top-24 right-8 z-50 pointer-events-none"
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -60 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <span className="text-2xl font-black text-amber-400">+{xp} XP</span>
    </motion.div>
  );
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="bg-slate-950 border border-white/10 rounded-xl overflow-hidden font-mono text-sm">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-500/70" />
          <div className="w-3 h-3 rounded-full bg-amber-500/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-xs text-slate-500">code snippet</span>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-slate-200 leading-6 text-xs sm:text-sm">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-4">
              <span className="select-none text-slate-600 w-5 text-right shrink-0">
                {i + 1}
              </span>
              <span>{line || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ─── Answer Button ────────────────────────────────────────────────────────────

function AnswerBtn({
  optKey,
  text,
  selected,
  correctKey,
  submitted,
  onClick,
  disabled,
}: {
  optKey: string;
  text: string;
  selected: boolean;
  correctKey?: string;
  submitted: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  let style =
    "border-white/10 text-slate-300 hover:bg-white/5 hover:border-sky-500/40 hover:text-white";

  if (submitted && correctKey) {
    if (optKey === correctKey) {
      style = "border-emerald-500/60 bg-emerald-500/10 text-emerald-400";
    } else if (selected && optKey !== correctKey) {
      style = "border-rose-500/60 bg-rose-500/10 text-rose-400";
    } else {
      style = "border-white/5 text-slate-600";
    }
  } else if (selected) {
    style = "border-sky-500 bg-sky-500/10 text-sky-400";
  }

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all duration-150 ${style} ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-white/5 text-sm font-bold">
        {optKey}
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
      {submitted && correctKey && optKey === correctKey && (
        <CheckCircle2 className="ml-auto w-5 h-5 text-emerald-400 shrink-0" />
      )}
      {submitted && selected && optKey !== correctKey && (
        <XCircle className="ml-auto w-5 h-5 text-rose-400 shrink-0" />
      )}
    </motion.button>
  );
}

// ─── Main Game Player ─────────────────────────────────────────────────────────

const GAME_ICONS: Record<string, React.ElementType> = {
  quick_fire: Zap,
  debug_rush: Bug,
  tech_decision: GitBranch,
};

export default function GamePlayer() {
  const params = useParams();
  const router = useRouter();
  const gameType = params.gameType as string;

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState | null>(null);
  const [showXPFloat, setShowXPFloat] = useState(false);
  const [floatXP, setFloatXP] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStartRef = useRef<number>(0);
  const questionStartRef = useRef<number>(0);

  // Load session
  useEffect(() => {
    const validTypes = ["quick_fire", "debug_rush", "tech_decision"];
    if (!validTypes.includes(gameType)) {
      router.push("/student/skill-tests");
      return;
    }
    startSession(gameType as "quick_fire" | "debug_rush" | "tech_decision")
      .then((s) => {
        setSession(s);
        setPhase("countdown");
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail;
        if (msg && msg.toLowerCase().includes("already completed")) {
          setPhase("done");
        } else {
          setErrorMsg(msg || "Failed to start game. Please try again.");
          setPhase("error");
        }
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameType, router]);

  // Compute total game time from all questions
  const totalGameTime = session
    ? session.questions.reduce((acc, q) => acc + q.time_limit, 0)
    : 200;

  // Start single master timer when countdown completes
  const handleCountdownDone = useCallback(() => {
    if (!session) return;
    setPhase("question");
    const start = Date.now();
    gameStartRef.current = start;
    questionStartRef.current = start;
    setTotalElapsed(0);

    const totalSeconds = session.questions.reduce((acc, q) => acc + q.time_limit, 0);

    timerRef.current = setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setTotalElapsed(e);
      if (e >= totalSeconds + 2) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 100);

    setAnswerState({
      questionIndex: 0,
      selectedKey: null,
      response: null,
    });
  }, [session]);

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== "question" || !session) return;

    const handler = (e: KeyboardEvent) => {
      const keyMap: Record<string, string> = {
        a: "A",
        b: "B",
        c: "C",
        d: "D",
        "1": "A",
        "2": "B",
        "3": "C",
        "4": "D",
      };
      const key = keyMap[e.key.toLowerCase()];
      if (key) handleAnswer(key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIdx, session, answerState]);

  const handleAnswer = useCallback(
    async (key: string) => {
      if (!session || phase !== "question" || answerState?.selectedKey) return;

      const q = session.questions[currentIdx];
      const elapsedMs = Math.round(Date.now() - questionStartRef.current);

      setAnswerState({ questionIndex: currentIdx, selectedKey: key, response: null });

      try {
        const response = await submitAnswer({
          session_id: session.session_id,
          question_id: q.question_id,
          answer_key: key,
          elapsed_ms: elapsedMs,
        });

        setAnswerState((prev) => (prev ? { ...prev, response } : null));
        setPhase("feedback");

        if (response.xp_earned > 0) {
          setFloatXP(response.xp_earned);
          setShowXPFloat(true);
        }
      } catch {
        setErrorMsg("Failed to submit answer.");
        setPhase("error");
      }
    },
    [session, phase, answerState, currentIdx]
  );

  const handleNext = useCallback(async () => {
    if (!session) return;
    const nextIdx = currentIdx + 1;

    if (nextIdx >= session.total_questions) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("completing");
      try {
        await completeSession(session.session_id);
        router.push(`/student/skill-tests/results/${session.session_id}`);
      } catch {
        setErrorMsg("Failed to complete game.");
        setPhase("error");
      }
    } else {
      questionStartRef.current = Date.now();
      setCurrentIdx(nextIdx);
      setAnswerState({ questionIndex: nextIdx, selectedKey: null, response: null });
      setPhase("question");
    }
  }, [session, currentIdx, router]);

  // Loading state
  if (phase === "loading" || phase === "completing") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          {phase === "loading"
            ? "Generating personalized questions via AI..."
            : "Calculating XP & rank..."}
        </p>
      </div>
    );
  }

  // Error state
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-slate-200 font-semibold">{errorMsg || "An error occurred."}</p>
          <button
            onClick={() => router.push("/student/skill-tests")}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl transition-colors text-sm"
          >
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  // Already completed for today
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
            <h2 className="text-2xl font-black text-white">Completed for Today! 🎉</h2>
            <p className="text-slate-400 text-sm mt-1">
              You&apos;ve already completed {GAME_TYPE_LABELS[gameType] || "this game"} today. Each mode can be played once per day. Come back tomorrow for a new AI challenge!
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Link href="/student/skill-tests/leaderboard">
              <button className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400 font-bold rounded-xl transition-all text-sm">
                <Trophy className="w-4 h-4" /> View Leaderboard
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

  // Countdown state
  if (phase === "countdown") {
    const Icon = GAME_ICONS[gameType] || Zap;
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <button
            onClick={() => router.push("/student/skill-tests")}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Icon className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-white">{GAME_TYPE_LABELS[gameType]}</span>
        </div>
        <Countdown onDone={handleCountdownDone} />
      </div>
    );
  }

  if (!session || !session.questions[currentIdx]) return null;

  const currentQ: ArenaQuestion = session.questions[currentIdx];
  const progress = ((currentIdx + 1) / session.total_questions) * 100;
  const Icon = GAME_ICONS[gameType] || Zap;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col select-none">
      {/* Floating XP */}
      <AnimatePresence>
        {showXPFloat && (
          <XPFloat xp={floatXP} onDone={() => setShowXPFloat(false)} />
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/student/skill-tests")}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-white text-sm hidden sm:inline">
              {GAME_TYPE_LABELS[gameType]}
            </span>
          </div>
        </div>

        {/* Question Counter */}
        <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
          <span>Question</span>
          <span className="text-white">{currentIdx + 1}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{session.total_questions}</span>
        </div>

        {/* Single Master Timer Ring */}
        <MasterTimerRing total={totalGameTime} elapsed={totalElapsed} />
      </div>

      {/* ── Question Progress Bar ── */}
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
              {/* Skill Tag */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-md uppercase">
                  {currentQ.skill}
                </span>
                <span className="text-xs text-slate-500">
                  +{currentQ.xp_reward} XP base
                </span>
              </div>

              {/* Scenario (Tech Decision) */}
              {currentQ.scenario && (
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {currentQ.scenario}
                  </p>
                </div>
              )}

              {/* Code Snippet (Debug Rush) */}
              {currentQ.code_snippet && (
                <CodeBlock code={currentQ.code_snippet} />
              )}

              {/* Question Text */}
              <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {currentQ.question}
              </h2>

              {/* Answer Options */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt) => (
                  <AnswerBtn
                    key={opt.key}
                    optKey={opt.key}
                    text={opt.text}
                    selected={answerState?.selectedKey === opt.key}
                    correctKey={answerState?.response?.correct_key}
                    submitted={phase === "feedback"}
                    onClick={() => handleAnswer(opt.key)}
                    disabled={phase === "feedback"}
                  />
                ))}
              </div>

              {/* Feedback Banner */}
              <AnimatePresence>
                {phase === "feedback" && answerState?.response && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`rounded-xl p-4 border ${
                      answerState.response.is_correct
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {answerState.response.is_correct ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-bold text-emerald-400 text-sm">
                            Correct! +{answerState.response.xp_earned} XP
                            {answerState.response.speed_bonus > 0 &&
                              ` (incl. +${answerState.response.speed_bonus} speed bonus)`}
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
                    {answerState.response.explanation && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {answerState.response.explanation}
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
              <span>{currentIdx + 1 >= session.total_questions ? "Finish & View Results" : "Next Question"}</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
