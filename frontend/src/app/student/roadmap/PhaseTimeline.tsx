"use client";

import {
  AnyRoadmapItem,
  RoadmapItem,
  RoadmapPhase,
  PhaseStatus,
  isCapstone,
} from "@/lib/roadmap";
import {
  CheckCircle2,
  ChevronRight,
  Lock,
  Loader2,
  Rocket,
  CircleDot,
  CircleCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface PhaseTimelineProps {
  phases: RoadmapPhase[];
  selectedSkill: string | null;
  onSelectSkill: (skill: string) => void;
  loadingSkill: string | null;
}

// Phase status display configuration
const PHASE_STATUS_CONFIG: Record<
  PhaseStatus,
  { label: string; dot: string; badge: string; headerBg: string }
> = {
  LOCKED: {
    label: "Locked",
    dot: "bg-slate-600",
    badge: "bg-slate-700/50 text-slate-500",
    headerBg: "bg-slate-950/40",
  },
  UNLOCKED: {
    label: "Unlocked",
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-400",
    headerBg: "bg-slate-900/60",
  },
  IN_PROGRESS: {
    label: "In Progress",
    dot: "bg-sky-400 animate-pulse",
    badge: "bg-sky-500/15 text-sky-300",
    headerBg: "bg-slate-900/60",
  },
  PROJECT_REQUIRED: {
    label: "Project Required",
    dot: "bg-amber-400 animate-pulse",
    badge: "bg-amber-500/15 text-amber-300",
    headerBg: "bg-slate-900/60",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400",
    headerBg: "bg-emerald-950/20",
  },
};

function PhaseStatusIcon({ status }: { status: PhaseStatus }) {
  if (status === "COMPLETED")
    return <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "IN_PROGRESS")
    return <CircleDot className="w-4 h-4 text-sky-400 shrink-0" />;
  if (status === "PROJECT_REQUIRED")
    return <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />;
  if (status === "LOCKED")
    return <Lock className="w-4 h-4 text-slate-600 shrink-0" />;
  return <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />;
}

function SkillStatusIcon({ status }: { status: RoadmapItem["status"] }) {
  if (status === "completed")
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "in_progress")
    return (
      <span className="shrink-0 w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
    );
  return <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
}

