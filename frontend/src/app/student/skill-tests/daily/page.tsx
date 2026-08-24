"use client";

/**
 * Daily Arena Page — Three-game sequential flow
 * Phases: info → loading → countdown → game_spotbug → game_orderit → game_stackit → completing → done | error
 * Completed state: lock screen with countdown to next reset, View Results + View Ranking CTAs
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  CheckCircle2,
  Trophy,
  Clock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Bug,
  ListOrdered,
  Layers,
  Flame,
  Zap,
  Star,
} from "lucide-react";

import {
  getDailyArena,
  startDailyArena,
  completeDailyArena,
  submitSpotBugAnswer,
  submitOrderItAnswer,
  submitStackItAnswer,
  DailyArenaOut,
  StartSessionResponse,
  ArenaQuestion,
  SpotBugCall,
  StackItPlacement,
  CompleteSessionResponse,
  formatCountdown,
} from "@/lib/arenaApi";

import { SpotBugGame } from "@/components/student/SpotBugGame";
import { OrderItGame } from "@/components/student/OrderItGame";
import { StackItGame } from "@/components/student/StackItGame";

//  Types 

type Phase =
  | "checking"
  | "completed_today"
  | "info"
  | "loading"
  | "countdown"
  | "game_spotbug"
  | "game_orderit"
  | "game_stackit"
  | "completing"
  | "done"
  | "error";

//  Countdown 

function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    if (count === 0) { setTimeout(onDone, 300); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
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
        Daily Arena Starting…
      </p>
    </div>
  );
}

//  Completed-Today Lock Screen 

function CompletedTodayScreen({
  daily,
  sessionId,
}: {
  daily: DailyArenaOut;
  sessionId?: string;
}) {
  const [countdown, setCountdown] = useState(
    daily.next_reset_at ? formatCountdown(daily.next_reset_at) : "--"
  );

  useEffect(() => {
    if (!daily.next_reset_at) return;
    const id = setInterval(() => {
      setCountdown(formatCountdown(daily.next_reset_at!));
    }, 1000);
    return () => clearInterval(id);
  }, [daily.next_reset_at]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 max-w-sm mx-auto px-4 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center"
      >
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Arena Complete</span>
        </div>
        <h1 className="text-3xl font-black text-white">Today's Done! 🎉</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          You've already completed today's Daily Arena. See how you rank or review your results.
        </p>
      </motion.div>

      {/* Countdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-2 px-4 py-3 bg-slate-900/60 border border-white/8 rounded-xl"
      >
        <Clock className="w-4 h-4 text-sky-400" />
        <span className="text-sm text-slate-400">
          Next Arena in{" "}
          <span className="text-sky-400 font-bold font-mono tabular-nums">{countdown}</span>
        </span>
      </motion.div>

      {/* Stats from today */}
      {daily.time_taken_str && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-2 text-sm text-slate-500"
        >
          <Clock className="w-3 h-3" />
          <span>Completed in <span className="text-sky-400 font-mono font-bold">{daily.time_taken_str}</span></span>
        </motion.div>
      )}

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex flex-col gap-3 w-full"
      >
        <Link href="/student/skill-tests/leaderboard">
          <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-sky-500/25 active:scale-95">
            <Trophy className="w-4 h-4" />
            View Ranking
          </button>
        </Link>
        {sessionId && (
          <Link href={`/student/skill-tests/results/${sessionId}`}>
            <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-white/8 transition-colors active:scale-95">
              View My Results
            </button>
          </Link>
        )}
        <Link href="/student/skill-tests">
          <button className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors py-2">
            ← Back to Arena
          </button>
        </Link>
      </motion.div>
    </div>
  );
}

//  Game progress indicator 

