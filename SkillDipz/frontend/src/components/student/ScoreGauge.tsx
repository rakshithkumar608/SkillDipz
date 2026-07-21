"use client";

import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  isLoading?: boolean;
}

function getColor(score: number): string {
  if (score >= 75) return "#0ea5e9"; // sky-500
  if (score >= 50) return "#f59e0b"; // amber-500
  return "#f87171";                   // red-400
}

function getLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Average";
  if (score > 0)  return "Needs Work";
  return "No Score Yet";
}

export function ScoreGauge({ score, isLoading = false }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    let frame: number;
    let current = 0;
    const step = () => {
      current = Math.min(current + 1, score);
      setDisplayScore(current);
      if (current < score) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score, isLoading]);

  const SIZE = 200;
  const STROKE = 14;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const ARC = CIRCUMFERENCE * 0.75;        // 270° sweep
  const filled = (displayScore / 100) * ARC;
  const color = getColor(displayScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-[135deg]"
        >
          {/* Track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="#1e293b" strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE - ARC}`}
          />
          {/* Fill */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke={color} strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            style={{ transition: "stroke-dasharray 0.05s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="w-10 h-10 rounded-full bg-slate-800 animate-pulse" />
          ) : (
            <>
              <span className="text-5xl font-bold tabular-nums" style={{ color }}>
                {displayScore}
              </span>
              <span className="text-sm text-slate-400 mt-1">/ 100</span>
            </>
          )}
        </div>
      </div>
      <span className="text-sm font-medium text-slate-300">
        {isLoading ? "Loading..." : getLabel(displayScore)}
      </span>
    </div>
  );
}
