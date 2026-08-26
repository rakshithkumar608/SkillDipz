"use client";

import React from "react";

interface CircularScoreRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  colorGradient?: [string, string];
  gradientId: string;
  textColor?: string;
  showDecimal?: boolean;
}

export function CircularScoreRing({
  value,
  size = 48,
  strokeWidth = 4,
  colorGradient = ["#38bdf8", "#6366f1"],
  gradientId,
  textColor = "text-white",
  showDecimal = true,
}: CircularScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedValue = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 drop-shadow-sm"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorGradient[0]} />
            <stop offset="100%" stopColor={colorGradient[1]} />
          </linearGradient>
        </defs>
        {/* Track Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Active Progress Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Centered Percentage Text */}
      <span
        className={`absolute text-[10.5px] font-bold tabular-nums tracking-tight ${textColor}`}
      >
        {showDecimal
          ? `${normalizedValue.toFixed(1)}%`
          : `${Math.round(normalizedValue)}%`}
      </span>
    </div>
  );
}
