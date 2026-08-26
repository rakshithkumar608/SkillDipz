"use client";

import { AssessmentTopic } from "@/lib/practiceApi";
import { CheckCircle2, Clock, Lock, RefreshCw, Zap, Video, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  topic: AssessmentTopic;
  onStart: () => void;
  isStarting: boolean;
}

const DIFF_COLOR: Record<string, string> = {
  Beginner: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Advanced: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

/** Live 1-second interval countdown timer for 24h retake cooldown */
function useCooldownTimer(until: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!until) {
      setLabel(null);
      return;
    }

    const tick = () => {
      const targetTime = new Date(until).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setLabel(null);
        return;
      }

      const totalSecs = Math.floor(diff / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      if (hours > 0) {
        setLabel(
          `${hours}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
        );
      } else {
        setLabel(
          `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
        );
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [until]);

  return label;
}

export default function MCQTestCard({ topic, onStart, isStarting }: Props) {
  const cooldownLabel = useCooldownTimer(topic.cooldown_until);
  const is100Completed = topic.is_completed || topic.last_score_pct === 100;
  const hasAttempted = topic.last_score_pct !== null;
  const isCooldownActive = !is100Completed && !topic.can_retake && cooldownLabel !== null;
  const isUnlocked = topic.is_unlocked !== false;

  return (
    <div className={`border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 shadow-lg backdrop-blur-md ${
      is100Completed
        ? "bg-slate-900/70 border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-950/20"
        : isCooldownActive
        ? "bg-slate-950/90 border-amber-500/30 opacity-95 shadow-amber-950/10"
        : isUnlocked
        ? "bg-slate-900/70 border-white/10 hover:border-indigo-500/30"
        : "bg-slate-950/80 border-slate-800/80 opacity-90"
    }`}>
      <div className="space-y-3">
        {/* Header Title + Score Badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-base leading-snug">
              {topic.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  DIFF_COLOR[topic.difficulty] ?? DIFF_COLOR["Intermediate"]
                }`}
              >
                {topic.difficulty}
              </span>
              {is100Completed ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completed
                </span>
              ) : isCooldownActive ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-amber-400" /> 24h Cooldown
                </span>
              ) : hasAttempted ? (
                <span className="text-[10px] text-slate-400 font-mono">
                  {topic.attempt_count} attempt{topic.attempt_count !== 1 ? "s" : ""}
                </span>
              ) : null}
              {!isUnlocked && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>
          </div>

          {hasAttempted && (
            <span
              className={`text-lg font-black font-mono tabular-nums px-2.5 py-1 rounded-xl bg-slate-950 border ${
                is100Completed
                  ? "text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                  : "text-amber-400 border-amber-500/30"
              }`}
            >
              {topic.last_score_pct}%
            </span>
          )}
        </div>

        {/* Specs Pill */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            {topic.question_count} Questions
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            {topic.time_limit_mins} min
          </span>
        </div>

        {/* Skill Tags */}
        <div className="flex flex-wrap gap-1.5">
          {topic.skill_tags.map((t) => (
            <span
              key={t}
              className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 text-slate-300 rounded-lg font-medium"
            >
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Progress & Action Button */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        {hasAttempted && (
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>{is100Completed ? "Mastery Achieved" : "Current Score (100% Required to Complete)"}</span>
              <span className={`font-bold ${is100Completed ? "text-emerald-400" : "text-amber-400"}`}>
                {topic.last_score_pct}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  is100Completed ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${topic.last_score_pct}%` }}
              />
            </div>
          </div>
        )}

        {!isUnlocked ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-tight">
              {topic.lock_reason || "Complete the video tutorials on your Learning Roadmap to unlock."}
            </p>
            <Link
              href="/student/roadmap"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold hover:bg-indigo-500/20 transition-all shadow-md"
            >
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              Watch Roadmap Videos ↗
            </Link>
          </div>
        ) : isCooldownActive ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold shadow-inner">
              <Lock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Retake unlocks in {cooldownLabel}</span>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              100% score required to complete. Cooldown resets in 24 hours.
            </p>
          </div>
        ) : is100Completed ? (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 disabled:opacity-50 transition-all shadow-md"
          >
            {isStarting ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Retake / Practice Again
          </button>
        ) : hasAttempted ? (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 disabled:opacity-50 transition-all shadow-md"
          >
            {isStarting ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Retake Assessment (Aim for 100%)
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/30 disabled:opacity-50 transition-all shadow-md"
          >
            {isStarting ? (
              <span className="animate-spin text-sm">⟳</span>
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Start MCQ Test
          </button>
        )}
      </div>
    </div>
  );
}