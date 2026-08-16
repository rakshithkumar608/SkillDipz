export interface CompanyJob {
  job_id: string;
  company_id: string;
  company_name: string;
  title: string;
  role_id: string;
  description?: string;
  min_score: number;
  location?: string;
  work_mode?: string;
  ctc_range?: string;
  experience?: string;
  required_skills: string[];
  nice_to_have: string[];
  deadline?: string;
  openings_count: number;
  status: "ACTIVE" | "CLOSED" | string;
  created_at: string;
  applications_count: number;
}

export interface CompanyJobListResponse {
  jobs: CompanyJob[];
  total: number;
}

export interface JobApplicant {
  application_id: string;
  student_id: string;
  name: string;
  avatar_initials: string;
  email: string;
  phone?: string | null;
  college?: string | null;
  branch?: string | null;
  grad_year?: number | null;
  target_role?: string | null;
  skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  overall_score: number;
  profile_match_pct: number;
  status: "Applied" | "Shortlisted" | "Interviewed" | "Offered" | "Rejected" | string;
  applied_at: string;
  tests_completed: number;
  projects_completed: number;
  github?: string | null;
  linkedin?: string | null;
}

export interface JobApplicantsResponse {
  job: CompanyJob;
  applicants: JobApplicant[];
  total: number;
}

export interface CreateJobPayload {
  title: string;
  role_id: string;
  description?: string;
  min_score: number;
  location?: string;
  work_mode?: string;
  ctc_range?: string;
  experience?: string;
  required_skills?: string[];
  nice_to_have?: string[];
  deadline?: string;
  openings_count?: number;
}

export interface UpdateApplicantStatusPayload {
  status: "Applied" | "Shortlisted" | "Interviewed" | "Offered" | "Rejected";
}
