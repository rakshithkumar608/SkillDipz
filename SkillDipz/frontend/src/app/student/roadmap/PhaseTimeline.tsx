"use client";


import { AnyRoadmapItem, RoadmapItem, RoadmapPhase, isCapstone } from "@/lib/roadmap";
import { CheckCircle2, ChevronRight, Lock, Loader2, Trophy } from "lucide-react";

interface PhaseTimelineProps {
  phases: RoadmapPhase[];
  selectedSkill: string | null;
  onSelectSkill: (skill: string) => void;
  loadingSkill: string | null;
}

const PHASE_COLORS = [
  { dot: "bg-red-500", badge: "bg-red-500/10 text-red-400" },
  { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-400" },
  { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400" },
];

function StatusIcon({ status }: { status: RoadmapItem["status"] }) {
  if (status === "completed")
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (status === "in_progress")
    return (
      <span className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
    );
  return <Lock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />;
}

export function PhaseTimeline({
  phases, selectedSkill, onSelectSkill, loadingSkill,
}: PhaseTimelineProps) {
  return (
    <div className="flex flex-col gap-4">
      {phases.map((phase, phaseIdx) => {
        const colors = PHASE_COLORS[phaseIdx % PHASE_COLORS.length];
        const isCapstonePhase = phase.phase === 3;
        return (
          <div key={phase.phase} className="rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2.5">
              <span className={`flex-shrink-0 w-2 h-2 rounded-full ${colors.dot}`} />
              <span className="text-xs font-semibold text-slate-300">Phase {phase.phase}</span>
              <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                {isCapstonePhase ? "Project" : `${phase.items.length} skills`}
              </span>
            </div>
            <ul className="divide-y divide-white/5">
              {phase.items.map((rawItem) => {
                // ── Phase 3: Capstone Project row ──
                if (isCapstone(rawItem)) {
                  const isSelected = selectedSkill === "__capstone__";
                  return (
                    <li key="capstone">
                      <button
                        id="skill-btn-capstone"
                        onClick={() => onSelectSkill("__capstone__")}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 group ${
                          isSelected
                            ? "bg-emerald-500/10 border-l-2 border-emerald-400"
                            : "hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                      >
                        <Trophy className="w-4 h-4 text-emerald-500/50 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            isSelected ? "text-emerald-300" : "text-slate-400 group-hover:text-slate-200"
                          }`}>
                            {rawItem.title}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-0.5">Complete phases 1 & 2 to unlock</p>
                        </div>
                        <Lock className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
                      </button>
                    </li>
                  );
                }

                // ── Phase 1 & 2: Skill rows ──
                const item = rawItem as RoadmapItem;
                const isSelected = selectedSkill === item.skill;
                const isLoading = loadingSkill === item.skill;
                const isLocked = item.status === "locked";

                return (
                  <li key={item.skill}>
                    <button
                      id={`skill-btn-${item.skill.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => !isLocked && onSelectSkill(item.skill)}
                      disabled={isLocked}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 group ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed bg-slate-950/20"
                          : isSelected
                          ? "bg-sky-500/10 border-l-2 border-sky-400"
                          : "hover:bg-white/5 border-l-2 border-transparent"
                      }`}
                    >
                      {isLoading
                        ? <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />
                        : <StatusIcon status={item.status} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isLocked
                            ? "text-slate-500"
                            : isSelected
                            ? "text-sky-300"
                            : "text-slate-300 group-hover:text-slate-100"
                        }`}>
                          {item.skill}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {isLocked ? "Complete previous skill to unlock" : `Gap: ${item.gap} · ~${item.estimated_weeks}w`}
                        </p>
                      </div>
                      {item.status === "in_progress" && item.progress_pct > 0 && (
                        <span className="text-[10px] font-semibold text-sky-400">{item.progress_pct}%</span>
                      )}
                      {!isLocked && (
                        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${
                          isSelected ? "text-sky-400 opacity-100" : "text-slate-600 opacity-0 group-hover:opacity-100"
                        }`} />
                      )}
                    </button>
                    {item.status === "in_progress" && (
                      <div className="h-0.5 bg-slate-800 mx-4">
                        <div
                          className="h-0.5 bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-700"
                          style={{ width: `${item.progress_pct}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
