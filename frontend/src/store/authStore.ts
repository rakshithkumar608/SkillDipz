import { create } from "zustand";
import { persist } from "zustand/middleware";


export type UserRole = "STUDENT" | "COMPANY" | "MENTOR" | "INTERVIEWER" | "ADMIN";

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
    avatar_url?: string;
    target_role?: string;
    is_verified: boolean;
    company_name?: string;
    industry?: string;
}

interface AuthState {
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    isLoading: boolean;
    _hasHydrated: boolean;                                       // true once localStorage has been read
    setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
    clearAuth: () => void;
    setLoading: (v: boolean) => void;
    setHasHydrated: (v: boolean) => void;
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      _hasHydrated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "skilldipz-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      // Called once localStorage has been read and state restored
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
)
);