const GAME_STEPS = [
  { key: "spotbug", label: "Spot the Bug", icon: Bug, color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/30" },
  { key: "orderit", label: "Order the Steps", icon: ListOrdered, color: "text-violet-400", bg: "bg-violet-500/15 border-violet-500/30" },
  { key: "stackit", label: "Stack It", icon: Layers, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
];

function GameProgressBar({ currentPhase }: { currentPhase: Phase }) {
  const stepIndex = currentPhase === "game_spotbug" ? 0
    : currentPhase === "game_orderit" ? 1
    : currentPhase === "game_stackit" ? 2
    : -1;

  if (stepIndex === -1) return null;

  return (
    <div className="flex items-center gap-2 mb-6">
      {GAME_STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = i < stepIndex;
        const isActive = i === stepIndex;
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all
              ${isDone ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                isActive ? `${step.bg} ${step.color}` :
                "bg-slate-900/40 border-white/5 text-slate-600"}`}>
              {isDone ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < GAME_STEPS.length - 1 && (
              <div className={`h-px flex-1 ${i < stepIndex ? "bg-emerald-500/40" : "bg-slate-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

//  Results Summary 

function DoneScreen({ result, onViewDetails }: { result: CompleteSessionResponse; onViewDetails: () => void }) {
  const isPerfect = result.accuracy >= 99;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 max-w-sm mx-auto text-center py-8"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
        className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-2xl
          ${isPerfect ? "bg-amber-500/20 border-2 border-amber-500/50" : "bg-sky-500/20 border-2 border-sky-500/50"}`}
      >
        {isPerfect ? "🏆" : "🎯"}
      </motion.div>

      <div className="space-y-1">
        <h2 className="text-3xl font-black text-white">
          {isPerfect ? "Flawless!" : "Arena Complete!"}
        </h2>
        <p className="text-slate-400 text-sm">Daily Arena finished</p>
      </div>

      {/* XP earned */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-linear-to-r from-amber-500/10 to-sky-500/10 border border-amber-500/20 rounded-2xl p-5 w-full space-y-4"
      >
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="text-3xl font-black text-amber-400">+{result.total_xp} XP</span>
        </div>
        {result.daily_bonus_xp && (
          <p className="text-xs text-amber-500/70">Includes +{result.daily_bonus_xp} XP daily completion bonus</p>
        )}
        {result.leveled_up && (
          <div className="flex items-center justify-center gap-1.5 text-sky-400 text-sm font-bold">
            <Star className="w-4 h-4" />
            Level Up! You're now Level {result.level_info.level}!
          </div>
        )}
        {result.arena_streak > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-amber-400 text-sm">
            <Flame className="w-4 h-4" />
            <span>{result.arena_streak} Day Streak!</span>
          </div>
        )}
      </motion.div>

      {/* Per-game breakdown */}
      {result.game_results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full space-y-2"
        >
          {result.game_results.map((gr) => {
            const step = GAME_STEPS.find((s) => s.key === gr.game_type);
            const Icon = step?.icon || Zap;
            return (
              <div key={gr.question_id} className="flex items-center gap-3 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${step?.bg || "bg-slate-800"}`}>
                  <Icon className={`w-3.5 h-3.5 ${step?.color || "text-slate-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{step?.label || gr.game_type}</p>
                  <p className="text-xs text-slate-500">{gr.skill}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-400">+{gr.xp_earned} XP</p>
                  <p className="text-xs text-slate-500">{Math.round(gr.accuracy * 100)}% acc.</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Badges */}
      {result.badges_earned.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {result.badges_earned.map((b) => (
            <span key={b} className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full">
              🏆 {b}
            </span>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full">
        <Link href="/student/skill-tests/leaderboard">
          <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-sky-500/25 active:scale-95">
            <Trophy className="w-4 h-4" />
            View Ranking
          </button>
        </Link>
        <button
          onClick={onViewDetails}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-white/8 transition-colors active:scale-95"
        >
          View Detailed Results
        </button>
        <Link href="/student/skill-tests">
          <button className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors py-2">
            ← Back to Arena
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

//  Main Page 

export default function DailyArenaPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [daily, setDaily] = useState<DailyArenaOut | null>(null);
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [result, setResult] = useState<CompleteSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const completedRef = useRef(false);

  // Get questions for each game type from session
  const getQuestion = useCallback((gameType: string): ArenaQuestion | null => {
    return session?.questions.find((q) => q.game_type === gameType) ?? null;
  }, [session]);

  // Check daily status on mount
  useEffect(() => {
    getDailyArena()
      .then((d) => {
        setDaily(d);
        if (d.already_completed) {
          setPhase("completed_today");
        } else {
          setPhase("info");
        }
      })
      .catch(() => setPhase("error"));
  }, []);

  const handleStartArena = async () => {
    setPhase("loading");
    try {
      const s = await startDailyArena();
      setSession(s);
      setPhase("game_spotbug");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start Daily Arena. Please try again.";
      const axiosMsg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (axiosMsg?.includes("already completed")) {
        // Refresh daily status
        const d = await getDailyArena().catch(() => null);
        if (d) setDaily(d);
        setPhase("completed_today");
      } else {
        setError(axiosMsg || msg);
        setPhase("error");
      }
    }
  };

  // ── SpotBug complete ──
  const handleSpotBugComplete = async (calls: SpotBugCall[], elapsedMs: number) => {
    if (!session) return;
    const q = getQuestion("spotbug");
    if (!q) { setPhase("game_orderit"); return; }
    try {
      await submitSpotBugAnswer({
        session_id: session.session_id,
        question_id: q.question_id,
        calls,
        elapsed_ms: elapsedMs,
      });
    } catch (e) {
      console.warn("SpotBug answer submit failed (non-fatal):", e);
    }
    setPhase("game_orderit");
  };

  // ── OrderIt complete ──
  const handleOrderItComplete = async (userOrder: string[], elapsedMs: number) => {
    if (!session) return;
    const q = getQuestion("orderit");
    if (!q) { setPhase("game_stackit"); return; }
    try {
      await submitOrderItAnswer({
        session_id: session.session_id,
        question_id: q.question_id,
        user_order: userOrder,
        elapsed_ms: elapsedMs,
      });
    } catch (e) {
      console.warn("OrderIt answer submit failed (non-fatal):", e);
    }
    setPhase("game_stackit");
  };

  // ── StackIt complete ──
  const handleStackItComplete = async (placements: StackItPlacement[], elapsedMs: number) => {
    if (!session) return;
    const q = getQuestion("stackit");
    if (!q) { finalizeArena(); return; }
    try {
      await submitStackItAnswer({
        session_id: session.session_id,
        question_id: q.question_id,
        placements,
        elapsed_ms: elapsedMs,
      });
    } catch (e) {
      console.warn("StackIt answer submit failed (non-fatal):", e);
    }
    finalizeArena();
  };

  const finalizeArena = useCallback(async () => {
    if (completedRef.current || !session) return;
    completedRef.current = true;
    setPhase("completing");
    try {
      const res = await completeDailyArena(session.session_id);
      setResult(res);
      setCompletedSessionId(session.session_id);
      setPhase("done");
    } catch (e: unknown) {
      const axiosMsg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (axiosMsg?.includes("already completed")) {
        // Already completed (e.g. double-submit) — show completed state
        const d = await getDailyArena().catch(() => null);
        if (d) setDaily(d);
        setPhase("completed_today");
      } else {
        setError(axiosMsg || "Failed to finalize arena.");
        setPhase("error");
      }
    }
  }, [session]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 py-6 max-w-2xl mx-auto">
      {/* Back link (only when not playing) */}
      {(phase === "info" || phase === "completed_today" || phase === "error") && (
        <Link href="/student/skill-tests" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Arena Home
        </Link>
      )}

      <AnimatePresence mode="wait">

        {/* ── Checking ── */}
        {phase === "checking" && (
          <motion.div key="checking" className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          </motion.div>
        )}

        {/* ── Completed Today ── */}
        {phase === "completed_today" && daily && (
          <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CompletedTodayScreen daily={daily} sessionId={completedSessionId || undefined} />
          </motion.div>
        )}

        {/* ── Info / Pre-start ── */}
        {phase === "info" && daily && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Daily Arena</span>
              </div>
              <h1 className="text-3xl font-black text-white">Today's Challenge</h1>
              <p className="text-slate-400 mt-1 text-sm">Three games. ~5 minutes. Earn XP and climb the leaderboard.</p>
            </div>

            {/* Three game cards */}
            <div className="grid grid-cols-1 gap-3">
              {GAME_STEPS.map((step, i) => {
                const Icon = step.icon;
                const xpMap = ["Up to 116 XP", "Up to 20 XP", "Up to 40 XP"];
                const timeMap = ["90 seconds", "60 seconds", "75 seconds"];
                return (
                  <div key={step.key} className={`flex items-center gap-4 p-4 rounded-xl border ${step.bg}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${step.bg}`}>
                      <Icon className={`w-5 h-5 ${step.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">{step.label}</p>
                      <p className="text-xs text-slate-400">{xpMap[i]} · {timeMap[i]}</p>
                    </div>
                    <span className="text-xs text-slate-600 font-mono">#{i + 1}</span>
                  </div>
                );
              })}
            </div>

            {/* Daily bonus callout */}
            <div className="flex items-center gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
              <Zap className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">+50 XP Completion Bonus</p>
                <p className="text-xs text-slate-400">Awarded once when you finish all three games</p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStartArena}
              className="w-full flex items-center justify-center gap-2 py-4 bg-sky-500 hover:bg-sky-400 text-white font-black text-base rounded-xl transition-colors shadow-xl shadow-sky-500/30 active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              Play Today's Arena
            </motion.button>
          </motion.div>
        )}

        {/* ── Loading ── */}
        {phase === "loading" && (
          <motion.div key="loading" className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
            <p className="text-slate-400 text-sm">Generating your personalized arena…</p>
            <p className="text-slate-600 text-xs">Targeting your skill gaps with Groq AI</p>
          </motion.div>
        )}

        {/* ── Game 1: Spot the Bug ── */}
        {phase === "game_spotbug" && session && (
          <motion.div key="spotbug" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <GameProgressBar currentPhase={phase} />
            {(() => {
              const q = getQuestion("spotbug");
              if (!q?.spotbug_payload) return <div className="text-rose-400 text-sm">Spot the Bug question not found.</div>;
              return (
                <SpotBugGame
                  questionId={q.question_id}
                  question={q.question}
                  cards={q.spotbug_payload.cards}
                  timeLimit={q.time_limit}
                  xpReward={q.xp_reward}
                  onComplete={handleSpotBugComplete}
                />
              );
            })()}
          </motion.div>
        )}

        {/* ── Game 2: Order the Steps ── */}
        {phase === "game_orderit" && session && (
          <motion.div key="orderit" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <GameProgressBar currentPhase={phase} />
            {(() => {
              const q = getQuestion("orderit");
              if (!q?.orderit_payload) return <div className="text-rose-400 text-sm">Order the Steps question not found.</div>;
              return (
                <OrderItGame
                  questionId={q.question_id}
                  question={q.question}
                  items={q.orderit_payload.items}
                  timeLimit={q.time_limit}
                  xpReward={q.xp_reward}
                  onComplete={handleOrderItComplete}
                />
              );
            })()}
          </motion.div>
        )}

        {/* ── Game 3: Stack It ── */}
        {phase === "game_stackit" && session && (
          <motion.div key="stackit" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <GameProgressBar currentPhase={phase} />
            {(() => {
              const q = getQuestion("stackit");
              if (!q?.stackit_payload) return <div className="text-rose-400 text-sm">Stack It question not found.</div>;
              return (
                <StackItGame
                  questionId={q.question_id}
                  question={q.question}
                  scenario={q.stackit_payload.scenario}
                  zones={q.stackit_payload.zones}
                  components={q.stackit_payload.components}
                  timeLimit={q.time_limit}
                  xpReward={q.xp_reward}
                  difficulty={q.difficulty}
                  onComplete={handleStackItComplete}
                />
              );
            })()}
          </motion.div>
        )}

        {/* ── Completing ── */}
        {phase === "completing" && (
          <motion.div key="completing" className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            <p className="text-slate-300 font-semibold">Calculating your score…</p>
          </motion.div>
        )}

        {/* ── Done ── */}
        {phase === "done" && result && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DoneScreen
              result={result}
              onViewDetails={() =>
                router.push(`/student/skill-tests/results/${session?.session_id}`)
              }
            />
          </motion.div>
        )}

        {/* ── Error ── */}
        {phase === "error" && (
          <motion.div
            key="error"
            className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center"
          >
            <AlertCircle className="w-12 h-12 text-rose-400" />
            <h2 className="text-xl font-bold text-white">Something went wrong</h2>
            <p className="text-slate-400 text-sm max-w-xs">{error || "Failed to load the Daily Arena."}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-sky-500 text-white text-sm font-bold rounded-xl hover:bg-sky-400 transition-colors active:scale-95"
            >
              Try Again
            </button>
            <Link href="/student/skill-tests" className="text-xs text-slate-500 hover:text-slate-400">
              ← Back to Arena
            </Link>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
