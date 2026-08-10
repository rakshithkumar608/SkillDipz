import api from "./api";

export interface InterviewSession {
  session_id: string;
  mode: "company" | "ai";
  interview_type: "technical" | "hr" | "coding" | "system_design";
  company_name: string | null;
  company_id?: string | null;
  interviewer_name?: string | null;
  video_call_url?: string | null;
  scheduled_at: string | null;
  duration_mins: number;
  status:
    | "scheduled"
    | "waiting"
    | "in_progress"
    | "completed"
    | "terminated"
    | "cancelled";
  overall_score?: number | null;
  technical_score?: number | null;
  communication_score?: number | null;
  coding_score?: number | null;
  feedback?: string | null;
  transcript?: string | null;
  conversation?: { role: string; content: string }[];
  question_count?: number;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  violations_total: number;
  created_at: string;
  ended_at?: string | null;
  proctoring_enabled?: boolean;
  company_key?: string | null;
}

export interface ViolationResponse {
  session_terminated: boolean;
  termination_reason: string | null;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  total_violations: number;
  tab_switch_remaining: number;
  fullscreen_exit_remaining: number;
}

export interface AIStartResponse {
  session_id: string;
  mode: "ai";
  interview_type: string;
  company_name: string;
  duration_mins: number;
  proctoring_enabled: boolean;
  first_question: string;
  question_number: number;
  status: string;
}

export interface AIAnswerResponse {
  ai_message: string;
  question_number: number;
  interview_complete: boolean;
  overall_score?: number;
  feedback?: string;
  transcript?: string;
}

export async function getMyInterviews(): Promise<{ sessions: InterviewSession[]; total: number }> {
  const { data } = await api.get("/interviews/my");
  return data;
}

export async function getSessionDetail(sessionId: string): Promise<InterviewSession> {
  const { data } = await api.get(`/interviews/my/${sessionId}`);
  return data;
}

export async function joinInterview(sessionId: string): Promise<{
  message: string;
  session_id: string;
  mode: string;
  interview_type: string;
  duration_mins: number;
  video_call_url?: string;
  proctoring_enabled: boolean;
}> {
  const { data } = await api.post(`/interviews/${sessionId}/join`);
  return data;
}

export async function logViolation(
  sessionId: string,
  type: string,
  details?: string,
  isAI: boolean = false
): Promise<ViolationResponse> {
  const endpoint = isAI ? `/ai-interview/${sessionId}/violation` : `/interviews/${sessionId}/violation`;
  const { data } = await api.post(endpoint, {
    type,
    timestamp: new Date().toISOString(),
    details,
  });
  return data;
}

export async function startAIInterview(params: {
  company_key: string;
  company_name?: string;
  interview_type: "technical" | "hr";
  duration_mins: number;
}): Promise<AIStartResponse> {
  const { data } = await api.post("/ai-interview/start", params);
  return data;
}

export async function submitAIAnswer(
  sessionId: string,
  answer: string
): Promise<AIAnswerResponse> {
  const { data } = await api.post(`/ai-interview/${sessionId}/answer`, {
    session_id: sessionId,
    answer,
  });
  return data;
}

export async function completeInterview(
  sessionId: string,
  payload?: { overall_score?: number; feedback?: string }
): Promise<{ message: string; session_id: string; overall_score?: number }> {
  const { data } = await api.post(`/interviews/${sessionId}/complete`, {
    completed_by: "student",
    ...payload,
  });
  return data;
}
