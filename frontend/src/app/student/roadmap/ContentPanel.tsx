"use client";

import {
  CapstoneItem,
  PhaseProject,
  RoadmapItem,
  YoutubeVideo,
  fetchSkillVideos,
  isCapstone,
  startPhaseProject,
  submitPhaseProject,
} from "@/lib/roadmap";
import {
  Play,
  BookOpen,
  ChevronRight,
  Zap,
  Target,
  Clock,
  Lock,
  CheckCircle2,
  Rocket,
  ExternalLink,
  Loader2,
  Star,
  Bookmark,
  PartyPopper,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { FaGithub, FaYoutube } from "react-icons/fa";
import { toast } from "sonner";

interface ContentPanelProps {
  item: RoadmapItem | null;
  selectedSkill: string | null;
  capstoneData: CapstoneItem | null;
  onPlayVideo: (video: YoutubeVideo) => void;
  onVideoCompleted?: (youtubeId: string) => void;
  // Phase project support
  activePhaseProject: PhaseProject | null;
  activePhaseNum: number | null;
  onProjectSubmitted: (updatedRoadmap: import("@/lib/roadmap").RoadmapData) => void;
}

//  Sub-components

function SkillLevelBar({
  current,
  required,
}: {
  current: number;
  required: number;
}) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(to right, #0ea5e9, #6366f1)" }}
        />
      </div>
      <span className="text-slate-400 font-medium whitespace-nowrap">
        {current}/{required}
      </span>
    </div>
  );
}

