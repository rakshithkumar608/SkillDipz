"use client";

import { AssessmentTopic } from "@/lib/practiceApi";
import { CheckCircle2, Clock, RefreshCw, Zap, Lock } from "lucide-react";
import { useEffect, useState } from "react";


interface Props { 
  topic: AssessmentTopic;
  onStart: () => void;
  isStarting: boolean;
}

const DIFF_COLOR: Record<string, string> = {
  Beginner:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Advanced:     "text-rose-400 bg-rose-500/10 border-rose-500/20",
};


function useCooldownTimer(until: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!until) { setLabel(null); return; }
    const tick = () => {
      const diff = new Date(until).getTime() - Date.now();
      if (diff <= 0) { setLabel(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [until]);
  return label;
}

export default function MCQTestCard({topic, onStart, isStarting}: Props) {
  const cooldownLabel = useCooldownTimer(topic.cooldown_until);
  const hasAttempted = topic.last_score_pct !== null;
  const passed = (topic.last_score_pct ?? 0) >= 70;

  return (
    <div className="bg-slate-900/60 border border-white/6 rounded-2xl p-5 flex flex-col gap-4 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white text-base">
            {topic.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${DIFF_COLOR[topic.difficulty]}`}>
              {topic.difficulty}
            </span>
            {hasAttempted && (
              <span className="text-[10px] text-slate-500">
                {topic.attempt_count} attempt{topic.attempt_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {hasAttempted && (
          <span className={`text-lg font-black tabular-nums ${passed ? "text-emerald-400" : "text-amber-400"}`}>
            {topic.last_score_pct}%
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />{topic.question_count} Questions</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{topic.time_limit_mins} min</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
         {topic.skill_tags.map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 bg-white/4 border border-white/6 text-slate-300 rounded-lg">
            {t}
          </span>
        ))}
      </div>

      {hasAttempted && (
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Last Score</span><span>{topic.last_score_pct}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
              className={`h-full rounded-full transition-all ${passed ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${topic.last_score_pct}%` }}
            />
          </div>
        </div>
      )}

      {!topic.can_retake && cooldownLabel ? (
        <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/6 text-slate-500 text-xs">
          <Lock className="w-3.5 h-3.5" /> Retake in {cooldownLabel}
        </div>
      ) : hasAttempted ? (
        <button
          onClick={onStart}
          disabled={isStarting}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold hover:bg-sky-500/20 disabled:opacity-50 transition-all"
        >
          {isStarting ? <span className="animate-spin">⟳</span> : <RefreshCw className="w-3.5 h-3.5" />}
          Retake Test
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={isStarting}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 disabled:opacity-50 transition-all"
        >
          {isStarting ? <span className="animate-spin text-base">⟳</span> : <CheckCircle2 className="w-4 h-4" />}
          Start Test
        </button>
      )}
    </div>
  )
}