function PhaseProgressBar({
  completed,
  total,
  projectDone,
}: {
  completed: number;
  total: number;
  projectDone: boolean;
}) {
  // Skills contribute 80%, project contributes 20% of phase progress
  const skillPct = total > 0 ? (completed / total) * 80 : 0;
  const projPct = projectDone ? 20 : 0;
  const totalPct = Math.round(skillPct + projPct);

  return (
    <div className="px-4 py-2 border-b border-white/5">
      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
        <span>
          {completed}/{total} skills
          {total > 0 && completed === total && !projectDone && (
            <span className="text-amber-400 ml-1">· Project required</span>
          )}
        </span>
        <span className="font-medium text-slate-400">{totalPct}%</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${totalPct}%`,
            background:
              projectDone
                ? "linear-gradient(to right, #10b981, #34d399)"
                : totalPct >= 80
                ? "linear-gradient(to right, #f59e0b, #fbbf24)"
                : "linear-gradient(to right, #0ea5e9, #6366f1)",
          }}
        />
      </div>
    </div>
  );
}

export function PhaseTimeline({
  phases,
  selectedSkill,
  onSelectSkill,
  loadingSkill,
}: PhaseTimelineProps) {
  return (
    <div className="flex flex-col gap-4">
      {phases.map((phase) => {
        const pStatus: PhaseStatus = phase.phase_status || (phase.phase === 1 ? "UNLOCKED" : "LOCKED");
        const cfg = PHASE_STATUS_CONFIG[pStatus];
        const isLocked = pStatus === "LOCKED";
        const hasProject = !!phase.phase_project;
        const projectKey = `__project_phase_${phase.phase}__`;
        const isProjectSelected = selectedSkill === projectKey;
        const projectStatus = phase.phase_project?.status ?? "not_started";
        const allSkillsDone =
          phase.skills_total > 0 &&
          phase.skills_completed === phase.skills_total;

        return (
          <div
            key={phase.phase}
            className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
              isLocked
                ? "border-white/5 opacity-70"
                : "border-white/8 shadow-sm"
            }`}
          >
            {/* Phase Header */}
            <div
              className={`px-4 py-3 border-b border-white/5 flex items-center gap-2.5 ${cfg.headerBg}`}
            >
              <span
                className={`shrink-0 w-2 h-2 rounded-full ${cfg.dot}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <PhaseStatusIcon status={pStatus} />
                  <span className="text-xs font-bold text-slate-200">
                    Phase {phase.phase}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    — {phase.label}
                  </span>
                </div>
              </div>
              <span
                className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}
              >
                {cfg.label}
              </span>
            </div>

            {/* Phase Progress Bar — always show for phases with skills */}
            {phase.skills_total > 0 && (
              <PhaseProgressBar
                completed={phase.skills_completed}
                total={phase.skills_total}
                projectDone={phase.project_completed}
              />
            )}

            {/* Locked phase banner — skills still show below, just non-interactive */}
            {isLocked && (
              <div className="px-4 py-2 flex items-center gap-2 bg-slate-950/40 border-b border-white/5">
                <Lock className="w-3 h-3 text-slate-700 shrink-0" />
                <p className="text-[10px] text-slate-600">
                  Complete Phase {phase.phase - 1} to unlock interaction
                </p>
              </div>
            )}

            {/* Skills always visible — interaction disabled when phase is locked */}
            {(
              <ul className="divide-y divide-white/5">
                {phase.items.map((rawItem) => {
                  // Legacy capstone item inside Phase 3 items array
                  if (isCapstone(rawItem)) {
                    return null; // Phase 3 capstone rendered as project row below
                  }

                  const item = rawItem as RoadmapItem;
                  const isSelected = selectedSkill === item.skill;
                  const isLoading = loadingSkill === item.skill;
                  // Skill is non-interactive if phase is locked OR if skill itself is locked
                  const isSkillLocked = isLocked || item.status === "locked";

                  return (
                    <li key={item.skill}>
                      <button
                        id={`skill-btn-${item.skill.replace(/\s+/g, "-").toLowerCase()}`}
                        onClick={() =>
                          !isSkillLocked && onSelectSkill(item.skill)
                        }
                        disabled={isSkillLocked}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 group ${
                          isSkillLocked
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                            ? "bg-sky-500/10 border-l-2 border-sky-400"
                            : "hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                        ) : (
                          <SkillStatusIcon status={item.status} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              isSkillLocked
                                ? "text-slate-600"
                                : isSelected
                                ? "text-sky-300"
                                : "text-slate-300 group-hover:text-slate-100"
                            }`}
                          >
                            {item.skill}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {isSkillLocked
                              ? "Complete previous skill to unlock"
                              : `Gap: ${item.gap} · ~${item.estimated_weeks}w`}
                          </p>
                        </div>
                        {item.status === "in_progress" &&
                          item.progress_pct > 0 && (
                            <span className="text-[10px] font-semibold text-sky-400">
                              {item.progress_pct}%
                            </span>
                          )}
                        {!isSkillLocked && (
                          <ChevronRight
                            className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                              isSelected
                                ? "text-sky-400 opacity-100"
                                : "text-slate-600 opacity-0 group-hover:opacity-100"
                            }`}
                          />
                        )}
                      </button>
                      {item.status === "in_progress" && (
                        <div className="h-0.5 bg-slate-800 mx-4">
                          <div
                            className="h-0.5 bg-linear-to-r from-sky-500 to-indigo-500 transition-all duration-700"
                            style={{ width: `${item.progress_pct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}

                {/* Advanced Project row — shown when phase is PROJECT_REQUIRED or project has been started/completed */}
                {hasProject && allSkillsDone && (
                  <li>
                    <button
                      id={`project-btn-phase-${phase.phase}`}
                      onClick={() => onSelectSkill(projectKey)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 group ${
                        isProjectSelected
                          ? "bg-amber-500/10 border-l-2 border-amber-400"
                          : projectStatus === "completed"
                          ? "bg-emerald-500/5 border-l-2 border-emerald-500/30"
                          : "hover:bg-white/5 border-l-2 border-transparent"
                      }`}
                    >
                      {projectStatus === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Rocket
                          className={`w-4 h-4 shrink-0 ${
                            isProjectSelected
                              ? "text-amber-400"
                              : "text-amber-500/70"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${
                            projectStatus === "completed"
                              ? "text-emerald-300"
                              : isProjectSelected
                              ? "text-amber-300"
                              : "text-amber-400/80 group-hover:text-amber-300"
                          }`}
                        >
                          Advanced Project — Level {phase.phase}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {projectStatus === "completed"
                            ? "✓ Completed — Phase unlocked"
                            : projectStatus === "in_progress"
                            ? "In progress — submit GitHub URL"
                            : "All skills done · Start your project"}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                          isProjectSelected
                            ? "text-amber-400 opacity-100"
                            : "text-slate-600 opacity-0 group-hover:opacity-100"
                        }`}
                      />
                    </button>
                  </li>
                )}

                {/* Phase 3 capstone-only phase (skills_total = 0) */}
                {phase.skills_total === 0 && hasProject && (
                  <li>
                    <button
                      id={`project-btn-phase-${phase.phase}`}
                      onClick={() => onSelectSkill(projectKey)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 group ${
                        isProjectSelected
                          ? "bg-emerald-500/10 border-l-2 border-emerald-400"
                          : projectStatus === "completed"
                          ? "bg-emerald-500/5 border-l-2 border-emerald-500/30"
                          : "hover:bg-white/5 border-l-2 border-transparent"
                      }`}
                    >
                      {projectStatus === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Rocket className="w-4 h-4 text-emerald-500/70 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-400/80 truncate group-hover:text-emerald-300">
                          {phase.phase_project?.title ?? "Capstone Project"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {projectStatus === "completed"
                            ? "✓ Completed"
                            : "Final milestone"}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