function VideoCard({
  video,
  onPlay,
  badge,
}: {
  video: YoutubeVideo;
  onPlay: (v: YoutubeVideo) => void;
  badge?: string;
}) {
  return (
    <button
      id={`play-video-${video.youtube_id}`}
      onClick={() => onPlay(video)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 group text-left ${
        video.watched
          ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
          : "bg-slate-800/50 hover:bg-slate-800 border-white/5 hover:border-white/10"
      }`}
    >
      <div className="relative shrink-0 w-24 sm:w-28 h-14 sm:h-16 rounded-lg overflow-hidden">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
            <FaYoutube className="w-6 h-6 text-slate-500" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-slate-900 fill-slate-900 ml-0.5" />
          </div>
        </div>
        {video.watched && (
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium line-clamp-2 leading-snug ${
            video.watched
              ? "text-emerald-300"
              : "text-slate-200 group-hover:text-white"
          }`}
        >
          {video.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-[11px] text-slate-500 truncate">{video.channel}</p>
          {video.duration_label && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-400">
              {video.duration_label}
            </span>
          )}
          {badge && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400">
              {badge}
            </span>
          )}
          {video.watched && (
            <span className="shrink-0 text-[10px] font-semibold text-emerald-400">
              ✓ Watched
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className={`w-4 h-4 shrink-0 transition-colors ${
          video.watched
            ? "text-emerald-500"
            : "text-slate-600 group-hover:text-slate-400"
        }`}
      />
    </button>
  );
}

function EmptyVideos({ skill, onRetry }: { skill: string; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-slate-500 text-sm">
        No videos found for <strong>{skill}</strong>.
      </p>
      <p className="text-slate-600 text-xs mt-1">YouTube API quota may be exhausted.</p>
      <button
        onClick={onRetry}
        className="mt-3 text-xs text-sky-400 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

// Phase Project Panel 

function PhaseProjectPanel({
  project,
  phaseNum,
  onProjectSubmitted,
}: {
  project: PhaseProject;
  phaseNum: number;
  onProjectSubmitted: (roadmap: import("@/lib/roadmap").RoadmapData) => void;
}) {
  const [githubUrl, setGithubUrl] = useState(project.github_url ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [localProject, setLocalProject] = useState(project);

  // Keep local state in sync with prop changes
  useEffect(() => {
    setLocalProject(project);
    setGithubUrl(project.github_url ?? "");
  }, [project]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const updated = await startPhaseProject(phaseNum);
      setLocalProject(updated);
      toast.success("Project started! Submit your GitHub repository when ready.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to start project.";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!githubUrl.trim()) {
      toast.error("Please enter your GitHub repository URL.");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await submitPhaseProject(phaseNum, githubUrl.trim());
      toast.success(
        `Phase ${phaseNum} complete! ${phaseNum < 3 ? `Phase ${phaseNum + 1} unlocked! 🎉` : "You've finished your learning journey! 🏆"}`
      );
      onProjectSubmitted(updated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to submit project.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isCompleted = localProject.status === "completed";
  const isStarted = localProject.status !== "not_started";

  return (
    <div className="flex flex-col gap-4">
      {/* Project Header */}
      <div
        className={`rounded-2xl border p-6 ${
          isCompleted
            ? "bg-emerald-950/20 border-emerald-500/20"
            : "bg-amber-950/15 border-amber-500/20"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              isCompleted
                ? "bg-emerald-500/15 border border-emerald-500/30"
                : "bg-amber-500/10 border border-amber-500/20"
            }`}
          >
            {isCompleted ? (
              <PartyPopper className="w-7 h-7 text-emerald-400" />
            ) : (
              <Rocket className="w-7 h-7 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isCompleted
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {isCompleted ? "✓ Completed" : `Level ${phaseNum} · ${localProject.level}`}
              </span>
            </div>
            <h2
              className={`text-lg font-bold leading-tight ${
                isCompleted ? "text-emerald-200" : "text-amber-100"
              }`}
            >
              {localProject.title}
            </h2>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              {localProject.description}
            </p>
          </div>
        </div>

        {/* Required Skills */}
        {localProject.required_skills.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Skills Applied
            </p>
            <div className="flex flex-wrap gap-1.5">
              {localProject.required_skills.map((skill) => (
                <span
                  key={skill}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/70 text-slate-300 border border-white/5"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Completed state */}
      {isCompleted && (
        <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/20 p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">Project Submitted</p>
          </div>
          {localProject.github_url && (
            <a
              href={localProject.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 transition-colors break-all"
            >
              <FaGithub className="w-3.5 h-3.5 shrink-0" />
              {localProject.github_url}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
          {phaseNum < 3 && (
            <p className="text-xs text-emerald-400/70 mt-3">
              🎉 Phase {phaseNum + 1} is now unlocked. Continue your learning journey!
            </p>
          )}
          {phaseNum >= 3 && (
            <p className="text-xs text-emerald-400/70 mt-3">
              🏆 Congratulations! You have completed your full learning roadmap.
            </p>
          )}
        </div>
      )}

      {/* Action Panel (not completed) */}
      {!isCompleted && (
        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5">
          {!isStarted ? (
            <>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Ready to begin?
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                You have completed all required skills in Phase {phaseNum}.
                Start the advanced project to continue to Phase{" "}
                {phaseNum + 1}.
              </p>
              <button
                id={`start-project-phase-${phaseNum}`}
                onClick={handleStart}
                disabled={starting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                {starting ? "Starting…" : "Start Project"}
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Submit Your Project
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Build the project, push to GitHub, and paste your repository
                URL below to complete Phase {phaseNum}.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-amber-500/40 transition-colors">
                  <FaGithub className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    id={`github-url-phase-${phaseNum}`}
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/your-username/project-name"
                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none min-w-0"
                  />
                </div>
                <button
                  id={`submit-project-phase-${phaseNum}`}
                  onClick={handleSubmit}
                  disabled={submitting || !githubUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {submitting ? "Submitting…" : "Submit & Complete Phase"}
                </button>
              </div>
              <p className="text-[11px] text-slate-600 mt-3">
                Make sure your repository is public so it can be reviewed.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

//  Main ContentPanel 

export function ContentPanel({
  item,
  selectedSkill,
  capstoneData,
  onPlayVideo,
  onVideoCompleted,
  activePhaseProject,
  activePhaseNum,
  onProjectSubmitted,
}: ContentPanelProps) {
  const [coreVideos, setCoreVideos] = useState<YoutubeVideo[]>([]);
  const [refVideos, setRefVideos] = useState<YoutubeVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const loadVideos = useCallback(async (skill: string) => {
    setLoadingVideos(true);
    setVideoError(false);
    try {
      const result = await fetchSkillVideos(skill);
      setCoreVideos(result.core.length > 0 ? result.core : result.videos.slice(0, 2));
      setRefVideos(result.reference.length > 0 ? result.reference : result.videos.slice(2, 4));
    } catch {
      setVideoError(true);
      setCoreVideos([]);
      setRefVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    if (!item) {
      setCoreVideos([]);
      setRefVideos([]);
      return;
    }
    const preloaded = item.content;
    const hasCore = preloaded.core && preloaded.core.length > 0;
    const hasRef = preloaded.reference && preloaded.reference.length > 0;
    const hasLegacy = preloaded.youtube && preloaded.youtube.length > 0;

    if (hasCore || hasRef) {
      setCoreVideos(preloaded.core || []);
      setRefVideos(preloaded.reference || []);
    } else if (hasLegacy) {
      // Backward compat: split flat list into core/reference
      setCoreVideos(preloaded.youtube.slice(0, 2));
      setRefVideos(preloaded.youtube.slice(2, 4));
    } else {
      loadVideos(item.skill);
    }
  }, [item, loadVideos]);

  const handleVideoCompleted = useCallback(
    (youtubeId: string) => {
      // Mark watched locally for instant UI feedback
      setCoreVideos((prev) =>
        prev.map((v) => (v.youtube_id === youtubeId ? { ...v, watched: true } : v))
      );
      setRefVideos((prev) =>
        prev.map((v) => (v.youtube_id === youtubeId ? { ...v, watched: true } : v))
      );
      onVideoCompleted?.(youtubeId);
    },
    [onVideoCompleted]
  );

  // ── Phase Project Panel ──
  if (
    selectedSkill?.startsWith("__project_phase_") &&
    activePhaseProject &&
    activePhaseNum !== null
  ) {
    return (
      <PhaseProjectPanel
        project={activePhaseProject}
        phaseNum={activePhaseNum}
        onProjectSubmitted={onProjectSubmitted}
      />
    );
  }

  // ── Legacy capstone sentinel ──
  if (selectedSkill === "__capstone__") {
    return (
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
          <Rocket className="w-8 h-8 text-emerald-400/50" />
        </div>
        <h2 className="text-lg font-bold text-slate-200 mb-2">
          {capstoneData?.title ?? "Capstone Project"}
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto mb-5">
          {capstoneData?.description ??
            "Build a complete application integrating all acquired skills."}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-white/5 text-slate-500 text-sm">
          <Lock className="w-4 h-4" />
          <span>Complete Phase 1 &amp; Phase 2 to unlock</span>
        </div>
      </div>
    );
  }

  // ── No skill selected ──
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 text-center px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-slate-400 font-medium">Select a skill</p>
        <p className="text-slate-600 text-sm mt-1">
          Choose a skill from the timeline to see learning content
        </p>
      </div>
    );
  }

  const gapColor =
    item.gap >= 3
      ? "text-red-400"
      : item.gap >= 2
      ? "text-amber-400"
      : "text-emerald-400";
  const gapBg =
    item.gap >= 3
      ? "bg-red-500/10"
      : item.gap >= 2
      ? "bg-amber-500/10"
      : "bg-emerald-500/10";
  const watchedCount = [...coreVideos, ...refVideos].filter((v) => v.watched).length;
  const totalVideoCount = coreVideos.length + refVideos.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Skill header card */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{item.skill}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Est. {item.estimated_weeks} week
              {item.estimated_weeks !== 1 ? "s" : ""} to complete
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${gapBg} ${gapColor} shrink-0`}
          >
            Gap: {item.gap}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              icon: Target,
              color: "text-sky-400",
              label: "Current",
              value: `${item.status === "completed" ? item.required_level : item.current_level}/${item.required_level}`,
            },
            {
              icon: Zap,
              color: gapColor,
              label: "Gap",
              value: `${item.status === "completed" ? 0 : item.gap} levels`,
            },
            {
              icon: Clock,
              color: "text-emerald-400",
              label: "Progress",
              value: `${item.status === "completed" ? 100 : item.progress_pct}%`,
            },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium hidden sm:block">
                  {label}
                </span>
              </div>
              <span className={`text-base sm:text-lg font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
            <span>Skill Level Progress</span>
            <span>
              {item.status === "completed" ? item.required_level : item.current_level} of {item.required_level} required
            </span>
          </div>
          {/* Use progress_pct as fill when current_level hasn't synced yet */}
          <SkillLevelBar
            current={item.status === "completed" ? item.required_level : item.current_level}
            required={item.required_level}
          />
        </div>

        {/* Video progress summary — always show when skill has progress */}
        {item.progress_pct > 0 || totalVideoCount > 0 || item.status === "completed" ? (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-medium">
              <span>Videos watched</span>
              <span className={item.status === "completed" || item.progress_pct > 0 ? "text-emerald-400 font-semibold" : ""}>
                {item.status === "completed"
                  ? "4/4"
                  : totalVideoCount > 0
                  ? `${watchedCount}/${totalVideoCount}`
                  : `${Math.round(item.progress_pct / 25)}/4`}
              </span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-emerald-500 to-sky-500 rounded-full transition-all duration-700"
                style={{
                  width: `${item.status === "completed" ? 100 : (item.progress_pct > 0 ? item.progress_pct : (totalVideoCount > 0 ? (watchedCount / totalVideoCount) * 100 : 0))}%`,
                  background: "linear-gradient(to right, #10b981, #0ea5e9)",
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">
              {item.status === "completed" || item.progress_pct >= 100
                ? "✓ Skill completed"
                : "Watch 4 videos (90%+ each) to complete this skill"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Videos card */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <FaYoutube className="w-3.5 h-3.5 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Learning Resources</h3>
          <span className="ml-auto text-[10px] text-slate-600 hidden sm:block">
            YouTube · {item.skill}
          </span>
          {watchedCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {watchedCount}/{totalVideoCount} watched
            </span>
          )}
        </div>

        <div className="p-4">
          {loadingVideos ? (
            <div className="flex items-center justify-center py-10 gap-2.5 text-slate-500">
              <span className="w-5 h-5 rounded-full border-2 border-slate-500 border-t-sky-400 animate-spin" />
              <span className="text-sm">Fetching resources for {item.skill}…</span>
            </div>
          ) : videoError ? (
            <EmptyVideos
              skill={item.skill}
              onRetry={() => loadVideos(item.skill)}
            />
          ) : coreVideos.length === 0 && refVideos.length === 0 ? (
            <EmptyVideos
              skill={item.skill}
              onRetry={() => loadVideos(item.skill)}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {/* CORE LEARNING section */}
              {coreVideos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-3.5 h-3.5 text-sky-400" />
                    <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                      Core Learning
                    </h4>
                    <span className="text-[10px] text-slate-600">
                      · Choose one as your primary resource
                    </span>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {coreVideos.map((video) => (
                      <li key={video.youtube_id}>
                        <VideoCard
                          video={video}
                          onPlay={(v) => {
                            onPlayVideo(v);
                          }}
                          badge="Core"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* REFERENCE section */}
              {refVideos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Reference
                    </h4>
                    <span className="text-[10px] text-slate-600">
                      · Supplementary &amp; targeted guides
                    </span>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {refVideos.map((video) => (
                      <li key={video.youtube_id}>
                        <VideoCard
                          video={video}
                          onPlay={(v) => {
                            onPlayVideo(v);
                          }}
                          badge="Reference"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
