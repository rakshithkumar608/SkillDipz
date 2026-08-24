"use client";

/**
 * OrderItGame — Order the Steps
 * Mechanic: drag-to-reorder sortable list using @dnd-kit/sortable.
 * Supports multiple questions per game session (e.g. 5 questions) with code snippets.
 * Shows a How-To-Play explanation screen with a NEXT button before timer starts.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListOrdered,
  GripVertical,
  Clock,
  CheckCircle2,
  Zap,
  ArrowRight,
  Sparkles,
  Code2,
  Terminal,
} from "lucide-react";
import { OrderItItemOut, ArenaQuestion, submitOrderItAnswer } from "@/lib/arenaApi";

interface OrderItGameProps {
  questionId?: string;
  question?: string;
  items?: OrderItItemOut[];
  timeLimit?: number;
  xpReward?: number;
  questions?: ArenaQuestion[];
  sessionId?: string;
  onQuestionAnswer?: (questionId: string, userOrder: string[], elapsedMs: number) => Promise<void>;
  onComplete: (userOrder: string[], elapsedMs: number) => void;
}

//  Code Detection Helper 

function isCodeSnippet(text: string): boolean {
  if (!text) return false;
  return (
    /^[ \t]*(const|let|var|function|def |import |from |export |class |return |if |else|switch|case|while|for |try|catch|async |await |SELECT |FROM |WHERE |INSERT |UPDATE |DELETE |CREATE |useEffect|useState|useMemo|useCallback|\{|\}|\[|\]|<[a-zA-Z]|<\/)/.test(
      text
    ) ||
    text.includes("=>") ||
    text.includes("();") ||
    text.includes("();") ||
    text.includes(" = ") ||
    text.includes(" === ") ||
    text.includes(" = (") ||
    text.includes("()")
  );
}

//  Timer Hook 

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

//  Timer Ring 

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
            stroke={urgent ? "#f43f5e" : "#a78bfa"}
            strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={circ - circ * pct}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.2s linear" }}
          />
        </svg>
        <Clock className={`w-3 h-3 ${urgent ? "text-rose-400 animate-pulse" : "text-violet-400"}`} />
      </div>
      <span className={`text-sm font-bold font-mono tabular-nums ${urgent ? "text-rose-400" : "text-slate-200"}`}>
        {timeStr}
      </span>
    </div>
  );
}

//  How To Play Screen 

function HowToPlayOrderIt({
  totalQuestions,
  onStart,
}: {
  totalQuestions: number;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-slate-900/80 border border-violet-500/20 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6 max-w-lg mx-auto"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
          <ListOrdered className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
              Sequence & Code Reordering
            </span>
            <span className="text-xs text-slate-500 font-mono">⚡ {totalQuestions} Questions</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">How to Play Order the Steps</h2>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        Test your sequential problem-solving skills! Drag and drop shuffled code lines and process stages into the correct order.
      </p>

      {/* Rules list */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-xs">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-emerald-300">Code & Logic Sequencing</p>
            <p className="text-slate-400">Reorder code statements to create working algorithms, React patterns, or SQL pipelines.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0 text-violet-400 font-bold text-xs">
            ↕️
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-violet-300">Drag to Arrange</p>
            <p className="text-slate-400">Use the grip handle or drag items up and down from top (Step 1) to bottom (Last Step).</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 text-amber-400 font-bold text-xs">
            🎯
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-300">Scoring & Partial Credit</p>
            <p className="text-slate-400">Full XP for exact matches, with partial XP awarded for correctly positioned steps.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-violet-500/5 rounded-xl border border-violet-500/15 text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
        <span>Round contains <strong>{totalQuestions} questions</strong>. Timer starts when you press Next.</span>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 py-4 bg-linear-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-black text-base rounded-xl transition-all shadow-lg shadow-violet-500/25 active:scale-95 cursor-pointer"
      >
        <span>Start Game</span>
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </motion.div>
  );
}

//  Sortable Item 

function SortableItem({ id, label, index }: { id: string; label: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const isCode = isCodeSnippet(label);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border transition-all duration-150 select-none ${
        isDragging
          ? "bg-violet-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10"
          : isCode
          ? "bg-slate-950/90 border-white/10 hover:border-emerald-500/40 hover:bg-slate-900"
          : "bg-slate-900/80 border-white/8 hover:border-violet-500/30 hover:bg-slate-800/60"
      }`}
    >
      <span
        className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 ${
          isCode
            ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-400 font-mono"
            : "bg-slate-800 border-white/10 text-slate-400"
        }`}
      >
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        {isCode ? (
          <code className="text-xs sm:text-sm font-mono text-emerald-300 leading-snug whitespace-pre-wrap break-all block">
            {label}
          </code>
        ) : (
          <p className="text-sm font-medium text-slate-200 leading-snug">{label}</p>
        )}
      </div>

      <div
        {...attributes}
        {...listeners}
        className="shrink-0 p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>
    </div>
  );
}

//  Drag Overlay Item 

function DragOverlayItem({ label }: { label: string }) {
  const isCode = isCodeSnippet(label);
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border bg-violet-500/20 border-violet-500/60 shadow-2xl shadow-violet-500/25 select-none backdrop-blur-md">
      <GripVertical className="w-4 h-4 text-violet-400" />
      {isCode ? (
        <code className="flex-1 text-xs sm:text-sm font-mono text-emerald-300">{label}</code>
      ) : (
        <p className="flex-1 text-sm font-medium text-slate-200">{label}</p>
      )}
    </div>
  );
}

//  Main Component 

