import api from "./api";

export interface Flashcard {
  front: string;
  back: string;
}

export interface DailyTask {
  task_id: string;
  type: "quiz" | "code" | "video" | "flashcard" | "explain" | "resume_tweak" | "wildcard";
  subtype?: string;
  title: string;
  status: "pending" | "completed" | "skipped";
  points: number;
  completed_at?: string;
  skill_tag?: string;
  topic_id?: string;
  cf_url?: string;
  cf_rating?: number;
  youtube_id?: string;
  channel?: string;
  duration_label?: string;
  flashcards?: Flashcard[];
  explain_prompt?: string;
  resume_skill?: string;
  tweak_instruction?: string;
}

export interface SponsoredTask {
  company: string;
  type: string;
  title: string;
  points: number;
  content_ref?: string;
}

export interface DailyAssignment {
  date: string;
  difficulty: "EASY" | "MEDIUM" | "BOSS";
  completed: number;
  total: number;
  tasks: DailyTask[];
  sponsored_task?: SponsoredTask;
  streak: number;
  streak_tier: string;
  streak_bonus?: string;
  completed_today_platform_wide: number;
}

export interface PlatformStats {
  completed_today: number;
  total_active_students: number;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_active: string | null;
}

export const getTodayAssignment = async (): Promise<DailyAssignment> => {
  const { data } = await api.get("/students/me/daily-assignments");
  return data;
};

export const completeTask = async (
  taskId: string
): Promise<{ message: string; task_id: string; all_done: boolean; streak: number }> => {
  const { data } = await api.post(`/students/me/daily-assignments/${taskId}/complete`);
  return data;
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const { data } = await api.get("/daily-assignments/stats");
  return data;
};

export const getStreakData = async (): Promise<StreakData> => {
  const { data } = await api.get("/students/me/streak");
  return data;
};

