import api from "./api";

export interface DetailedRubric {
  dsa_problem_solving?: number | null;
  system_architecture?: number | null;
  behavioral_culture_fit?: number | null;
  code_quality?: number | null;
  communication_clarity?: number | null;
  key_strengths?: string[];
  improvement_areas?: string[];
  actionable_recommendations?: string[];
}

export interface InterviewSession {
  session_id: string;
  mode: "company" | "ai" | "mentor";
  interview_type: string;
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
  rubric?: DetailedRubric | null;
  recording_url?: string | null;
  recording_duration_sec?: number | null;
  mentor_id?: string | null;
  mentor_name?: string | null;
  transcript?: string | null;
  conversation?: { role: string; content: string }[];
  question_count?: number;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  violations_total?: number;
  violations?: any[];
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
  rubric?: DetailedRubric;
  transcript?: string;
}

export interface MentorProfile {
  mentor_id: string;
  user_id: string;
  full_name: string;
  name?: string;
  email: string;
  profile_photo?: string | null;
  avatar_url?: string | null;
  headline?: string;
  title?: string;
  bio: string;
  expertise: string[];
  skills: string[];
  expertise_tags?: string[];
  experience_years: number;
  years_experience?: number;
  current_role: string;
  company: string;
  education?: string;
  languages: string[];
  mentoring_topics: string[];
  profile_status: "INCOMPLETE" | "ACTIVE" | "INACTIVE";
  rating: number;
  total_reviews: number;
  sessions_completed: number;
  hourly_rate_inr?: number;
  available_slots_count?: number;
  next_available_slot?: string | null;
  slots?: MentorSlot[];
  created_at?: string;
  updated_at?: string;
}

export interface MentorSlot {
  slot_id: string;
  mentor_id: string;
  user_id: string;
  mentor_name?: string;
  available_day?: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
  is_enabled: boolean;
  is_booked?: boolean;
  booking_id?: string | null;
}

export interface MentorshipBooking {
  booking_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  mentor_id: string;
  mentor_name: string;
  mentor_company: string;
  slot_id: string;
  topic: string;
  target_role?: string;
  target_company?: string;
  student_notes?: string;
  scheduled_at: string;
  duration_mins: number;
  meeting_url?: string;
  status: "confirmed" | "in_progress" | "completed" | "cancelled" | "pending";
  overall_score?: number | null;
  rubric?: DetailedRubric | null;
  mentor_feedback?: string | null;
  student_rating?: number | null;
  student_review?: string | null;
  recording_url?: string | null;
  created_at: string;
}

// ─── Student Interview Endpoints ─────────────────────────────────────────────

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
  payload?: { overall_score?: number; feedback?: string; rubric?: DetailedRubric }
): Promise<{ message: string; session_id: string; overall_score?: number }> {
  const { data } = await api.post(`/interviews/${sessionId}/complete`, {
    completed_by: "student",
    ...payload,
  });
  return data;
}

