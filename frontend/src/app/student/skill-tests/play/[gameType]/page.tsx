"use client";

/**
 * Individual game practice page — /student/skill-tests/play/[gameType]
 * Supports: spotbug, orderit, stackit (V2 games)
 * Legacy routes (quick_fire, debug_rush, tech_decision) redirect gracefully.
 *
 * Flow: loading → countdown → playing → submitting → done → error
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bug,
  ListOrdered,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Trophy,
  Star,
  RefreshCw,
} from "lucide-react";
import {
  startSession,
  completeSession,
  submitSpotBugAnswer,
  submitOrderItAnswer,
  submitStackItAnswer,
  ArenaQuestion,
  StartSessionResponse,
  CompleteSessionResponse,
  SpotBugCall,
  StackItPlacement,
  GAME_TYPE_LABELS,
} from "@/lib/arenaApi";
import { SpotBugGame } from "@/components/student/SpotBugGame";
import { OrderItGame } from "@/components/student/OrderItGame";
import { StackItGame } from "@/components/student/StackItGame";

type Phase = "loading" | "countdown" | "playing" | "submitting" | "done" | "error";

const GAME_ICONS: Record<string, React.ElementType> = {
  spotbug: Bug,
  orderit: ListOrdered,
  stackit: Layers,
};

const GAME_COLORS: Record<string, { header: string; icon: string }> = {
  spotbug:  { header: "bg-rose-500/10 border-rose-500/20",    icon: "text-rose-400" },
  orderit:  { header: "bg-violet-500/10 border-violet-500/20",  icon: "text-violet-400" },
  stackit:  { header: "bg-emerald-500/10 border-emerald-500/20", icon: "text-emerald-400" },
};

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
    </div>
  );
}

function ResultScreen({
  result,
  gameType,
  onPlayAgain,
}: {
  result: CompleteSessionResponse;
  gameType: string;
  onPlayAgain: () => void;
}) {
  const isPerfect = result.accuracy >= 99;
  const gr = result.game_results[0];
  const Icon = GAME_ICONS[gameType] || Star;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 max-w-sm mx-auto text-center py-8"
    >
      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${isPerfect ? "bg-amber-500/20 border-2 border-amber-500/50" : "bg-sky-500/20 border-2 border-sky-500/50"}`}>
        {isPerfect ? "🏆" : "✅"}
      </div>
      <div>
        <h2 className="text-2xl font-black text-white">{isPerfect ? "Perfect!" : "Round Complete"}</h2>
        <p className="text-slate-400 text-sm">{GAME_TYPE_LABELS[gameType]}</p>
      </div>

      <div className="w-full bg-slate-900/60 border border-white/5 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="text-3xl font-black text-amber-400">+{result.total_xp} XP</span>
        </div>
        {gr && (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-900/80 rounded-xl p-3">
              <p className="text-xl font-black text-white">{Math.round(gr.accuracy * 100)}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Accuracy</p>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-3">
              <p className="text-xl font-black text-white">Lvl {result.level_info.level}</p>
              <p className="text-xs text-slate-500 mt-0.5">{result.leveled_up ? "Level Up! 🎉" : `+${result.level_info.xp_in_level} XP in level`}</p>
            </div>
          </div>
        )}
      </div>

      {result.badges_earned.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {result.badges_earned.map((b) => (
            <span key={b} className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full">
              🏆 {b}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onPlayAgain}
          className="flex items-center justify-center gap-2 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-sky-500/25 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          Play Again
        </button>
        <Link href="/student/skill-tests">
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-white/8 transition-colors">
            <Trophy className="w-4 h-4" />
            Arena Home
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

//  Main 

export default function GamePlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameType = (params?.gameType as string) || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [result, setResult] = useState<CompleteSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);

  const isV2Game = ["spotbug", "orderit", "stackit"].includes(gameType);

  const loadSession = useCallback(async () => {
    if (!isV2Game) {
      // Redirect legacy game types to arena home
      router.replace("/student/skill-tests");
      return;
    }
    setPhase("loading");
    setResult(null);
    completedRef.current = false;
    try {
      const s = await startSession(gameType as "spotbug" | "orderit" | "stackit");
      setSession(s);
      setPhase("playing");
    } catch (e: unknown) {
      const axiosMsg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(axiosMsg || "Failed to start game. Please try again.");
      setPhase("error");
    }
  }, [gameType, isV2Game, router]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const q = session?.questions[0] ?? null;

  const finalizeSession = useCallback(async () => {
    if (completedRef.current || !session) return;
    completedRef.current = true;
    setPhase("submitting");
    try {
      const res = await completeSession(session.session_id);
      setResult(res);
      setPhase("done");
    } catch (e: unknown) {
      const axiosMsg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(axiosMsg || "Failed to save results.");
      setPhase("error");
    }
  }, [session]);

  const handleSpotBugComplete = useCallback(async (calls: SpotBugCall[], elapsedMs: number) => {
    if (!session || !q) return;
    try {
      await submitSpotBugAnswer({ session_id: session.session_id, question_id: q.question_id, calls, elapsed_ms: elapsedMs });
    } catch (e) { console.warn("SpotBug submit:", e); }
    finalizeSession();
  }, [session, q, finalizeSession]);

  const handleOrderItComplete = useCallback(async (userOrder: string[], elapsedMs: number) => {
    if (!session || !q) return;
    try {
      await submitOrderItAnswer({ session_id: session.session_id, question_id: q.question_id, user_order: userOrder, elapsed_ms: elapsedMs });
    } catch (e) { console.warn("OrderIt submit:", e); }
    finalizeSession();
  }, [session, q, finalizeSession]);

  const handleStackItComplete = useCallback(async (placements: StackItPlacement[], elapsedMs: number) => {
    if (!session || !q) return;
    try {
      await submitStackItAnswer({ session_id: session.session_id, question_id: q.question_id, placements, elapsed_ms: elapsedMs });
    } catch (e) { console.warn("StackIt submit:", e); }
    finalizeSession();
  }, [session, q, finalizeSession]);

  const Icon = GAME_ICONS[gameType] || Star;
  const colors = GAME_COLORS[gameType] || GAME_COLORS.spotbug;
  const label = GAME_TYPE_LABELS[gameType] || gameType;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 py-6 max-w-2xl mx-auto">
      {/* Header */}
      {(phase === "countdown" || phase === "playing" || phase === "loading" || phase === "error") && (
        <div className="flex items-center gap-3 mb-6">
          <Link href="/student/skill-tests" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${colors.header}`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
            <span className="text-sm font-bold text-white">{label}</span>
          </div>
          {q && (
            <span className="text-xs text-slate-500 ml-auto capitalize">{q.skill} · {q.difficulty}</span>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Loading */}
        {phase === "loading" && (
          <motion.div key="loading" className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <p className="text-slate-400 text-sm">Generating your question…</p>
          </motion.div>
        )}

        {/* Playing */}
        {phase === "playing" && session && q && (
          <motion.div key="playing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {gameType === "spotbug" && q.spotbug_payload && (
              <SpotBugGame
                questionId={q.question_id}
                question={q.question}
                cards={q.spotbug_payload.cards}
                timeLimit={q.time_limit}
                xpReward={q.xp_reward}
                onComplete={handleSpotBugComplete}
              />
            )}
            {gameType === "orderit" && session.questions.length > 0 && (
              <OrderItGame
                questions={session.questions}
                sessionId={session.session_id}
                onComplete={() => finalizeSession()}
              />
            )}
            {gameType === "stackit" && session.questions.length > 0 && (
              <StackItGame
                questions={session.questions}
                sessionId={session.session_id}
                onComplete={() => finalizeSession()}
              />
            )}
          </motion.div>
        )}

        {/* Submitting */}
        {phase === "submitting" && (
          <motion.div key="submitting" className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-slate-300 font-semibold">Calculating score…</p>
          </motion.div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ResultScreen result={result} gameType={gameType} onPlayAgain={loadSession} />
          </motion.div>
        )}

        {/* Error */}
        {phase === "error" && (
          <motion.div key="error" className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-rose-400" />
            <h2 className="text-xl font-bold text-white">Oops!</h2>
            <p className="text-slate-400 text-sm max-w-xs">{error}</p>
            <button onClick={loadSession} className="px-5 py-2.5 bg-sky-500 text-white text-sm font-bold rounded-xl hover:bg-sky-400 transition-colors active:scale-95">
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
