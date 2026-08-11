"use client";

import { useState } from "react";
import { DailyTask } from "@/lib/dailyAssignmentsApi";
import { FlashcardDeck } from "./FlashcardDeck";
import { ExplainTask } from "./ExplainTask";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  Star,
  Video,
  Zap,
} from "lucide-react";

export const TASK_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  quiz:         { label: "Skill Quiz",     icon: Brain,    color: "text-sky-400",    bg: "bg-sky-500/10" },
  code:         { label: "Code Challenge", icon: Code2,    color: "text-violet-400", bg: "bg-violet-500/10" },
  video:        { label: "Watch & Learn",  icon: Video,    color: "text-amber-400",  bg: "bg-amber-500/10" },
  flashcard:    { label: "Flashcards",     icon: BookOpen, color: "text-teal-400",   bg: "bg-teal-500/10" },
  explain:      { label: "Explain It",     icon: FileText, color: "text-orange-400", bg: "bg-orange-500/10" },
  resume_tweak: { label: "Resume Tweak",   icon: Star,     color: "text-pink-400",   bg: "bg-pink-500/10" },
  wildcard:     { label: "Wildcard ⚡",    icon: Zap,      color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

interface TaskCardProps {
  task: DailyTask;
  index?: number;
  onComplete: (id: string) => void;
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [flashDone, setFlashDone] = useState(false);

  const resolvedType = task.subtype || task.type;
  const cfg = TASK_TYPE_CONFIG[resolvedType] || TASK_TYPE_CONFIG["quiz"];
  const Icon = cfg.icon;
  const isComplete = task.status === "completed";

  const handleComplete = async () => {
    if (isComplete || completing) return;
    setCompleting(true);
    try {
      await onComplete(task.task_id);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-2xl ${
        isComplete
          ? "border-emerald-500/20 bg-emerald-950/20"
          : "border-slate-800/80 bg-[#0b0f19]/90 hover:border-slate-700/60"
      }`}
    >
      {/* Header Bar */}
      <div
        className="flex items-center gap-4 p-5 cursor-pointer select-none"
        onClick={() => !isComplete && setExpanded(!expanded)}
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <Icon className={`w-5 h-5 ${cfg.color}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {task.skill_tag && (
              <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                {task.skill_tag}
              </span>
            )}
            {task.type === "wildcard" && (
              <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full font-semibold">
                WILDCARD ⚡
              </span>
            )}
          </div>
          <p className={`mt-1 font-medium truncate ${isComplete ? "text-slate-400 line-through" : "text-slate-100"}`}>
            {task.title}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-sm font-bold ${isComplete ? "text-slate-500" : "text-amber-400"}`}>
            +{task.points} pts
          </span>
          {isComplete ? (
            <span className="text-xs text-emerald-400">Done ✓</span>
          ) : (
            <ChevronRight
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          )}
        </div>
      </div>

      {/* Expanded Content Body */}
      {!isComplete && expanded && (
        <div className="border-t border-slate-800/60 p-5 space-y-5">
          {/* QUIZ */}
          {resolvedType === "quiz" && task.topic_id && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                Take a timed MCQ quiz for{" "}
                <span className="text-sky-400 font-medium">{task.skill_tag || "this skill"}</span>.
              </p>
              <a
                href={`/student/skill-tests?topic=${task.topic_id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium text-sm transition-all"
              >
                <Play className="w-4 h-4" /> Start Quiz
              </a>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Complete
              </button>
            </div>
          )}

          {/* CODE */}
          {resolvedType === "code" && task.cf_url && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {task.cf_rating && (
                  <span className="px-2.5 py-1 bg-violet-500/15 border border-violet-500/25 text-violet-300 rounded-lg text-xs font-semibold">
                    Rating: {task.cf_rating}
                  </span>
                )}
                {task.skill_tag && (
                  <span className="px-2.5 py-1 bg-slate-800/50 text-slate-400 rounded-lg text-xs">
                    {task.skill_tag}
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-sm">
                Solve this Codeforces problem and submit your solution on the live platform.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={task.cf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium text-sm transition-all"
                >
                  <Code2 className="w-4 h-4" /> Open Problem <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Solved
                </button>
              </div>
            </div>
          )}

          {/* VIDEO */}
          {resolvedType === "video" && task.youtube_id && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {task.channel && <span className="font-medium">{task.channel}</span>}
                {task.duration_label && (
                  <>
                    <span>·</span>
                    <span>{task.duration_label}</span>
                  </>
                )}
              </div>
              <div className="rounded-xl overflow-hidden aspect-video bg-slate-900">
                <iframe
                  src={`https://www.youtube.com/embed/${task.youtube_id}`}
                  title={task.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Watched
              </button>
            </div>
          )}

          {/* FLASHCARD */}
          {resolvedType === "flashcard" && task.flashcards && task.flashcards.length > 0 && (
            <FlashcardDeck
              cards={task.flashcards}
              onAllDone={
                !flashDone
                  ? () => {
                      setFlashDone(true);
                      handleComplete();
                    }
                  : () => {}
              }
            />
          )}

          {/* EXPLAIN */}
          {resolvedType === "explain" && (
            <ExplainTask
              prompt={task.explain_prompt || task.title}
              onComplete={handleComplete}
              completing={completing}
            />
          )}

          {/* RESUME TWEAK */}
          {resolvedType === "resume_tweak" && task.tweak_instruction && (
            <div className="space-y-4">
              <div className="bg-pink-950/30 border border-pink-500/20 rounded-xl p-4">
                <p className="text-pink-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  Your Task
                </p>
                <p className="text-slate-200 text-sm leading-relaxed">{task.tweak_instruction}</p>
              </div>
              <a
                href="/student/profile"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-medium text-sm transition-all"
              >
                <Star className="w-4 h-4" /> Update My Profile
              </a>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
