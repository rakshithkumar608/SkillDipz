import api from "./api";

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  name: string;
  avatar_initials: string;
  college: string | null;
  branch: string | null;
  target_role: string | null;
  overall_score: number;
  assessments_taken: number;
  projects_completed: number;
  assignments_completed: number;
  current_streak: number;
  resume_quality: number;
  assessment_score: number;
  project_strength: number;
  interview_readiness: number;
  activity_consistency: number;
  is_me: boolean;
}

export interface Top3Entry {
  rank: number;
  student_id: string;
  name: string;
  avatar_initials: string;
  college: string | null;
  target_role: string | null;
  overall_score: number;
  assessments_taken: number;
  projects_completed: number;
  assignments_completed: number;
  current_streak: number;
}

export interface MyRankOut {
  rank: number;
  total_students: number;
  overall_score: number;
  percentile: number;
  college_rank: number | null;
  college_total: number | null;
  rank_change_7d: number;
}

export interface LeaderboardResponse {
  total_students: number;
  page: number;
  per_page: number;
  total_pages: number;
  my_rank: number;
  my_score: number;
  top_3: Top3Entry[];
  students: LeaderboardEntry[];
  my_rank_details: MyRankOut;
}

//  API Calls 

export async function fetchLeaderboard(params: {
  role?: string;
  scope?: "global" | "college";
  page?: number;
  per_page?: number;
  around_me?: boolean;
}): Promise<LeaderboardResponse> {
  const q = new URLSearchParams();
  if (params.role)     q.set("role",      params.role);
  if (params.scope)    q.set("scope",     params.scope);
  if (params.page)     q.set("page",      String(params.page));
  if (params.per_page) q.set("per_page",  String(params.per_page));
  if (params.around_me) q.set("around_me", "true");
  const { data } = await api.get<LeaderboardResponse>(`/leaderboard?${q}`);
  return data;
}

export async function fetchMyRank(role?: string): Promise<MyRankOut> {
  const q = role ? `?role=${role}` : "";
  const { data } = await api.get<MyRankOut>(`/leaderboard/me${q}`);
  return data;
}