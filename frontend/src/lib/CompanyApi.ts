import {
  BrowseCandidate,
  BrowseHints,
  CandidateDetail,
  CompanyDashboard,
} from "@/store/companyStore";
import api from "./api";

// ── Employer Dashboard ────────────────────────────────────────────────────────

export async function fetchCompanyDashboard(limit = 10): Promise<CompanyDashboard> {
  const { data } = await api.get<CompanyDashboard>("/companies/me/dashboard", {
    params: { limit },
  });
  return data;
}

// ── Candidate Detail (company-targeted talent pool) ───────────────────────────

export async function fetchCandidateDetail(student_id: string): Promise<CandidateDetail> {
  const { data } = await api.get<CandidateDetail>(
    `/companies/me/candidates/${student_id}`
  );
  return data;
}

// ── Browse Candidates ─────────────────────────────────────────────────────────

export interface BrowseParams {
  role?: string;
  min_score?: number;
  min_projects?: number;
  search?: string;
  sort_by?: "score" | "projects" | "tests";
  page?: number;
  per_page?: number;
}

export interface BrowseResponse {
  candidates: BrowseCandidate[];
  total: number;
  page: number;
  total_pages: number;
}

export async function fetchBrowseCandidates(params: BrowseParams): Promise<BrowseResponse> {
  const clean: Record<string, string | number> = {};
  if (params.role) clean.role = params.role;
  if (params.min_score !== undefined && params.min_score > 0) clean.min_score = params.min_score;
  if (params.min_projects !== undefined && params.min_projects > 0) clean.min_projects = params.min_projects;
  if (params.search) clean.search = params.search;
  if (params.sort_by) clean.sort_by = params.sort_by;
  if (params.page) clean.page = params.page;
  if (params.per_page) clean.per_page = params.per_page;

  const { data } = await api.get<BrowseResponse>("/companies/me/browse", {
    params: clean,
  });
  return data;
}

//  Browse Hints (Autocomplete) 

export async function fetchBrowseHints(q: string): Promise<BrowseHints> {
  const { data } = await api.get<BrowseHints>("/companies/me/browse/hints", {
    params: { q },
  });
  return data;
}

//  Browse Distinct Roles 

export async function fetchBrowseRoles(): Promise<string[]> {
  const { data } = await api.get<string[]>("/companies/me/browse/roles");
  return data;
}

//  Browse Candidate Detail (All students) 

export async function fetchBrowseCandidateDetail(student_id: string): Promise<CandidateDetail> {
  const { data } = await api.get<CandidateDetail>(
    `/companies/me/browse/${student_id}`
  );
  return data;
}

// ── Company Projects ──────────────────────────────────────────────────────────

export interface CompanyProject {
  project_id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  deadline_days: number;
  required_skills: string[];
  target_roles: string[];
  deliverables: string[];
  resources: { name: string; url: string }[];
  project_idea?: string | null;
  architecture_overview?: string | null;
  spec_document_url?: string | null;
  spec_document_name?: string | null;
  visibility: string;
  is_active: boolean;
  created_at: string;
  submission_count: number;
  acceptance_count: number;
}

export interface CompanySubmission {
  submission_id: string;
  student_id: string;
  student_name: string;
  github_url: string;
  demo_url: string | null;
  deployment_url: string | null;
  what_i_learned: string | null;
  notes: string | null;
  submitted_at: string;
  evaluation_status: string;
  nlp_score: number | null;
  verified_skills: string[];
  is_group: boolean;
  group_name: string | null;
  group_members: { student_id: string; name: string }[];
}

export interface CreateProjectPayload {
  title: string;
  description: string;
  project_idea?: string;
  architecture_overview?: string;
  spec_document_url?: string;
  spec_document_name?: string;
  target_roles: string[];
  required_skills: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  deliverables: string[];
  deadline_days: number;
  visibility: "all_students" | "shortlisted_only";
  resources: { name: string; url: string }[];
}

export async function fetchCompanyProjects(): Promise<CompanyProject[]> {
  const { data } = await api.get<CompanyProject[]>("/projects/company");
  return data;
}

export async function uploadProjectSpec(
  file: File
): Promise<{ url: string; filename: string; size_bytes: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/projects/company/upload-spec", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function createCompanyProject(
  payload: CreateProjectPayload
): Promise<{ message: string; project_id: string }> {
  const { data } = await api.post("/projects/company", payload);
  return data;
}

export async function fetchProjectSubmissions(
  projectId: string
): Promise<CompanySubmission[]> {
  const { data } = await api.get<CompanySubmission[]>(
    `/projects/company/${projectId}/submissions`
  );
  return data;
}