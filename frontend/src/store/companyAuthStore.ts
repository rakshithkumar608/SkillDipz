import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CompanyUser {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  email_domain: string;
  industry?: string | null;
  email_verified: boolean;
  approval_status: "pending" | "approved" | "rejected";
  approval_note?: string | null;
  gstin_or_cin?: string | null;
  linkedin_company_url?: string | null;
  company_website?: string | null;
  company_size?: string | null;
  created_at: string;
}

interface CompanyAuthState {
  company: CompanyUser | null;
  isLoading: boolean;
  _hasHydrated: boolean;
  setCompany: (company: CompanyUser | null) => void;
  clearCompany: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useCompanyAuthStore = create<CompanyAuthState>()(
  persist(
    (set) => ({
      company: null,
      isLoading: false,
      _hasHydrated: false,
      setCompany: (company) => set({ company }),
      clearCompany: () => set({ company: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "skilldipz-company-auth",
      partialize: (state) => ({
        company: state.company,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
