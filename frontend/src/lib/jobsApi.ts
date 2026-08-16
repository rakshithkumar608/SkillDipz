import api from "@/lib/api";
import type {
  JobListResponse,
  JobDetail,
  ApplyJobResponse,
  JobFilters,
  JobFiltersOptions,
} from "@/types/jobs";

/**
 * Fetch paginated job listings matched to student's profile.
 */
export const getJobs = async (
  filters: Partial<JobFilters> = {}
): Promise<JobListResponse> => {
  const params: Record<string, string | number> = {};
  if (filters.page) params.page = filters.page;
  if (filters.page_size) params.page_size = filters.page_size;
  if (filters.sort) params.sort = filters.sort;
  // Send role/location/work_mode even if empty string (means "All")
  if (filters.role !== undefined) params.role = filters.role;
  if (filters.location !== undefined && filters.location !== "") params.location = filters.location;
  if (filters.work_mode !== undefined && filters.work_mode !== "") params.work_mode = filters.work_mode;
  if (filters.show) params.show = filters.show;

  const { data } = await api.get<JobListResponse>("/jobs", { params });
  return data;
};

/**
 * Fetch full details for a single job posting.
 */
export const getJobDetail = async (jobId: string): Promise<JobDetail> => {
  const { data } = await api.get<JobDetail>(`/jobs/${jobId}`);
  return data;
};

/**
 * Apply to a job posting.
 */
export const applyToJob = async (
  jobId: string
): Promise<ApplyJobResponse> => {
  const { data } = await api.post<ApplyJobResponse>(`/jobs/${jobId}/apply`);
  return data;
};

/**
 * Fetch available filter options (roles, locations, work_modes) from real DB data.
 */
export const getJobFilters = async (): Promise<JobFiltersOptions> => {
  const { data } = await api.get<JobFiltersOptions>("/jobs/filters");
  return data;
};
