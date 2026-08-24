"use client";

/**
 * SpotBugGame — Spot the Bug
 * Mechanic: swipe-to-judge code cards with Framer Motion drag gesture.
 * Shows a How-To-Play explanation screen with a NEXT button before timer starts.
 * Each card slides in from the right. User swipes right (Clean) or left (Buggy).
 * Correct chain builds a combo multiplier. Timer runs across the whole queue.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from "framer-motion";
import { Bug, CheckCircle2, Zap, Clock, Flame, Play, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import type { SpotBugCardOut, SpotBugCall } from "@/lib/arenaApi";

interface SpotBugGameProps {
  questionId: string;
  question: string;
  cards: SpotBugCardOut[];
  timeLimit: number; // seconds for the whole queue
  xpReward: number;
  onComplete: (calls: SpotBugCall[], elapsedMs: number) => void;
}

//  Timer Hook 

function useTimer(totalSeconds: number, onExpire: () => void, active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    expiredRef.current = false;
    intervalRef.current = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      setElapsed(e);
      if (!expiredRef.current && e >= totalSeconds) {
        expiredRef.current = true;
        clearInterval(intervalRef.current!);
        onExpire();
      }
    }, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [totalSeconds, onExpire, active]);

  return { elapsed, elapsedMs: () => Date.now() - startRef.current };
}

//  Timer Ring 

function TimerRing({ elapsed, total }: { elapsed: number; total: number }) {
  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const pct = Math.max(0, Math.min(1, 1 - elapsed / total));
  const urgent = remaining <= 20;
  const r = 20;
  const circ = 2 * Math.PI * r;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-xl">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 46 46">
          <circle cx="23" cy="23" r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
          <circle
            cx="23"
            cy="23"
            r={r}
            fill="none"
            stroke={urgent ? "#f43f5e" : "#38bdf8"}
            strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={circ - circ * pct}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.2s linear" }}
          />
        </svg>
        <Clock className={`w-3 h-3 ${urgent ? "text-rose-400 animate-pulse" : "text-sky-400"}`} />
      </div>
      <span className={`text-sm font-bold font-mono tabular-nums ${urgent ? "text-rose-400" : "text-slate-200"}`}>
        {timeStr}
      </span>
    </div>
  );
}

//  How To Play Screen 

function HowToPlaySpotBug({
  cardsCount,
  timeLimit,
  onStart,
}: {
  cardsCount: number;
  timeLimit: number;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-slate-900/80 border border-rose-500/20 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6 max-w-lg mx-auto"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
          <Bug className="w-6 h-6 text-rose-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              Reflex Review
            </span>
            <span className="text-xs text-slate-500 font-mono">⏱️ {timeLimit}s Total</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">How to Play Spot the Bug</h2>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        Review short code snippets quickly. Decide whether each snippet is <strong>Clean</strong> or contains a <strong>Bug</strong>.
      </p>

      {/* Rules list */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-xs">
            👉
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-emerald-300">Swipe RIGHT (or Tap Clean)</p>
            <p className="text-slate-400">If the code snippet has correct syntax and logic.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0 text-rose-400 font-bold text-xs">
            👈
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-rose-300">Swipe LEFT (or Tap Buggy)</p>
            <p className="text-slate-400">If the code snippet has a bug, syntax error, or bad practice.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 text-amber-400 font-bold text-xs">
            ⚡
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-300">Combo Multiplier</p>
            <p className="text-slate-400">+8 XP per correct call. Streak 3+ in a row for escalating combo bonus XP!</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/15 text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
        <span>Queue contains <strong>{cardsCount} cards</strong>. Timer starts when you press Next.</span>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 py-4 bg-linear-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-black text-base rounded-xl transition-all shadow-lg shadow-rose-500/25 active:scale-95"
      >
        <span>Start Game</span>
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </motion.div>
  );
}

//  Swipeable Card 

