"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Play } from "lucide-react";

interface ExplainTaskProps {
  prompt: string;
  onComplete: () => void;
  completing: boolean;
}

export function ExplainTask({ prompt, onComplete, completing }: ExplainTaskProps) {
  const [text, setText] = useState("");
  const [timer, setTimer] = useState(60);
  const [started, setStarted] = useState(false);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    if (!started) return;
    if (timer <= 0) {
      setTimeUp(true);
      return;
    }
    const t = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [started, timer]);

  return (
    <div className="space-y-4">
      <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl p-4">
        <p className="text-orange-300 text-xs font-semibold uppercase tracking-wider mb-2">
          60-Second Challenge
        </p>
        <p className="text-slate-100 text-base font-medium">{prompt}</p>
      </div>

      {!started ? (
        <button
          onClick={() => setStarted(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium text-sm transition-all"
        >
          <Play className="w-4 h-4" />
          Start Timer & Write
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs">Write your explanation below</p>
            <span
              className={`text-sm font-bold tabular-nums ${
                timer <= 10
                  ? "text-rose-400 animate-pulse"
                  : timer <= 30
                  ? "text-amber-400"
                  : "text-teal-400"
              }`}
            >
              {timeUp ? "Time's Up!" : `${timer}s`}
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your explanation here..."
            rows={5}
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-slate-200 text-sm resize-none focus:outline-none focus:border-orange-500/50 placeholder-slate-600 transition-colors"
          />

          <button
            onClick={onComplete}
            disabled={completing || text.trim().length < 10}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit Explanation
          </button>
        </>
      )}
    </div>
  );
}