export function OrderItGame({
  questionId: singleQuestionId,
  question: singleQuestion,
  items: singleItems,
  timeLimit: singleTimeLimit = 60,
  xpReward: singleXpReward = 20,
  questions: multiQuestions,
  sessionId,
  onQuestionAnswer,
  onComplete,
}: OrderItGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Normalize questions array
  const questionList = useMemo(() => {
    if (multiQuestions && multiQuestions.length > 0) {
      return multiQuestions;
    }
    if (singleQuestion && singleItems) {
      return [
        {
          question_id: singleQuestionId || "q1",
          game_type: "orderit",
          question: singleQuestion,
          skill: "Algorithm & Logic",
          difficulty: "medium",
          time_limit: singleTimeLimit,
          xp_reward: singleXpReward,
          orderit_payload: { items: singleItems },
        } as ArenaQuestion,
      ];
    }
    return [];
  }, [multiQuestions, singleQuestion, singleItems, singleQuestionId, singleTimeLimit, singleXpReward]);

  const activeQuestion = questionList[currentQIndex] || questionList[0];
  const activeItems = activeQuestion?.orderit_payload?.items || [];
  const hasCodeItems = useMemo(() => activeItems.some((i) => isCodeSnippet(i.label)), [activeItems]);

  // Shuffle items per question
  const [orderedItems, setOrderedItems] = useState<OrderItItemOut[]>([]);

  useEffect(() => {
    if (activeItems.length > 0) {
      const arr = [...activeItems];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setOrderedItems(arr);
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
      onComplete(
        orderedItems.map((i) => i.id),
        Date.now() - globalStartRef.current
      );
    }
  }, [finished, submitting, orderedItems, onComplete]);

  const timeLimit = activeQuestion?.time_limit || 60;
  const { elapsed } = useTimer(timeLimit, handleExpire, isPlaying && !finished);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setOrderedItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAdvanceOrSubmit = async () => {
    if (submitting || finished) return;
    const elapsedMs = Date.now() - qStartRef.current;
    const userOrder = orderedItems.map((i) => i.id);

    setSubmitting(true);

    // Submit answer to backend
    try {
      if (onQuestionAnswer) {
        await onQuestionAnswer(activeQuestion.question_id, userOrder, elapsedMs);
      } else if (sessionId) {
        await submitOrderItAnswer({
          session_id: sessionId,
          question_id: activeQuestion.question_id,
          user_order: userOrder,
          elapsed_ms: elapsedMs,
        });
      }
    } catch (e) {
      console.warn("OrderIt submit error:", e);
    }

    setSubmitting(false);

    if (currentQIndex < questionList.length - 1) {
      // Advance to next question
      qStartRef.current = Date.now();
      setCurrentQIndex((idx) => idx + 1);
    } else {
      // Completed all questions in the set!
      setFinished(true);
      onComplete(userOrder, Date.now() - globalStartRef.current);
    }
  };

  const activeDraggingItem = activeId ? orderedItems.find((i) => i.id === activeId) : null;

  // 1. Show How to Play intro screen first
  if (!isPlaying) {
    return (
      <HowToPlayOrderIt
        totalQuestions={questionList.length}
        onStart={handleStartGame}
      />
    );
  }

  // 2. Submitting all done state
  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <CheckCircle2 className="w-12 h-12 text-violet-400 animate-bounce" />
        <p className="text-slate-300 font-semibold">Submitting your answers…</p>
      </div>
    );
  }

  const isLastQuestion = currentQIndex === questionList.length - 1;

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {/* Header with question counter and timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <ListOrdered className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">Order the Steps</p>
              {questionList.length > 1 && (
                <span className="text-[10px] font-mono font-bold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-500/30">
                  {currentQIndex + 1} / {questionList.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{orderedItems.length} items to arrange</p>
          </div>
        </div>
        <TimerRing elapsed={elapsed} total={timeLimit} />
      </div>

      {/* Question progress pills if multiple questions */}
      {questionList.length > 1 && (
        <div className="flex items-center gap-1.5">
          {questionList.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < currentQIndex
                  ? "bg-emerald-500"
                  : i === currentQIndex
                  ? "bg-violet-400"
                  : "bg-slate-800"
              }`}
            />
          ))}
        </div>
      )}

      {/* Question Challenge Card */}
      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Task {currentQIndex + 1}
          </span>
          {hasCodeItems ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <Terminal className="w-3 h-3" /> Code Reordering
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
              <ListOrdered className="w-3 h-3" /> Workflow Sequence
            </span>
          )}
        </div>
        <p className="text-sm text-slate-200 font-semibold leading-relaxed">
          {activeQuestion?.question}
        </p>
      </div>

      {/* Instruction */}
      <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
        <GripVertical className="w-3 h-3" />
        Drag from top (1st) to bottom (last) · Lock in when ready
      </p>

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {orderedItems.map((item, index) => (
              <SortableItem key={item.id} id={item.id} label={item.label} index={index} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeDraggingItem ? <DragOverlayItem label={activeDraggingItem.label} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Action Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAdvanceOrSubmit}
        disabled={submitting}
        className="flex items-center justify-center gap-2 py-3.5 bg-linear-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-violet-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
      >
        <Zap className="w-4 h-4" />
        {isLastQuestion ? "Lock In & Finish Round" : `Lock In & Next Question (${currentQIndex + 1}/${questionList.length}) →`}
      </motion.button>

      {/* XP hint */}
      <p className="text-xs text-slate-600 text-center">
        Full credit for exact order · Partial credit for correct positions
      </p>
    </div>
  );
}

export default OrderItGame;
