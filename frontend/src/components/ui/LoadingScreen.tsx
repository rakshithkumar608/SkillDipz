"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface LoadingScreenProps {
  onComplete?: () => void;
  /** Snappy default duration: 1400ms */
  duration?: number;
}

const LOGO_LETTERS = "SKILLDIPZ".split("");

const LOADING_MESSAGES = [
  { threshold: 0, text: "Preparing your workspace" },
  { threshold: 25, text: "Loading your learning path" },
  { threshold: 55, text: "Setting up your experience" },
  { threshold: 82, text: "Almost there..." },
  { threshold: 100, text: "Ready to build your skills" },
];

export function LoadingScreen({
  onComplete,
  duration = 1400,
}: LoadingScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // ─── Fast & Smooth Progress Animation (0% → 100%) ──────────────────────────
  useEffect(() => {
    let animationFrameId: number;

    const animateProgress = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const rawProgress = Math.min((elapsed / duration) * 100, 100);

      setProgress(Math.round(rawProgress));

      if (rawProgress < 100) {
        animationFrameId = requestAnimationFrame(animateProgress);
      } else {
        setIsCompleted(true);
      }
    };

    animationFrameId = requestAnimationFrame(animateProgress);
    return () => cancelAnimationFrame(animationFrameId);
  }, [duration]);

  // ─── 4 Dots Looping Wave Animation ────────────────────────────────────────
  useEffect(() => {
    if (isCompleted) return;

    const dotInterval = setInterval(() => {
      setActiveDotIndex((prev) => (prev + 1) % 4);
    }, 170);

    return () => clearInterval(dotInterval);
  }, [isCompleted]);

  // ─── Fast Completion Handshake ─────────────────────────────────────────────
  useEffect(() => {
    if (!isCompleted) return;

    // After 100% is reached: quick 200ms pause, then trigger onComplete immediately
    const timer = setTimeout(() => {
      onComplete?.();
    }, 220);

    return () => clearTimeout(timer);
  }, [isCompleted, onComplete]);

  // Determine current active message based on progress threshold
  const currentMessage =
    [...LOADING_MESSAGES]
      .reverse()
      .find((m) => progress >= m.threshold)?.text ??
    "Preparing your workspace";

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8F8F5] select-none overflow-hidden px-6"
    >
      <div className="flex flex-col items-center w-full max-w-[360px] text-center">
        {/* ─── 1 & 2. SKILLDIPZ Logo with Staggered Entrance ──────────────── */}
        <motion.div
          initial={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.94,
            y: shouldReduceMotion ? 0 : 6,
          }}
          animate={
            isCompleted
              ? {
                  opacity: 1,
                  scale: shouldReduceMotion ? 1 : [1, 1.025, 1],
                  y: 0,
                  transition: { duration: 0.25, ease: "easeInOut" },
                }
              : {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: { duration: 0.35, ease: "easeOut" },
                }
          }
          className="flex items-center justify-center tracking-[0.22em] font-extrabold text-[#0A1128] text-2xl sm:text-3xl uppercase mb-7"
        >
          {LOGO_LETTERS.map((letter, idx) => (
            <motion.span
              key={idx}
              initial={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.25,
                delay: shouldReduceMotion ? 0 : 0.05 + idx * 0.025,
                ease: "easeOut",
              }}
              className="inline-block"
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>

        {/* ─── 3. Animated Electric-Blue Dots (● ● ● ●) ────────────────────── */}
        <div className="h-6 flex items-center justify-center mb-5">
          <AnimatePresence>
            {!isCompleted ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5"
              >
                {[0, 1, 2, 3].map((dotIdx) => {
                  const isActive = activeDotIndex === dotIdx;
                  return (
                    <motion.span
                      key={dotIdx}
                      animate={
                        shouldReduceMotion
                          ? { opacity: isActive ? 1 : 0.4 }
                          : {
                              scale: isActive ? 1.35 : 1,
                              y: isActive ? -3 : 0,
                              opacity: isActive ? 1 : 0.35,
                            }
                      }
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="w-2 h-2 rounded-full bg-[#0052FF] inline-block"
                    />
                  );
                })}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ─── 4. Loading Status Message ───────────────────────────────────── */}
        <div className="h-6 flex items-center justify-center mb-5">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentMessage}
              initial={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 4,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : -4,
              }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="text-sm font-medium text-[#334155] tracking-tight whitespace-nowrap"
            >
              {currentMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* ─── 5. Horizontal Progress Bar ──────────────────────────────────── */}
        <div className="w-[72vw] max-w-[290px] h-[6px] bg-[#E2E8F0] rounded-full overflow-hidden mb-2.5">
          <motion.div
            className="h-full bg-[#0052FF] rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        {/* ─── 6. Percentage Counter (0% → 100%) ───────────────────────────── */}
        <div className="w-[72vw] max-w-[290px] flex justify-end">
          <span className="text-xs font-semibold text-[#64748B] font-mono tabular-nums">
            {progress}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default LoadingScreen;
