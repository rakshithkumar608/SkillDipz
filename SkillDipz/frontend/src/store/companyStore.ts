import { create } from "zustand";


export interface TalentCard{
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
}


//  Store

interface CompanyState {
    dashboard: CompanyDashboard | null;
    selectedCandidate: CandidateDetail | null;
    candidateLoading: boolean;
    isLoading: boolean;
    error: string | null;

    setDashboard: (d: CompanyDashboard) => void;
    setSelectedCandidate: (c: CandidateDetail | null) => void;
    setCandidateLoading: (v:boolean) => void;
    setLoading: (v:boolean) => void;
    setError: (e:string | null) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  dashboard:          null,
  selectedCandidate:  null,
  candidateLoading:   false,
  isLoading:          false,
  error:              null,

  setDashboard:          (dashboard)          => set({ dashboard }),
  setSelectedCandidate:  (selectedCandidate)  => set({ selectedCandidate }),
  setCandidateLoading:   (candidateLoading)   => set({ candidateLoading }),
  setLoading:            (isLoading)          => set({ isLoading }),
  setError:              (error)              => set({ error }),
}));