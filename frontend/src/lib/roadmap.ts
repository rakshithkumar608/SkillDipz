import api from "./api";

export interface YoutubeVideo {
  youtube_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration_label: string;
  category?: "core" | "reference";
  watched?: boolean;
}

export interface RoadmapItemContent {
  youtube: YoutubeVideo[];     // legacy flat list (backward compat)
  core: YoutubeVideo[];        // 2 core long-form videos
  reference: YoutubeVideo[];   // 2 reference shorter videos
}

export interface RoadmapItem {
  skill: string;
  gap: number;
  current_level: number;
  required_level: number;
  estimated_weeks: number;
  status: "in_progress" | "locked" | "completed";
  progress_pct: number;
  content: RoadmapItemContent;
  type?: never;
}

// Capstone/Advanced Project item (inside phase items array, legacy Phase 3)
export interface CapstoneItem {
  type: "project";
  title: string;
  description: string;
  status: "locked" | "in_progress" | "completed";
}

export type AnyRoadmapItem = RoadmapItem | CapstoneItem;

// Phase project state (the actual advanced project gate for each phase)
export interface PhaseProject {
  phase: number;
  title: string;
  description: string;
  level: string;
  required_skills: string[];
  status: "not_started" | "in_progress" | "completed";
  github_url: string | null;
  submitted_at: string | null;
}

export type PhaseStatus =
  | "LOCKED"
  | "UNLOCKED"
  | "IN_PROGRESS"
  | "PROJECT_REQUIRED"
  | "COMPLETED";

export interface RoadmapPhase {
  phase: number;
  label: string;
  items: AnyRoadmapItem[];
  // New phase-level fields
  phase_status: PhaseStatus;
  phase_project: PhaseProject | null;
  skills_completed: number;
  skills_total: number;
  project_completed: boolean;
}

export interface RoadmapData {
  role: string;
  generated_from: string;
  last_regenerated: string | null;
  progress_pct: number;
  phases: RoadmapPhase[];
  needs_setup: boolean;
}

// Type guard — use this to distinguish capstone items from skill items
export function isCapstone(item: AnyRoadmapItem): item is CapstoneItem {
  return (item as CapstoneItem).type === "project";
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function fetchRoadmap(): Promise<RoadmapData> {
  const { data } = await api.get<RoadmapData>("/roadmap/me");
  return data;
}

export async function fetchSkillVideos(skill: string): Promise<{
  videos: YoutubeVideo[];
  core: YoutubeVideo[];
  reference: YoutubeVideo[];
}> {
  const { data } = await api.get<{
    skill: string;
    videos: YoutubeVideo[];
    core: YoutubeVideo[];
    reference: YoutubeVideo[];
  }>("/roadmap/me/videos", { params: { skill } });
  return {
    videos: data.videos,
    core: data.core ?? [],
    reference: data.reference ?? [],
  };
}

export async function regenerateRoadmap(): Promise<RoadmapData> {
  const { data } = await api.post<RoadmapData>("/roadmap/me/regenerate");
  return data;
}

export async function markVideoWatched(
  skill: string,
  youtube_id: string
): Promise<{ progress_pct: number; status: string; overall_progress_pct: number; phase_states: Record<string, string> }> {
  const { data } = await api.post(
    `/roadmap/me/skills/${encodeURIComponent(skill)}/watch-video`,
    { youtube_id }
  );
  return data;
}

export async function startPhaseProject(phaseNum: number): Promise<PhaseProject> {
  const { data } = await api.post<PhaseProject>(
    `/roadmap/me/phases/${phaseNum}/project/start`
  );
  return data;
}

export async function submitPhaseProject(
  phaseNum: number,
  githubUrl: string
): Promise<RoadmapData> {
  const { data } = await api.post<RoadmapData>(
    `/roadmap/me/phases/${phaseNum}/project/submit`,
    { github_url: githubUrl }
  );
  return data;
}