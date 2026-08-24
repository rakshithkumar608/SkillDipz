"use client";

/**
 * StackItGame — Stack It
 * Mechanic: drag-to-zone chip placement using @dnd-kit/core useDraggable + useDroppable.
 * Supports multiple questions per game session (e.g. 5 questions) with architectural scenarios.
 * Shows a How-To-Play explanation screen with a NEXT button before timer starts.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Clock, Zap, CheckCircle2, X, ArrowRight, Sparkles, Server } from "lucide-react";
import {
  StackItZoneOut,
  StackItComponentOut,
  StackItPlacement,
  ArenaQuestion,
  submitStackItAnswer,
} from "@/lib/arenaApi";

interface StackItGameProps {
  questionId?: string;
  question?: string;
  scenario?: string;
  zones?: StackItZoneOut[];
  components?: StackItComponentOut[];
  timeLimit?: number;
  xpReward?: number;
  difficulty?: string;
  questions?: ArenaQuestion[];
  sessionId?: string;
  onQuestionAnswer?: (questionId: string, placements: StackItPlacement[], elapsedMs: number) => Promise<void>;
  onComplete: (placements: StackItPlacement[], elapsedMs: number) => void;
}

// ─── Timer Hook ───────────────────────────────────────────────────────────────

function useTimer(totalSeconds: number, onExpire: () => void, active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    expiredRef.current = false;
    const id = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      setElapsed(e);
      if (!expiredRef.current && e >= totalSeconds) {
        expiredRef.current = true;
        clearInterval(id);
        onExpire();
      }
    }, 200);
    return () => clearInterval(id);
  }, [totalSeconds, onExpire, active]);

  return { elapsed, elapsedMs: () => Date.now() - startRef.current };
}

// ─── Timer Ring ───────────────────────────────────────────────────────────────

function TimerRing({ elapsed, total }: { elapsed: number; total: number }) {
  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const pct = Math.max(0, Math.min(1, 1 - elapsed / total));
  const urgent = remaining <= 15;
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
            stroke={urgent ? "#f43f5e" : "#34d399"}
            strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={circ - circ * pct}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.2s linear" }}
          />
        </svg>
        <Clock className={`w-3 h-3 ${urgent ? "text-rose-400 animate-pulse" : "text-emerald-400"}`} />
      </div>
      <span className={`text-sm font-bold font-mono tabular-nums ${urgent ? "text-rose-400" : "text-slate-200"}`}>
        {timeStr}
      </span>
    </div>
  );
}

//  How To Play Screen  
function HowToPlayStackIt({
  totalQuestions,
  difficulty = "medium",
  onStart,
}: {
  totalQuestions: number;
  difficulty?: string;
  onStart: () => void;
}) {
  const diffMultiplier = difficulty === "hard" ? "2×" : difficulty === "medium" ? "1.5×" : "1×";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6 max-w-lg mx-auto"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Layers className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Architecture & System Design
            </span>
            <span className="text-xs text-slate-500 font-mono">⚡ {totalQuestions} Questions</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">How to Play Stack It</h2>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        Act like a senior tech architect! Analyze production scenarios and drag architecture components into the correct strategy zones.
      </p>

      {/* Rules list */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-xs">
            📦
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-emerald-300">Drag Chips into Matching Zones</p>
            <p className="text-slate-400">Drag each component from the tray into the appropriate target zone (e.g. Correct Action vs. Harmful / Irrelevant).</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 text-amber-400 font-bold text-xs">
            ⚡
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-300">{difficulty.toUpperCase()} Multiplier ({diffMultiplier} XP)</p>
            <p className="text-slate-400">Place all chips in each task to unlock submission and earn boosted XP multipliers!</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/15 text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Round contains <strong>{totalQuestions} architecture challenges</strong>. Timer starts on Next.</span>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 py-4 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-base rounded-xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
      >
        <span>Start Game</span>
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </motion.div>
  );
}