export async function uploadInterviewRecording(
  sessionId: string,
  blob: Blob,
  durationSec?: number
): Promise<{ message: string; recording_url: string; duration_sec?: number }> {
  const formData = new FormData();
  formData.append("file", blob, `interview_${sessionId}.webm`);
  if (durationSec) {
    formData.append("duration_sec", durationSec.toString());
  }

  const { data } = await api.post(`/interviews/${sessionId}/recording`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function submitRubricFeedback(
  sessionId: string,
  rubric: DetailedRubric
): Promise<{ message: string; overall_score: number; rubric: DetailedRubric }> {
  const { data } = await api.post(`/interviews/${sessionId}/rubric-feedback`, rubric);
  return data;
}

// ─── Student Mentorship Directory & Booking Endpoints ─────────────────────────

export async function fetchMentors(params?: {
  company?: string;
  expertise?: string;
  search?: string;
  weakness_tags?: string;
}): Promise<{ mentors: any[]; total: number }> {
  const { data } = await api.get("/mentorship/mentors", { params });
  return data;
}

export async function fetchMentorDetail(
  mentorId: string
): Promise<{ mentor: MentorProfile; slots: MentorSlot[] }> {
  const { data } = await api.get(`/mentorship/mentors/${mentorId}`);
  return data;
}

export async function bookMentorSlot(payload: {
  mentor_id: string;
  slot_id: string;
  topic?: string;
  target_role?: string;
  target_company?: string;
  student_notes?: string;
}): Promise<{
  message: string;
  booking_id: string;
  scheduled_at: string;
  mentor_name: string;
  meeting_url: string;
}> {
  const { data } = await api.post("/mentorship/book", payload);
  return data;
}

export async function fetchMyMentorshipBookings(): Promise<{
  bookings: MentorshipBooking[];
  total: number;
}> {
  const { data } = await api.get("/mentorship/my-bookings");
  return data;
}

export async function reviewMentorSession(
  bookingId: string,
  payload: { student_rating: number; student_review?: string }
): Promise<{ message: string }> {
  const { data } = await api.post(`/mentorship/bookings/${bookingId}/review`, payload);
  return data;
}

// ─── Mentor Portal Endpoints (Authenticated Mentor) ──────────────────────────

export async function fetchMyMentorProfile(): Promise<{
  profile: MentorProfile;
  slots: MentorSlot[];
  is_complete: boolean;
}> {
  const { data } = await api.get("/mentorship/profile/me");
  return data;
}

export async function saveMentorProfile(payload: {
  full_name?: string;
  profile_photo?: string;
  headline?: string;
  bio?: string;
  expertise?: string[];
  skills?: string[];
  experience_years?: number;
  current_role?: string;
  company?: string;
  education?: string;
  languages?: string[];
  mentoring_topics?: string[];
  profile_status?: "INCOMPLETE" | "ACTIVE" | "INACTIVE";
}): Promise<{ message: string; profile: MentorProfile; profile_status: string }> {
  const { data } = await api.post("/mentorship/profile", payload);
  return data;
}

export async function createAvailabilitySlot(payload: {
  available_day?: string;
  start_time: string;
  end_time?: string;
  duration_mins?: number;
  is_enabled?: boolean;
}): Promise<{ message: string; slot: MentorSlot }> {
  const { data } = await api.post("/mentorship/slots", payload);
  return data;
}

export async function updateAvailabilitySlot(
  slotId: string,
  payload: {
    available_day?: string;
    start_time?: string;
    end_time?: string;
    duration_mins?: number;
    is_enabled?: boolean;
  }
): Promise<{ message: string; slot: MentorSlot }> {
  const { data } = await api.put(`/mentorship/slots/${slotId}`, payload);
  return data;
}

export async function toggleAvailabilitySlot(
  slotId: string
): Promise<{ message: string; is_enabled: boolean }> {
  const { data } = await api.patch(`/mentorship/slots/${slotId}/toggle`);
  return data;
}

export async function deleteAvailabilitySlot(slotId: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/mentorship/slots/${slotId}`);
  return data;
}

export async function fetchMentorBookings(): Promise<{
  bookings: MentorshipBooking[];
  total: number;
}> {
  const { data } = await api.get("/mentorship/bookings/mentor");
  return data;
}

export async function submitMentorFeedback(
  bookingId: string,
  payload: {
    overall_score: number;
    mentor_feedback: string;
    rubric?: DetailedRubric;
    recording_url?: string;
  }
): Promise<{ message: string; booking_id: string; overall_score: number }> {
  const { data } = await api.post(`/mentorship/bookings/${bookingId}/feedback`, payload);
  return data;
}

// ─── Company Portal Interview Endpoints ──────────────────────────────────────

export interface CompanyInterviewSession {
  session_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_college: string;
  target_role: string | null;
  interview_type: string;
  scheduled_at: string | null;
  duration_mins: number;
  interviewer_name?: string | null;
  video_call_url?: string | null;
  status: string;
  overall_score?: number | null;
  feedback?: string | null;
  rubric?: DetailedRubric | null;
  recording_url?: string | null;
  storage_key?: string | null;
  mime_type?: string | null;
  recording_duration_sec?: number | null;
  recording_file_size?: number | null;
  recorded_at?: string | null;
  recording_status?: string | null;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  created_at: string;
  ended_at?: string | null;
}

export interface ScheduleInterviewPayload {
  student_id: string;
  interview_type: string;
  scheduled_at: string;
  duration_mins?: number;
  interviewer_name?: string;
  video_call_url?: string;
  proctoring_enabled?: boolean;
}

export async function scheduleCompanyInterview(
  payload: ScheduleInterviewPayload
): Promise<{ message: string; session_id: string }> {
  const { data } = await api.post("/companies/me/interviews/schedule", payload);
  return data;
}

export async function getCompanyInterviews(): Promise<{
  sessions: CompanyInterviewSession[];
  total: number;
}> {
  const { data } = await api.get("/companies/me/interviews");
  return data;
}

export async function evaluateCompanyInterview(
  sessionId: string,
  payload: {
    overall_score: number;
    feedback: string;
    rubric?: DetailedRubric;
  }
): Promise<{
  message: string;
  session_id: string;
  overall_score: number;
  rubric?: DetailedRubric;
}> {
  const { data } = await api.post(`/companies/me/interviews/${sessionId}/evaluate`, payload);
  return data;
}

// ─── Real Interviewer Account & Evaluation Endpoints ─────────────────────────

export interface AssignedInterviewSession {
  session_id: string;
  student_id: string;
  student_name: string;
  student_college: string;
  student_email: string;
  interview_type: string;
  mode: string;
  company_name: string;
  duration_mins: number;
  status: string;
  review_status: "unassigned" | "assigned" | "review_in_progress" | "reviewed";
  recording_url?: string | null;
  recording_duration_sec?: number | null;
  recording_file_size?: number | null;
  assigned_at?: string | null;
  reviewed_at?: string | null;
  overall_score?: number | null;
  interviewer_feedback?: string | null;
  rubric?: DetailedRubric | null;
  transcript?: string | null;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  created_at: string;
}

export async function fetchInterviewerInterviews(): Promise<{
  assigned: AssignedInterviewSession[];
  pending: AssignedInterviewSession[];
  completed: AssignedInterviewSession[];
  total: number;
  interviewer: { id: string; name?: string; email?: string };
}> {
  const { data } = await api.get("/interviewer/interviews");
  return data;
}

export async function fetchInterviewerSessionDetail(sessionId: string): Promise<{
  session: InterviewSession;
  candidate: {
    name: string;
    email: string;
    college: string;
    phone?: string;
    target_roles?: string[];
  };
}> {
  const { data } = await api.get(`/interviewer/interviews/${sessionId}`);
  return data;
}

export async function submitInterviewerReview(
  sessionId: string,
  payload: {
    overall_score: number;
    feedback: string;
    rubric?: DetailedRubric;
  }
): Promise<{
  message: string;
  session_id: string;
  review_status: string;
  overall_score: number;
  reviewed_at: string;
}> {
  const { data } = await api.post(`/interviewer/interviews/${sessionId}/review`, payload);
  return data;
}

// ─── Admin Interviewer Management & Assignment Endpoints ─────────────────────

export async function fetchAdminInterviewers(): Promise<{
  interviewers: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    created_at?: string;
  }>;
  total: number;
}> {
  const { data } = await api.get("/admin/interviewers");
  return data;
}

export async function createAdminInterviewer(payload: {
  full_name: string;
  email: string;
  password: string;
}): Promise<{
  message: string;
  interviewer_id: string;
  email: string;
  full_name: string;
}> {
  const { data } = await api.post("/admin/interviewers", payload);
  return data;
}

export async function fetchAdminAssignableInterviews(): Promise<{
  interviews: Array<{
    session_id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    student_college: string;
    interview_type: string;
    mode: string;
    duration_mins: number;
    status: string;
    review_status: string;
    assigned_interviewer_id?: string;
    assigned_interviewer_name?: string;
    assigned_at?: string;
    recording_url?: string;
    created_at: string;
  }>;
  total: number;
}> {
  const { data } = await api.get("/admin/interviews/assignable");
  return data;
}

export async function assignInterviewToInterviewer(
  sessionId: string,
  interviewerId: string
): Promise<{
  message: string;
  session_id: string;
  assigned_interviewer_id: string;
  assigned_interviewer_name: string;
  review_status: string;
  assigned_at: string;
}> {
  const { data } = await api.post(`/admin/interviews/${sessionId}/assign`, {
    interviewer_id: interviewerId,
  });
  return data;
}

// ─── REAL TEAM & COMPANY CANDIDATE FEEDBACK SYSTEM ──────────────────────────

export interface FeedbackScores {
  communication: number;
  technical_knowledge: number;
  confidence: number;
  problem_solving: number;
  answer_quality: number;
  professionalism: number;
}

export interface InterviewFeedbackData {
  feedback_id: string;
  interview_id: string;
  student_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  scores: FeedbackScores;
  overall_score: number;
  strengths: string;
  improvements: string;
  recommendations: string;
  detailed_feedback: string;
  status: "PENDING" | "SUBMITTED";
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
}

export async function submitInterviewTeamFeedback(
  sessionId: string,
  payload: {
    scores: FeedbackScores;
    strengths: string;
    improvements: string;
    recommendations: string;
    detailed_feedback: string;
  }
): Promise<{
  message: string;
  feedback_id: string;
  session_id: string;
  overall_score: number;
  status: string;
  submitted_at: string;
}> {
  const { data } = await api.post(`/interviews/${sessionId}/feedback`, payload);
  return data;
}

export async function fetchInterviewFeedback(sessionId: string): Promise<{
  status: "PENDING" | "SUBMITTED";
  message?: string;
  feedback?: InterviewFeedbackData;
  recording_url?: string | null;
}> {
  const { data } = await api.get(`/interviews/${sessionId}/feedback`);
  return data;
}

// ─── REAL VIDEO REVIEW & TIMESTAMPED FEEDBACK ───────────────────────────────

export type TimestampCategory =
  | "Communication"
  | "Technical"
  | "Confidence"
  | "Problem Solving"
  | "Answer Quality"
  | "Body Language"
  | "Positive"
  | "Improvement";

export interface InterviewTimestampFeedbackItem {
  feedback_id: string;
  interview_id: string;
  student_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  timestamp_seconds: number;
  formatted_timestamp: string;
  category: TimestampCategory;
  comment: string;
  created_at: string;
}

export async function addInterviewTimestampFeedback(
  sessionId: string,
  payload: {
    timestamp_seconds: number;
    category: TimestampCategory;
    comment: string;
  }
): Promise<{
  message: string;
  feedback_id: string;
  interview_id: string;
  timestamp_seconds: number;
  formatted_timestamp: string;
  category: TimestampCategory;
  comment: string;
  reviewer_name: string;
  created_at: string;
}> {
  const { data } = await api.post(`/interviews/${sessionId}/timestamps`, payload);
  return data;
}

export async function fetchInterviewTimestampFeedbacks(
  sessionId: string
): Promise<{
  interview_id: string;
  total: number;
  timestamps: InterviewTimestampFeedbackItem[];
}> {
  const { data } = await api.get(`/interviews/${sessionId}/timestamps`);
  return data;
}

export async function deleteInterviewTimestampFeedback(
  sessionId: string,
  feedbackId: string
): Promise<{ message: string; feedback_id: string }> {
  const { data } = await api.delete(`/interviews/${sessionId}/timestamps/${feedbackId}`);
  return data;
}



