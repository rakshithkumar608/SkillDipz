import { create } from "zustand";

export interface TalentCard {
  student_id: string;
  name: string;
  avatar_initials: string;
  college: string | null;
  target_role: string | null;
  skills: string[];
  ai_skill_fit_pct: number;
}

export interface DashboardStats {
  active_students_on_platform: number;
  verified_skilled_developers: number;
  partner_hiring_corporates: number;
  average_recruitment_time_saved_pct: number;
}

export interface CompanyDashboard {
  stats: DashboardStats;
  outstanding_talent_pools: TalentCard[];
  company_name: string;
  company_logo_emoji: string | null;
  company_logo_url: string | null;
  company_id: string;
}

export interface CandidateDetail {
  student_id: string;
  name: string;
  avatar_initials: string;
  email: string;
  college: string | null;
  branch: string | null;
  target_role: string | null;
  skills: string[];
  ai_skill_fit_pct: number;
  matched_skills: string[];
  missing_skills: string[];
  phone: string | null;
  github: string | null;
  linkedin: string | null;
  overall_score: number;
  tests_completed?: number;
  projects_completed?: number;
  skill_index_pct?: number;
}

//  Browse Candidate Types 

export interface BrowseCandidate {
  student_id: string;
  name: string;
  avatar_initials: string;
  email?: string | null;
  phone?: string | null;
  college: string | null;
  branch?: string | null;
  grad_year?: number | null;
  skills: string[];
  additional_skills_count: number;
  skill_index_pct: number;
  tests_completed: number;
  projects_completed: number;
  target_role: string | null;
  matched_domain?: string | null;
  target_company?: string | null;
}

export interface BrowseHints {
  names: string[];
  colleges: string[];
  skills: string[];
  roles?: string[];
}

export interface BrowseFilters {
  role: string;
  minScore: number;
  minProjects: number;
  search: string;
  sortBy: "score" | "projects" | "tests";
  page: number;
}

//  Store State 
interface CompanyState {
  // Employer Dashboard
  dashboard: CompanyDashboard | null;
  selectedCandidate: CandidateDetail | null;
  candidateLoading: boolean;
  isLoading: boolean;
  error: string | null;

  setDashboard: (d: CompanyDashboard) => void;
  setSelectedCandidate: (c: CandidateDetail | null) => void;
  setCandidateLoading: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;

  // Browse Candidates
  browseCandidates: BrowseCandidate[];
  browseTotal: number;
  browseTotalPages: number;
  browseLoading: boolean;
  browseError: string | null;
  browseHints: BrowseHints;
  hintsLoading: boolean;
  browseFilters: BrowseFilters;

  setBrowseResults: (candidates: BrowseCandidate[], total: number, totalPages: number) => void;
  setBrowseLoading: (v: boolean) => void;
  setBrowseError: (e: string | null) => void;
  setBrowseHints: (hints: BrowseHints) => void;
  setHintsLoading: (v: boolean) => void;
  setBrowseFilters: (filters: Partial<BrowseFilters>) => void;
  resetBrowseFilters: () => void;
}

const DEFAULT_FILTERS: BrowseFilters = {
  role: "",
  minScore: 0,
  minProjects: 0,
  search: "",
  sortBy: "score",
  page: 1,
};

export const useCompanyStore = create<CompanyState>((set) => ({
  dashboard: null,
  selectedCandidate: null,
  candidateLoading: false,
  isLoading: false,
  error: null,

  setDashboard: (dashboard) => set({ dashboard }),
  setSelectedCandidate: (selectedCandidate) => set({ selectedCandidate }),
  setCandidateLoading: (candidateLoading) => set({ candidateLoading }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Browse Candidates
  browseCandidates: [],
  browseTotal: 0,
  browseTotalPages: 1,
  browseLoading: false,
  browseError: null,
  browseHints: { names: [], colleges: [], skills: [] },
  hintsLoading: false,
  browseFilters: DEFAULT_FILTERS,

  setBrowseResults: (candidates, total, totalPages) =>
    set({
      browseCandidates: Array.isArray(candidates) ? candidates : [],
      browseTotal: typeof total === "number" ? total : 0,
      browseTotalPages: typeof totalPages === "number" ? Math.max(1, totalPages) : 1,
    }),
  setBrowseLoading: (browseLoading) => set({ browseLoading }),
  setBrowseError: (browseError) => set({ browseError }),
  setBrowseHints: (browseHints) =>
    set({
      browseHints: browseHints ?? { names: [], colleges: [], skills: [] },
    }),
  setHintsLoading: (hintsLoading) => set({ hintsLoading }),
  setBrowseFilters: (filters) =>
    set((state) => ({ browseFilters: { ...state.browseFilters, ...filters } })),
  resetBrowseFilters: () => set({ browseFilters: DEFAULT_FILTERS }),
}));