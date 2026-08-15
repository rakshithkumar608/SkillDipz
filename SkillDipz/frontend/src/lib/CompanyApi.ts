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

// ── Browse Hints (Autocomplete) ──────────────────────────────────────────────

export async function fetchBrowseHints(q: string): Promise<BrowseHints> {
  const { data } = await api.get<BrowseHints>("/companies/me/browse/hints", {
    params: { q },
  });
  return data;
}

// ── Browse Candidate Detail (All students) ────────────────────────────────────

export async function fetchBrowseCandidateDetail(student_id: string): Promise<CandidateDetail> {
  const { data } = await api.get<CandidateDetail>(
    `/companies/me/browse/${student_id}`
  );
  return data;
}