function SwipeCard({
  card,
  onCall,
  cardIndex,
  total,
}: {
  card: SpotBugCardOut;
  onCall: (userSaidBuggy: boolean) => void;
  cardIndex: number;
  total: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -80, 0, 80, 200], [0.4, 1, 1, 1, 0.4]);
  const controls = useAnimation();

  const buggyOpacity = useTransform(x, [-150, -30], [1, 0]);
  const cleanOpacity = useTransform(x, [30, 150], [0, 1]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      const threshold = 80;
      if (info.offset.x < -threshold) {
        controls.start({ x: -500, opacity: 0, transition: { duration: 0.3 } }).then(() =>
          onCall(true) // swiped left = Buggy
        );
      } else if (info.offset.x > threshold) {
        controls.start({ x: 500, opacity: 0, transition: { duration: 0.3 } }).then(() =>
          onCall(false) // swiped right = Clean
        );
      } else {
        controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      }
    },
    [controls, onCall]
  );

  return (
    <motion.div
      key={card.id}
      initial={{ x: 350, opacity: 0, scale: 0.9 }}
      animate={controls}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
      onAnimationComplete={() => {
        controls.start({ x: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 28 } });
      }}
    >
      {/* Buggy overlay — appears when swiping left */}
      <motion.div
        style={{ opacity: buggyOpacity }}
        className="absolute inset-0 rounded-2xl bg-rose-500/20 border-2 border-rose-500/60 flex items-center justify-center z-10 pointer-events-none"
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/30 rounded-xl border border-rose-500/50">
          <Bug className="w-5 h-5 text-rose-400" />
          <span className="text-rose-300 font-black text-lg tracking-wider">BUGGY</span>
        </div>
      </motion.div>

      {/* Clean overlay — appears when swiping right */}
      <motion.div
        style={{ opacity: cleanOpacity }}
        className="absolute inset-0 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center z-10 pointer-events-none"
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/30 rounded-xl border border-emerald-500/50">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-300 font-black text-lg tracking-wider">CLEAN</span>
        </div>
      </motion.div>

      {/* Card content */}
      <div className="w-full h-full bg-slate-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
            Card {cardIndex + 1} / {total}
          </span>
          <span className="text-xs text-slate-600">← Buggy · Clean →</span>
        </div>

        {/* Code snippet */}
        <div className="flex-1 bg-slate-950 rounded-xl border border-white/5 p-4 overflow-auto">
          <pre className="text-sm font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap break-all">
            {card.snippet}
          </pre>
        </div>

        {/* Tap buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              onCall(true);
            }}
            className="flex items-center justify-center gap-2 py-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/20 transition-colors active:scale-95 cursor-pointer"
          >
            <Bug className="w-4 h-4" />
            Buggy
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              onCall(false);
            }}
            className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold text-sm hover:bg-emerald-500/20 transition-colors active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Clean
          </button>
        </div>
      </div>
    </motion.div>
  );
}

//  Main Component 

export function SpotBugGame({
  questionId,
  question,
  cards,
  timeLimit,
  xpReward,
  onComplete,
}: SpotBugGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [calls, setCalls] = useState<SpotBugCall[]>([]);
  const [combo, setCombo] = useState(0);
  const [done, setDone] = useState(false);
  const cardStartRef = useRef(Date.now());
  const globalStartRef = useRef(Date.now());

  const handleExpire = useCallback(() => {
    if (!done) {
      setDone(true);
      const elapsedMs = Date.now() - globalStartRef.current;
      setCalls((prev) => {
        onComplete(prev, elapsedMs);
        return prev;
      });
    }
  }, [done, onComplete]);

  const { elapsed } = useTimer(timeLimit, handleExpire, isPlaying && !done);

  const handleStartGame = () => {
    globalStartRef.current = Date.now();
    cardStartRef.current = Date.now();
    setIsPlaying(true);
  };

  const handleCall = useCallback(
    (userSaidBuggy: boolean) => {
      if (done) return;
      const timeTakenMs = Date.now() - cardStartRef.current;
      cardStartRef.current = Date.now();

      const newCall: SpotBugCall = {
        card_id: cards[currentIndex].id,
        user_said_buggy: userSaidBuggy,
        time_taken_ms: timeTakenMs,
      };

      setCalls((prev) => {
        const next = [...prev, newCall];
        if (currentIndex >= cards.length - 1) {
          // Queue complete
          setDone(true);
          const elapsed = Date.now() - globalStartRef.current;
          onComplete(next, elapsed);
        }
        return next;
      });

      setCurrentIndex((i) => i + 1);
    },
    [done, cards, currentIndex, onComplete]
  );

  // 1. Show How to Play intro screen first
  if (!isPlaying) {
    return (
      <HowToPlaySpotBug
        cardsCount={cards.length}
        timeLimit={timeLimit}
        onStart={handleStartGame}
      />
    );
  }

  // 2. Submitting state
  if (done || currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
        <p className="text-slate-300 font-semibold">Submitting your calls…</p>
      </div>
    );
  }

  const remaining = cards.length - currentIndex;

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center">
            <Bug className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Spot the Bug</p>
            <p className="text-xs text-slate-500">{remaining} cards left</p>
          </div>
        </div>
        <TimerRing elapsed={elapsed} total={timeLimit} />
      </div>

      {/* Combo indicator */}
      <AnimatePresence>
        {combo > 0 && (
          <motion.div
            key={combo}
            initial={{ scale: 0.5, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-center gap-2"
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-black text-sm">
              {combo}× COMBO
            </span>
            {combo > 3 && (
              <span className="text-xs text-amber-500 font-bold">
                +{Math.min((combo - 3) * 2, 20)} bonus XP/card
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card stack */}
      <div className="relative h-72 w-full">
        {/* Background stack cards */}
        {currentIndex + 1 < cards.length && (
          <div className="absolute inset-0 scale-95 translate-y-2 bg-slate-800/60 border border-white/5 rounded-2xl" />
        )}
        {currentIndex + 2 < cards.length && (
          <div className="absolute inset-0 scale-90 translate-y-4 bg-slate-800/40 border border-white/3 rounded-2xl" />
        )}

        <AnimatePresence mode="wait">
          <SwipeCard
            key={currentIndex}
            card={cards[currentIndex]}
            onCall={handleCall}
            cardIndex={currentIndex}
            total={cards.length}
          />
        </AnimatePresence>
      </div>

      {/* XP preview */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>+8 XP per correct call · Combo bonus after 3 in a row</span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              i < currentIndex
                ? "bg-emerald-500"
                : i === currentIndex
                ? "bg-sky-400 scale-125"
                : "bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default SpotBugGame;
