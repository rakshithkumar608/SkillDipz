export type EligibilityStatus =
  | "eligible"
  | "not_yet"
  | "skill_gap"
  | "full_match";

export interface InterviewRound {
  order: number;
  name: string;
  description?: string;
  duration_mins?: number;
}

export interface MatchedCompany {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  website?: string;
  headquarters?: string;
  min_score: number;
  your_score: number;
  eligible: boolean;
  eligibility_status: EligibilityStatus;
  skill_match_pct: number;
  score_readiness_pct: number;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  interview_rounds: InterviewRound[];
  active_openings: number;
  match_rank: number;
  selected_by: "student" | "auto_suggested";
  last_recomputed_at?: string;
}

export interface NotYetEligibleCompany {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  min_score: number;
  your_score: number;
  score_gap: number;
  missing_skills: string[];
  active_openings: number;
}

export interface TargetCompaniesResponse {
  student_score: number;
  student_role: string;
  selected_companies: MatchedCompany[];
  auto_suggested: MatchedCompany[];
  companies_not_yet_eligible: NotYetEligibleCompany[];
  last_updated_at?: string;
}

export interface SelectCompanyResponse {
  message: string;
  company_id: string;
  match_result: MatchedCompany;
}

export interface CompanyProfileDetail {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  website?: string;
  headquarters?: string;
  description?: string;
  required_roles: string[];
  must_have_skills: string[];
  nice_to_have_skills: string[];
  min_score: number;
  interview_rounds: InterviewRound[];
  interview_tips?: string;
  active_openings: number;
  is_verified: boolean;
}

export interface VerifiedCompany {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  headquarters?: string;
  required_roles: string[];
  must_have_skills: string[];
  min_score: number;
  active_openings: number;
}