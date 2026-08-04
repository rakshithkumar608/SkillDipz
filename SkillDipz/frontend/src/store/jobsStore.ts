import { create } from "zustand";
import type { JobFilters } from "@/types/jobs";

interface JobsState {
  filters: JobFilters;
  setFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void;
  resetFilters: (studentRole?: string) => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  filters: {
    page: 1,
    page_size: 12,
    sort: "match_score",
    role: "",
    location: "",
    work_mode: "",
    show: "all",
  },

  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
        // Reset to page 1 when any filter changes (except page itself)
        ...(key !== "page" ? { page: 1 } : {}),
      },
    })),

  resetFilters: (studentRole?: string) =>
    set({
      filters: {
        page: 1,
        page_size: 12,
        sort: "match_score",
        role: studentRole || "",
        location: "",
        work_mode: "",
        show: "all",
      },
    }),
}));
