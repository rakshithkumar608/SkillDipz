"use client";

import {
  RoadmapData,
  RoadmapItem,
  YoutubeVideo,
  CapstoneItem,
  PhaseProject,
  fetchRoadmap,
  regenerateRoadmap,
  isCapstone,
} from "@/lib/roadmap";
import {
  AlertCircle,
  Map,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { VideoModal } from "./VideoModal";
import Link from "next/link";
import { PhaseTimeline } from "./PhaseTimeline";
import { ContentPanel } from "./ContentPanel";

// Sentinels
const CAPSTONE_KEY = "__capstone__";
const PHASE_PROJECT_PREFIX = "__project_phase_";

function getPhaseNumFromKey(key: string): number | null {
  if (!key.startsWith(PHASE_PROJECT_PREFIX)) return null;
  const n = parseInt(key.replace(PHASE_PROJECT_PREFIX, ""), 10);
  return isNaN(n) ? null : n;
}

//  Progress Header 

function ProgressHeader({
  roadmap,
  onRegenerate,
  regenerating,
}: {
  roadmap: RoadmapData;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const completed = roadmap.phases.reduce(
    (acc, p) =>
      acc +
      p.items.filter((i) => !isCapstone(i) && (i as RoadmapItem).status === "completed")
        .length,
    0
  );
  const total = roadmap.phases.reduce(
    (acc, p) => acc + p.items.filter((i) => !isCapstone(i)).length,
    0
  );
  const completedPhases = roadmap.phases.filter(
    (p) => p.phase_status === "COMPLETED"
  ).length;
  const totalPhases = roadmap.phases.length;

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Map className="w-5 h-5 text-sky-400 shrink-0" />
            <h1 className="text-lg font-bold text-slate-100 truncate">
              Learning Roadmap
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Target role:{" "}
            <span className="text-sky-400 font-semibold capitalize">
              {roadmap.role}
            </span>
            {" · "}Phase-based · Gap-driven
            {roadmap.last_regenerated && (
              <>
                {" · "}Updated{" "}
                {new Date(roadmap.last_regenerated).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
        <button
          id="roadmap-regenerate-btn"
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`}
          />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {/* Skill progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Skill Progress</span>
          <span className="font-semibold text-slate-300">
            {roadmap.progress_pct}%
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-sky-500 via-indigo-500 to-fuchsia-500 rounded-full transition-all duration-700"
            style={{ width: `${roadmap.progress_pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>{completed} skills completed</span>
          <span>{total} total skills</span>
        </div>
      </div>

      {/* Phase progress */}
      {totalPhases > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-600">Phases:</span>
            {roadmap.phases.map((p) => {
              const s = p.phase_status;
              const color =
                s === "COMPLETED"
                  ? "bg-emerald-500"
                  : s === "PROJECT_REQUIRED"
                  ? "bg-amber-400 animate-pulse"
                  : s === "IN_PROGRESS"
                  ? "bg-sky-400 animate-pulse"
                  : s === "UNLOCKED"
                  ? "bg-sky-600"
                  : "bg-slate-700";
              return (
                <div
                  key={p.phase}
                  className="flex items-center gap-1"
                  title={`Phase ${p.phase}: ${s}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <span className="text-[10px] text-slate-600">
                    P{p.phase}
                  </span>
                </div>
              );
            })}
            <span className="text-[11px] text-slate-600 ml-1">
              {completedPhases}/{totalPhases} completed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

//  Setup Prompt 

function SetupPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-6">
        <UploadCloud className="w-10 h-10 text-sky-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">
        Set up your Roadmap
      </h2>
      <p className="text-slate-400 text-sm max-w-xs mb-6 leading-relaxed">
        Upload your resume and set a target role to generate your personalised,
        phase-based learning roadmap.
      </p>
      <div className="flex gap-3">
        <Link
          href="/student/profile"
          id="roadmap-setup-profile-link"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors shadow-lg shadow-sky-500/25"
        >
          Upload Resume
        </Link>
        <Link
          href="/student/skill-gap"
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          View Skill Gap
        </Link>
      </div>
    </div>
  );
}



export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);
  const [loadingSkill, setLoadingSkill] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<YoutubeVideo | null>(null);

  // Phase project state
  const [activePhaseProject, setActivePhaseProject] =
    useState<PhaseProject | null>(null);
  const [activePhaseNum, setActivePhaseNum] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchRoadmap();
      setRoadmap(data);
      // Auto-select first in_progress skill (skip capstone/project items)
      const firstActive = data.phases
        .flatMap((p) => p.items)
        .find(
          (i) => !isCapstone(i) && (i as RoadmapItem).status === "in_progress"
        ) as RoadmapItem | undefined;
      if (firstActive) {
        setSelectedSkill(firstActive.skill);
        setSelectedItem(firstActive);
      }
    } catch {
      setError("Failed to load your roadmap. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectSkill = useCallback(
    (skill: string) => {
      if (!roadmap) return;
      setSelectedSkill(skill);
      setLoadingSkill(skill);

      // Legacy capstone sentinel
      if (skill === CAPSTONE_KEY) {
        setSelectedItem(null);
        setActivePhaseProject(null);
        setActivePhaseNum(null);
        setTimeout(() => setLoadingSkill(null), 300);
        return;
      }

      // Phase project sentinel: __project_phase_1__, __project_phase_2__, etc.
      const phaseNum = getPhaseNumFromKey(skill);
      if (phaseNum !== null) {
        const phase = roadmap.phases.find((p) => p.phase === phaseNum);
        setActivePhaseProject(phase?.phase_project ?? null);
        setActivePhaseNum(phaseNum);
        setSelectedItem(null);
        setTimeout(() => setLoadingSkill(null), 300);
        return;
      }

      // Normal skill
      setActivePhaseProject(null);
      setActivePhaseNum(null);
      const item =
        (roadmap.phases
          .flatMap((p) => p.items)
          .find(
            (i) => !isCapstone(i) && (i as RoadmapItem).skill === skill
          ) as RoadmapItem) ?? null;
      setSelectedItem(item);
      setTimeout(() => setLoadingSkill(null), 300);
    },
    [roadmap]
  );

  const handleVideoCompleted = useCallback(async () => {
    try {
      const data = await fetchRoadmap();
      setRoadmap(data);
      if (selectedSkill && !selectedSkill.startsWith(PHASE_PROJECT_PREFIX) && selectedSkill !== CAPSTONE_KEY) {
        const updatedItem =
          (data.phases
            .flatMap((p) => p.items)
            .find(
              (i) => !isCapstone(i) && (i as RoadmapItem).skill === selectedSkill
            ) as RoadmapItem) ?? null;
        setSelectedItem(updatedItem);
      }
    } catch {
      // ignore background refresh error
    }
  }, [selectedSkill]);

  const handleProjectSubmitted = useCallback((updatedRoadmap: RoadmapData) => {
    setRoadmap(updatedRoadmap);
    // Update the active phase project from the new roadmap data
    if (activePhaseNum !== null) {
      const updatedPhase = updatedRoadmap.phases.find(
        (p) => p.phase === activePhaseNum
      );
      setActivePhaseProject(updatedPhase?.phase_project ?? null);
    }
  }, [activePhaseNum]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const data = await regenerateRoadmap();
      setRoadmap(data);
      setSelectedSkill(null);
      setSelectedItem(null);
      setActivePhaseProject(null);
      setActivePhaseNum(null);
    } catch {
      setError("Failed to regenerate roadmap.");
    } finally {
      setRegenerating(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-28 rounded-2xl bg-slate-900/60 border border-white/5 mb-5 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-slate-900/60 border border-white/5 animate-pulse"
              />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-slate-900/60 border border-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-300 font-medium">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-500 hover:bg-sky-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Needs setup ──
  if (!roadmap || roadmap.needs_setup) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <SetupPrompt />
      </div>
    );
  }

  // ── No phases (all gaps closed) ──
  if (roadmap.phases.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-100 mb-2">All caught up!</h2>
          <p className="text-slate-400 text-sm">
            No skill gaps found for{" "}
            <span className="text-sky-400 font-medium capitalize">
              {roadmap.role}
            </span>
            .
          </p>
        </div>
      </div>
    );
  }

  // Extract legacy capstone for ContentPanel backward compat
  const capstoneData =
    (roadmap.phases
      .flatMap((p) => p.items)
      .find((i) => isCapstone(i)) as CapstoneItem | null) ?? null;

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <ProgressHeader
          roadmap={roadmap}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
        />
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          <aside className="lg:sticky lg:top-5 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto pr-1">
            <PhaseTimeline
              phases={roadmap.phases}
              selectedSkill={selectedSkill}
              onSelectSkill={handleSelectSkill}
              loadingSkill={loadingSkill}
            />
          </aside>
          <section>
            <ContentPanel
              item={selectedItem}
              selectedSkill={selectedSkill}
              capstoneData={capstoneData}
              onPlayVideo={setActiveVideo}
              onVideoCompleted={handleVideoCompleted}
              activePhaseProject={activePhaseProject}
              activePhaseNum={activePhaseNum}
              onProjectSubmitted={handleProjectSubmitted}
            />
          </section>
        </div>
      </div>
      <VideoModal
        video={activeVideo}
        skill={selectedSkill}
        onClose={() => setActiveVideo(null)}
        onVideoCompleted={handleVideoCompleted}
      />
    </>
  );
}
