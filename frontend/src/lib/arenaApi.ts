import api from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArenaOption {
  key: string;
  text: string;
}

export interface ArenaQuestion {
  question_id: string;
  question: string;
  options: ArenaOption[];
  time_limit: number;
  xp_reward: number;
  skill: string;
  code_snippet?: string | null;
  scenario?: string | null;
}

export interface StartSessionResponse {
  session_id: string;
  game_type: string;
  questions: ArenaQuestion[];
  expires_at: string;
  total_questions: number;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_key: string;
  explanation: string;
  xp_earned: number;
  speed_bonus: number;
}

export interface AnswerSummary {
  question_id: string;
  question: string;
  skill: string;
  submitted_key: string;
  correct_key: string;
  is_correct: boolean;
  xp_earned: number;
  explanation: string;
}

export interface LevelInfo {
  level: number;
  xp_in_level: number;
  xp_for_next_level: number;
  progress_pct: number;
}

export interface CompleteSessionResponse {
  session_id: string;
  game_type: string;
  total_xp: number;
  correct_count: number;
  total_questions: number;
  accuracy: number;
  is_perfect: boolean;
  total_time_ms?: number;
  total_time_str?: string | null;
  answers: AnswerSummary[];
  new_total_xp: number;
  level_info: LevelInfo;
  leveled_up: boolean;
  old_level: number;
  arena_streak: number;
  badges_earned: string[];
}

export interface DailyArenaOut {
  date_str: string;
  total_xp: number;
  quick_fire_count: number;
  debug_rush_count: number;
  tech_decision_count: number;
  already_completed: boolean;
  completed_at?: string | null;
  time_taken_str?: string | null;
}

export interface SkillScoreOut {
  skill: string;
  correct: number;
  total: number;
  score: number;
}

export interface LeaderboardPreviewEntry {
  rank: number;
  student_id: string;
  name: string;
  avatar_initials: string;
  level: number;
  weekly_xp: number;
  arena_streak: number;
  is_me: boolean;
}

export interface ArenaHomeResponse {
  total_xp: number;
  weekly_xp: number;
  level: number;
  xp_in_level: number;
  xp_for_next_level: number;
  progress_pct: number;
  arena_streak: number;
  longest_arena_streak: number;
  daily: DailyArenaOut;
  leaderboard_preview: LeaderboardPreviewEntry[];
  my_daily_rank?: number | null;
  my_weekly_rank?: number | null;
  my_lifetime_rank?: number | null;
  recent_accuracy: number;
  total_games_played: number;
  skill_scores: SkillScoreOut[];
  completed_game_types_today?: string[];
}

export interface ArenaLeaderboardEntry {
  rank: number;
  student_id: string;
  name: string;
  avatar_initials: string;
  level: number;
  xp: number;
  arena_streak: number;
  time_taken_ms?: number | null;
  time_taken_str?: string | null;
  is_me: boolean;
}

export interface ArenaLeaderboardResponse {
  scope: "today" | "weekly" | "lifetime";
  entries: ArenaLeaderboardEntry[];
  my_entry?: ArenaLeaderboardEntry | null;
  total: number;
}

export interface BadgeOut {
  badge_id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at?: string | null;
}

export interface ArenaProfileResponse {
  total_xp: number;
  weekly_xp: number;
  level: number;
  xp_in_level: number;
  xp_for_next_level: number;
  progress_pct: number;
  arena_streak: number;
  longest_arena_streak: number;
  last_arena_date?: string | null;
  skill_scores: Record<string, { correct: number; total: number; score: number }>;
  badges: BadgeOut[];
}

export interface SkillRecommendation {
  skill: string;
  accuracy: number;
  is_weak: boolean;
  recommended_action: string;
  roadmap_link?: string | null;
}

export interface SkillsResponse {
  skills: SkillRecommendation[];
  weakest_skill?: string | null;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const getArenaHome = async (): Promise<ArenaHomeResponse> => {
  const { data } = await api.get<ArenaHomeResponse>("/arena/home");
  return data;
};

export const getDailyArena = async (): Promise<DailyArenaOut> => {
  const { data } = await api.get<DailyArenaOut>("/arena/daily");
  return data;
};

export const startSession = async (
  game_type: "quick_fire" | "debug_rush" | "tech_decision",
  difficulty?: "easy" | "medium" | "hard"
): Promise<StartSessionResponse> => {
  const { data } = await api.post<StartSessionResponse>("/arena/start", {
    game_type,
    difficulty,
  });
  return data;
};

export const submitAnswer = async (payload: {
  session_id: string;
  question_id: string;
  answer_key: string;
  elapsed_ms: number;
}): Promise<SubmitAnswerResponse> => {
  const { data } = await api.post<SubmitAnswerResponse>("/arena/answer", payload);
  return data;
};

export const completeSession = async (
  session_id: string
): Promise<CompleteSessionResponse> => {
  const { data } = await api.post<CompleteSessionResponse>("/arena/complete", {
    session_id,
  });
  return data;
};

export const startDailyArena = async (): Promise<StartSessionResponse> => {
  const { data } = await api.post<StartSessionResponse>("/arena/daily/start", {});
  return data;
};

export const completeDailyArena = async (
  session_id: string
): Promise<CompleteSessionResponse> => {
  const { data } = await api.post<CompleteSessionResponse>("/arena/daily/complete", {
    session_id,
  });
  return data;
};

export const getSessionResults = async (
  session_id: string
): Promise<CompleteSessionResponse> => {
  const { data } = await api.get<CompleteSessionResponse>(
    `/arena/results/${session_id}`
  );
  return data;
};

export const getArenaLeaderboard = async (
  scope: "today" | "weekly" | "lifetime" = "today"
): Promise<ArenaLeaderboardResponse> => {
  const { data } = await api.get<ArenaLeaderboardResponse>(
    `/arena/leaderboard?scope=${scope}`
  );
  return data;
};

export const getArenaProfile = async (): Promise<ArenaProfileResponse> => {
  const { data } = await api.get<ArenaProfileResponse>("/arena/profile");
  return data;
};

export const getSkillBreakdown = async (): Promise<SkillsResponse> => {
  const { data } = await api.get<SkillsResponse>("/arena/skills");
  return data;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const GAME_TYPE_LABELS: Record<string, string> = {
  quick_fire: "Quick Fire",
  debug_rush: "Debug Rush",
  tech_decision: "Tech Decision",
  daily: "Daily Arena",
};

export const GAME_TYPE_DESCRIPTIONS: Record<string, string> = {
  quick_fire: "Fast technical questions. 10 Qs. Prove your fundamentals.",
  debug_rush: "Spot the bug before the clock beats you. 10 snippets.",
  tech_decision: "Make the right engineering call. 10 real scenarios.",
};

export const GAME_TYPE_XP: Record<string, string> = {
  quick_fire: "10 XP / question",
  debug_rush: "20 XP / question",
  tech_decision: "20 XP / question",
};

export const GAME_TYPE_TIME: Record<string, string> = {
  quick_fire: "~3 minutes",
  debug_rush: "~4 minutes",
  tech_decision: "~5 minutes",
};

export const SKILL_DISPLAY: Record<string, string> = {
  javascript: "JavaScript",
  react: "React",
  python: "Python",
  sql: "SQL",
  backend: "Backend",
  system_design: "System Design",
  security: "Security",
  devops: "DevOps",
};
