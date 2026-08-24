import api from "./api";



export interface SpotBugCardOut {
  id: string;
  snippet: string;
  // is_buggy intentionally absent — revealed only after submit
}

export interface SpotBugCardReveal {
  id: string;
  is_buggy: boolean;
  fix_explanation: string;
}

export interface SpotBugPayloadOut {
  cards: SpotBugCardOut[];
}

export interface OrderItItemOut {
  id: string;
  label: string;
}

export interface OrderItPayloadOut {
  items: OrderItItemOut[];
  // correct_order intentionally absent
}

export interface StackItZoneOut {
  id: string;
  label: string;
}

export interface StackItComponentOut {
  id: string;
  label: string;
  // correct_zone_id intentionally absent
}

export interface StackItPayloadOut {
  scenario: string;
  zones: StackItZoneOut[];
  components: StackItComponentOut[];
}

//  Shared Types 

export interface ArenaOption {
  key: string;
  text: string;
}

export interface ArenaQuestion {
  question_id: string;
  game_type: string;
  question: string;
  skill: string;
  difficulty: string;
  time_limit: number;
  xp_reward: number;
  // V2 payloads
  spotbug_payload?: SpotBugPayloadOut | null;
  orderit_payload?: OrderItPayloadOut | null;
  stackit_payload?: StackItPayloadOut | null;
  // Legacy MCQ
  options?: ArenaOption[] | null;
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

//  V2 Submit Types 

export interface SpotBugCall {
  card_id: string;
  user_said_buggy: boolean;
  time_taken_ms: number;
}

export interface SpotBugAnswerResponse {
  accuracy: number;
  xp_earned: number;
  correct_count: number;
  total_cards: number;
  card_reveals: SpotBugCardReveal[];
  explanation: string;
}

export interface OrderItAnswerResponse {
  accuracy: number;
  xp_earned: number;
  correct_positions: number;
  total_items: number;
  correct_order: string[];
  explanation: string;
}

export interface StackItPlacement {
  component_id: string;
  placed_zone_id: string;
}

export interface StackItAnswerResponse {
  accuracy: number;
  xp_earned: number;
  correct_count: number;
  total_components: number;
  correct_placements: { component_id: string; correct_zone_id: string }[];
  explanation: string;
}

//  Legacy MCQ Submit Types 

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_key: string;
  explanation: string;
  xp_earned: number;
  speed_bonus: number;
}

//  Complete Session 

export interface ArenaGameResult {
  game_type: string;
  skill: string;
  accuracy: number;
  xp_earned: number;
  question_id: string;
}

export interface AnswerSummary {
  question_id: string;
  question: string;
  skill: string;
  game_type: string;
  submitted_key: string;
  correct_key: string;
  is_correct: boolean;
  accuracy: number;
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
  game_results: ArenaGameResult[];
  new_total_xp: number;
  level_info: LevelInfo;
  leveled_up: boolean;
  old_level: number;
  arena_streak: number;
  badges_earned: string[];
  daily_bonus_xp?: number;
}

//  Daily Arena 

export interface DailyArenaOut {
  date_str: string;
  total_xp: number;
  spotbug_ready: boolean;
  orderit_ready: boolean;
  stackit_ready: boolean;
  already_completed: boolean;
  completed_at?: string | null;
  time_taken_str?: string | null;
  next_reset_at?: string | null;
}

//  Arena Home 

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

//  Leaderboard 

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

//  API Functions 

export const getArenaHome = async (): Promise<ArenaHomeResponse> => {
  const { data } = await api.get<ArenaHomeResponse>("/arena/home");
  return data;
};

export const getDailyArena = async (): Promise<DailyArenaOut> => {
  const { data } = await api.get<DailyArenaOut>("/arena/daily");
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

//  V2 Game Answer Submitters 

export const submitSpotBugAnswer = async (payload: {
  session_id: string;
  question_id: string;
  calls: SpotBugCall[];
  elapsed_ms: number;
}): Promise<SpotBugAnswerResponse> => {
  const { data } = await api.post<SpotBugAnswerResponse>("/arena/answer/spotbug", payload);
  return data;
};

export const submitOrderItAnswer = async (payload: {
  session_id: string;
  question_id: string;
  user_order: string[];
  elapsed_ms: number;
}): Promise<OrderItAnswerResponse> => {
  const { data } = await api.post<OrderItAnswerResponse>("/arena/answer/orderit", payload);
  return data;
};

export const submitStackItAnswer = async (payload: {
  session_id: string;
  question_id: string;
  placements: StackItPlacement[];
  elapsed_ms: number;
}): Promise<StackItAnswerResponse> => {
  const { data } = await api.post<StackItAnswerResponse>("/arena/answer/stackit", payload);
  return data;
};

//  Legacy MCQ 

export const startSession = async (
  game_type: "quick_fire" | "debug_rush" | "tech_decision" | "spotbug" | "orderit" | "stackit",
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

//  Helpers 

export const GAME_TYPE_LABELS: Record<string, string> = {
  spotbug: "Spot the Bug",
  orderit: "Order the Steps",
  stackit: "Stack It",
  quick_fire: "Quick Fire",
  debug_rush: "Debug Rush",
  tech_decision: "Tech Decision",
  daily: "Daily Arena",
};

export const GAME_TYPE_DESCRIPTIONS: Record<string, string> = {
  spotbug: "Swipe through code snippets — call out the bugs before the timer runs out.",
  orderit: "Drag the shuffled steps into the correct sequence.",
  stackit: "Drag component chips into the right architecture zones.",
};

export const GAME_TYPE_XP: Record<string, string> = {
  spotbug: "Up to 116 XP (combo bonuses)",
  orderit: "Up to 20 XP (partial credit)",
  stackit: "Up to 40 XP (difficulty ×2)",
};

export const GAME_TYPE_TIME: Record<string, string> = {
  spotbug: "~90 seconds",
  orderit: "~60 seconds",
  stackit: "~75 seconds",
};

export const GAME_TYPE_ICONS: Record<string, string> = {
  spotbug: "bug",
  orderit: "list-ordered",
  stackit: "layers",
};

export const SKILL_DISPLAY: Record<string, string> = {
  "JavaScript Fundamentals": "JavaScript",
  "React Hooks": "React",
  "API Design": "API Design",
  javascript: "JavaScript",
  react: "React",
  python: "Python",
  sql: "SQL",
  backend: "Backend",
  system_design: "System Design",
  security: "Security",
  devops: "DevOps",
};

/** Format ms countdown to "Xh Ym" or "Xm Ys" */
export function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
