import api from "./api";

export interface YoutubeVideo {
    youtube_id: string;
    title: string;
    channel: string;
    thumbnail: string;
    duration_label: string;
}

export interface RoadmapItemContent {
    youtube: YoutubeVideo[];
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

// Capstone item 
export interface CapstoneItem {
    type: "project";
    title: string;
    description: string;
    status: "locked" | "in_progress" | "completed";
}

export type AnyRoadmapItem = RoadmapItem | CapstoneItem;


export interface RoadmapPhase {
  phase: number;
  label: string;
  items: AnyRoadmapItem[];
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


export async function fetchRoadmap(): Promise<RoadmapData> {
  const { data } = await api.get<RoadmapData>("/roadmap/me");
  return data;
}

export async function fetchSkillVideos(skill: string): Promise<YoutubeVideo[]> {
  const { data } = await api.get<{ skill: string; videos: YoutubeVideo[] }>(
    "/roadmap/me/videos",
    { params: { skill } }
  );
  return data.videos;
}


export async function regenerateRoadmap(): Promise<RoadmapData> {
  const { data } = await api.post<RoadmapData>("/roadmap/me/regenerate");
  return data;
}