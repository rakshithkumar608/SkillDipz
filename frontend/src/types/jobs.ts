export interface JobCard {
  job_id: string;
  company_id: string;
  company_name: string;
  company_logo_emoji?: string;
  company_logo_url?: string;
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
  posted_at?: string;
  profile_match_pct: number;
  eligible: boolean;
  matched_skills: string[];
  missing_skills: string[];
  already_applied: boolean;
}

export interface JobListResponse {
  jobs: JobCard[];
  total: number;
  page: number;
  page_size: number;
  student_score: number;
  student_role: string;
}

export interface JobDetail {
  job_id: string;
  company_id: string;
  company_name: string;
  company_logo_emoji?: string;
  company_logo_url?: string;
  company_industry?: string;
  company_description?: string;
  company_headquarters?: string;
  company_website?: string;
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
  posted_at?: string;
  profile_match_pct: number;
  eligible: boolean;
  matched_skills: string[];
  missing_skills: string[];
  already_applied: boolean;
  score_gap: number;
}

export interface ApplyJobResponse {
  message: string;
  application_id: string;
  status: string;
}

export interface JobFilters {
  page: number;
  page_size: number;
  sort: "match_score" | "newest" | "highest_ctc";
  role: string;
  location: string;
  work_mode: string;
  show: "all" | "eligible" | "applied";
}

export interface JobFiltersOptions {
  roles: string[];
  locations: string[];
  work_modes: string[];
}
