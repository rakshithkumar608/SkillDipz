import api from "./api";

//  Student Profile helper (for role + CF handle) 
export const getMyProfile = async () => {
  const { data } = await api.get("/student-profile/me");
  return data as { target_roles: string; cf_handle: string | null };
};

//  MCQ Skill Tests 

export interface AssessmentTopic {
  topic_id: string;
  title: string;
  role: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  skill_tags: string[];
  question_count: number;
  time_limit_mins: number;
  last_score_pct: number | null;
  last_taken_at: string | null;
  can_retake: boolean;
  cooldown_until: string | null;
  attempt_count: number;
}

export interface MCQOption {
  key: string;
  text: string;
}

export interface MCQQuestion {
  question_id: string;
  question: string;
  options: MCQOption[];
}

export interface AssessmentSessionData {
  session_id: string;
  topic_title: string;
  time_limit_mins: number;
  expires_at: string;
  questions: MCQQuestion[];
}

export interface AssessmentExplanation {
  question_id: string;
  question: string;
  selected: string | null;
  correct_key: string;
  is_correct: boolean;
  explanation: string | null;
}

export interface AssessmentResult {
  score_pct: number;
  correct: number;
  total: number;
  skills_verified: string[];
  explanations: AssessmentExplanation[];
  next_retake_allowed_at: string;
}

export interface AssessmentHistoryItem {
  topic_id: string;
  topic_title: string;
  score_pct: number;
  correct_count: number;
  total_questions: number;
  skills_verified: string[];
  taken_at: string;
  next_retake_allowed_at: string;
}

export const getAvailableAssessments = async (role: string): Promise<AssessmentTopic[]> => {
  const { data } = await api.get<AssessmentTopic[]>(`/assessments/available?role=${role}`);
  return data;
};

export const startAssessment = async (topicId: string): Promise<AssessmentSessionData> => {
  const { data } = await api.post<AssessmentSessionData>(`/assessments/start/${topicId}`);
  return data;
};

export const getActiveSession = async (
  topicId: string
): Promise<{ session: (AssessmentSessionData & { seconds_remaining: number; answers_so_far: Record<string, string> }) | null; reason?: string }> => {
  const { data } = await api.get(`/assessments/session/active?topic_id=${topicId}`);
  return data;
};

export const submitAssessment = async (
  sessionId: string,
  answers: Record<string, string>
): Promise<AssessmentResult> => {
  const { data } = await api.post<AssessmentResult>(`/assessments/submit/${sessionId}`, { answers });
  return data;
};

export const getAssessmentHistory = async (): Promise<AssessmentHistoryItem[]> => {
  const { data } = await api.get<AssessmentHistoryItem[]>("/assessments/history");
  return data;
};

//  Codeforces Coding Problems 

export interface CFProblem {
  cf_problem_id: string;
  contest_id: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solved_count: number;
  difficulty: "Easy" | "Medium" | "Hard";
  cf_url: string;
  is_solved: boolean;
  is_bookmarked: boolean;
}

export interface CFProblemsResponse {
  total: number;
  page: number;
  limit: number;
  problems: CFProblem[];
}

export interface CFVerifyResult {
  verified: boolean;
  message: string;
  already_credited: boolean;
}

export interface CFProfileInfo {
  handle: string;
  rating: number | null;
  max_rating: number | null;
  rank: string;
  avatar: string;
  contribution: number;
}

export const getCodingProblems = async (
  role: string,
  difficulty: string,
  page = 1,
  limit = 20
): Promise<CFProblemsResponse> => {
  const { data } = await api.get<CFProblemsResponse>(
    `/practice/problems?role=${role}&difficulty=${difficulty}&page=${page}&limit=${limit}`
  );
  return data;
};

export const verifyCFSubmission = async (payload: {
  cf_handle: string;
  cf_problem_id: string;
  contest_id: number;
  index: string;
}): Promise<CFVerifyResult> => {
  const { data } = await api.post<CFVerifyResult>("/practice/verify", payload);
  return data;
};

export const getSolvedProblems = async () => {
  const { data } = await api.get("/practice/solved");
  return data;
};

export const getCFProfile = async (handle: string): Promise<CFProfileInfo> => {
  const { data } = await api.get<CFProfileInfo>(`/practice/cf-profile?handle=${handle}`);
  return data;
};

export const getBookmarks = async () => {
  const { data } = await api.get("/practice/bookmarks");
  return data;
};

export const addBookmark = async (problem: CFProblem) => {
  const { data } = await api.post("/practice/bookmarks", {
    cf_problem_id: problem.cf_problem_id,
    contest_id: problem.contest_id,
    index: problem.index,
    name: problem.name,
    rating: problem.rating,
    tags: problem.tags,
  });
  return data;
};

export const removeBookmark = async (cfProblemId: string) => {
  const { data } = await api.delete(`/practice/bookmarks/${cfProblemId}`);
  return data;
};