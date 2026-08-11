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
  // quiz
  topic_id?: string;
  // code
  cf_url?: string;
  cf_rating?: number;
  // video
  youtube_id?: string;
  channel?: string;
  duration_label?: string;
  // flashcard
  flashcards?: Flashcard[];
  // explain
  explain_prompt?: string;
  // resume_tweak
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


/** Get today's assignment (auto-generates if not yet created) */
export const getTodayAssignment = async (): Promise<DailyAssignment> => {
  const { data } = await api.get("/students/me/daily-assignments");
  return data;
};

/** Get assignment for a specific date (read-only for past dates) */
export const getAssignmentByDate = async (date: string): Promise<DailyAssignment> => {
  const { data } = await api.get("/students/me/daily-assignments", { params: { date } });
  return data;
};

/** Mark a specific task as completed */
export const completeTask = async (
  taskId: string
): Promise<{ message: string; task_id: string; all_done: boolean; streak: number }> => {
  const { data } = await api.post(`/students/me/daily-assignments/${taskId}/complete`);
  return data;
};

/** Get platform-wide completion stats for the social proof widget */
export const getPlatformStats = async (): Promise<PlatformStats> => {
  const { data } = await api.get("/daily-assignments/stats");
  return data;
};