//  Draggable Chip  

function DraggableChip({
  id,
  label,
  isPlaced,
  onReturn,
}: {
  id: string;
  label: string;
  isPlaced: boolean;
  onReturn?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = { transform: CSS.Translate.toString(transform) };

  if (isPlaced) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all text-xs font-semibold select-none
          ${isDragging ? "opacity-40" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:border-emerald-400/50"}`}
      >
        <span>{label}</span>
        {onReturn && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              onReturn();
            }}
            className="ml-1 text-emerald-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all text-xs font-semibold select-none touch-none
        ${
          isDragging
            ? "opacity-30 bg-slate-700/50 border-white/10 text-slate-500"
            : "bg-slate-800/80 border-white/10 text-slate-200 hover:border-sky-500/40 hover:bg-slate-700/80 hover:text-sky-300"
        }`}
    >
      {label}
    </div>
  );
}

//  Drop Zone 

const ZONE_COLORS: Record<number, { bg: string; border: string; text: string; activeBg: string }> = {
  0: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    activeBg: "bg-emerald-500/15 border-emerald-500/40",
  },
  1: {
    bg: "bg-rose-500/5",
    border: "border-rose-500/20",
    text: "text-rose-400",
    activeBg: "bg-rose-500/15 border-rose-500/40",
  },
  2: {
    bg: "bg-sky-500/5",
    border: "border-sky-500/20",
    text: "text-sky-400",
    activeBg: "bg-sky-500/15 border-sky-500/40",
  },
  3: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
    activeBg: "bg-amber-500/15 border-amber-500/40",
  },
};

function DropZone({
  zone,
  zoneIndex,
  placedComponents,
  allComponents,
  onReturn,
}: {
  zone: StackItZoneOut;
  zoneIndex: number;
  placedComponents: string[];
  allComponents: StackItComponentOut[];
  onReturn: (componentId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone.id });
  const colors = ZONE_COLORS[zoneIndex % Object.keys(ZONE_COLORS).length];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 p-4 rounded-xl border transition-all duration-150 min-h-30
        ${isOver ? colors.activeBg + " border" : `${colors.bg} ${colors.border}`}`}
    >
      <p className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{zone.label}</p>
      <div className="flex flex-wrap gap-2 flex-1">
        {placedComponents.length === 0 && (
          <p className="text-xs text-slate-600 self-center w-full text-center mt-2">
            Drop chips here
          </p>
        )}
        {placedComponents.map((compId) => {
          const comp = allComponents.find((c) => c.id === compId);
          return comp ? (
            <DraggableChip
              key={compId}
              id={compId}
              label={comp.label}
              isPlaced={true}
              onReturn={() => onReturn(compId)}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

//  Unplaced Tray 

function UnplacedTray({
  id,
  components,
  unplacedIds,
}: {
  id: string;
  components: StackItComponentOut[];
  unplacedIds: string[];
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-wrap gap-2 p-4 rounded-xl bg-slate-900/40 border border-white/5 min-h-18"
    >
      {unplacedIds.length === 0 && (
        <p className="text-xs text-emerald-500 font-semibold w-full text-center self-center">
          ✓ All chips placed!
        </p>
      )}
      {unplacedIds.map((id) => {
        const comp = components.find((c) => c.id === id);
        return comp ? <DraggableChip key={id} id={id} label={comp.label} isPlaced={false} /> : null;
      })}
    </div>
  );
}

//  Main Component 

export function StackItGame({
  questionId: singleQuestionId,
  question: singleQuestion,
  scenario: singleScenario,
  zones: singleZones,
  components: singleComponents,
  timeLimit: singleTimeLimit = 75,
  xpReward: singleXpReward = 20,
  difficulty: singleDifficulty = "medium",
  questions: multiQuestions,
  sessionId,
  onQuestionAnswer,
  onComplete,
}: StackItGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Normalize questions array
  const questionList = useMemo(() => {
    if (multiQuestions && multiQuestions.length > 0) {
      return multiQuestions;
    }
    if (singleQuestion && singleZones && singleComponents) {
      return [
        {
          question_id: singleQuestionId || "q1",
          game_type: "stackit",
          question: singleQuestion,
          skill: "Architecture & Systems",
          difficulty: singleDifficulty,
          time_limit: singleTimeLimit,
          xp_reward: singleXpReward,
          stackit_payload: {
            scenario: singleScenario || "",
            zones: singleZones,
            components: singleComponents,
          },
        } as ArenaQuestion,
      ];
    }
    return [];
  }, [
    multiQuestions,
    singleQuestion,
    singleScenario,
    singleZones,
    singleComponents,
    singleQuestionId,
    singleDifficulty,
    singleTimeLimit,
    singleXpReward,
  ]);

  const activeQuestion = questionList[currentQIndex] || questionList[0];
  const payload = activeQuestion?.stackit_payload;
  const zones = payload?.zones || [];
  const components = payload?.components || [];
  const scenario = payload?.scenario || "";
  const difficulty = activeQuestion?.difficulty || singleDifficulty;

  // placements: { [componentId]: zoneId | null }
  const [placements, setPlacements] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (components.length > 0) {
      setPlacements(Object.fromEntries(components.map((c) => [c.id, null])));
    }
  }, [currentQIndex, activeQuestion]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const qStartRef = useRef(Date.now());
  const globalStartRef = useRef(Date.now());

  const handleExpire = useCallback(() => {
    if (!finished && !submitting) {
      setFinished(true);
      const result = Object.entries(placements)
        .filter(([, zoneId]) => zoneId !== null)
        .map(([componentId, placedZoneId]) => ({
          component_id: componentId,
          placed_zone_id: placedZoneId!,
        }));
      onComplete(result, Date.now() - globalStartRef.current);
    }
  }, [finished, submitting, placements, onComplete]);

  const timeLimit = activeQuestion?.time_limit || 75;
  const { elapsed } = useTimer(timeLimit, handleExpire, isPlaying && !finished);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const handleStartGame = () => {
    globalStartRef.current = Date.now();
    qStartRef.current = Date.now();
    setIsPlaying(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const componentId = active.id as string;
    const targetId = over.id as string;

    setPlacements((prev) => {
      const updated = { ...prev };
      if (targetId === "unplaced-tray") {
        updated[componentId] = null;
      } else {
        const zoneExists = zones.find((z) => z.id === targetId);
        if (zoneExists) {
          updated[componentId] = targetId;
        }
      }
      return updated;
    });
  };

  const handleReturn = (componentId: string) => {
    setPlacements((prev) => ({ ...prev, [componentId]: null }));
  };

  const handleAdvanceOrSubmit = async () => {
    if (submitting || finished) return;
    const elapsedMs = Date.now() - qStartRef.current;
    const result = Object.entries(placements)
      .filter(([, zoneId]) => zoneId !== null)
      .map(([componentId, placedZoneId]) => ({
        component_id: componentId,
        placed_zone_id: placedZoneId!,
      }));

    setSubmitting(true);

    // Submit answer to backend
    try {
      if (onQuestionAnswer) {
        await onQuestionAnswer(activeQuestion.question_id, result, elapsedMs);
      } else if (sessionId) {
        await submitStackItAnswer({
          session_id: sessionId,
          question_id: activeQuestion.question_id,
          placements: result,
          elapsed_ms: elapsedMs,
        });
      }
    } catch (e) {
      console.warn("StackIt submit error:", e);
    }

    setSubmitting(false);

    if (currentQIndex < questionList.length - 1) {
      // Advance to next challenge
      qStartRef.current = Date.now();
      setCurrentQIndex((idx) => idx + 1);
    } else {
      // Completed all 5 challenges!
      setFinished(true);
      onComplete(result, Date.now() - globalStartRef.current);
    }
  };

  const unplacedIds = components.filter((c) => placements[c.id] === null).map((c) => c.id);
  const allPlaced = unplacedIds.length === 0 && components.length > 0;
  const activeComponent = activeId ? components.find((c) => c.id === activeId) : null;

  const difficultyColors: Record<string, string> = {
    easy: "text-emerald-400",
    medium: "text-amber-400",
    hard: "text-rose-400",
  };

  // 1. Show How to Play intro screen first
  if (!isPlaying) {
    return (
      <HowToPlayStackIt
        totalQuestions={questionList.length}
        difficulty={difficulty}
        onStart={handleStartGame}
      />
    );
  }

  // 2. Submitting state
  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
        <p className="text-slate-300 font-semibold">Submitting your architecture choices…</p>
      </div>
    );
  }

  const isLastQuestion = currentQIndex === questionList.length - 1;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Stack It</p>
                {questionList.length > 1 && (
                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {currentQIndex + 1} / {questionList.length}
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold capitalize ${difficultyColors[difficulty] || "text-slate-400"}`}>
                {difficulty} Architecture Challenge
              </p>
            </div>
          </div>
          <TimerRing elapsed={elapsed} total={timeLimit} />
        </div>

        {/* Progress pills if multiple questions */}
        {questionList.length > 1 && (
          <div className="flex items-center gap-1.5">
            {questionList.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < currentQIndex
                    ? "bg-emerald-500"
                    : i === currentQIndex
                    ? "bg-emerald-400"
                    : "bg-slate-800"
                }`}
              />
            ))}
          </div>
        )}

        {/* Scenario Card */}
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Scenario {currentQIndex + 1}
            </p>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <Server className="w-3 h-3" /> System Strategy
            </span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">{scenario}</p>
        </div>

        {/* Question */}
        <p className="text-sm font-semibold text-white px-1">{activeQuestion?.question}</p>

        {/* Unplaced chips tray */}
        <div>
          <p className="text-xs text-slate-500 font-medium mb-2 px-1">
            Components — drag each into the correct zone below
          </p>
          <UnplacedTray id="unplaced-tray" components={components} unplacedIds={unplacedIds} />
        </div>

        {/* Drop zones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {zones.map((zone, i) => (
            <DropZone
              key={zone.id}
              zone={zone}
              zoneIndex={i}
              placedComponents={components
                .filter((c) => placements[c.id] === zone.id)
                .map((c) => c.id)}
              allComponents={components}
              onReturn={handleReturn}
            />
          ))}
        </div>

        {/* Submit Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdvanceOrSubmit}
          disabled={!allPlaced || submitting}
          className={`flex items-center justify-center gap-2 py-3.5 font-bold text-sm rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50
            ${
              allPlaced
                ? "bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 active:scale-95"
                : "bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed"
            }`}
        >
          <Zap className="w-4 h-4" />
          {allPlaced
            ? isLastQuestion
              ? "Lock In & Finish Round"
              : `Lock In & Next Scenario (${currentQIndex + 1}/${questionList.length}) →`
            : `Place all ${unplacedIds.length} remaining chip${unplacedIds.length !== 1 ? "s" : ""} first`}
        </motion.button>

        {/* XP hint */}
        <p className="text-xs text-slate-600 text-center">
          {difficulty === "hard"
            ? "Hard ×2 XP multiplier"
            : difficulty === "medium"
            ? "Medium ×1.5 XP multiplier"
            : "Easy ×1 XP multiplier"}
          {" · "}Partial credit for accurate placements
        </p>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeComponent ? (
          <div className="px-3 py-2 rounded-lg border bg-sky-500/20 border-sky-500/50 text-sky-200 font-semibold text-xs shadow-xl shadow-sky-500/20 select-none backdrop-blur-md">
            {activeComponent.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default StackItGame;
