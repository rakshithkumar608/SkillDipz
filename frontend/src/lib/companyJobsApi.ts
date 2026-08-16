import api from "./api";
import {
  CompanyJob,
  CompanyJobListResponse,
  CreateJobPayload,
  JobApplicantsResponse,
  UpdateApplicantStatusPayload,
} from "@/types/companyJobs";

/**
 * Fetch all job vacancies posted by the authenticated company.
 */
export async function fetchCompanyJobs(): Promise<CompanyJobListResponse> {
  const { data } = await api.get<CompanyJobListResponse>("/companies/me/jobs");
  return data;
}

/**
 * Post a new job vacancy from the company portal.
 */
export async function createCompanyJob(
  payload: CreateJobPayload
): Promise<{ message: string; job_id: string; job: CompanyJob }> {
  const { data } = await api.post<{
    message: string;
    job_id: string;
    job: CompanyJob;
  }>("/companies/me/jobs", payload);
  return data;
}

/**
 * Fetch live engineering tracks registered on the platform.
 */
export async function fetchJobTracks(): Promise<string[]> {
  const { data } = await api.get<string[]>("/companies/me/jobs/tracks");
  return data;
}

/**
 * Fetch real-time student applicants for a specific job posting.
 */
export async function fetchJobApplicants(
  jobId: string
): Promise<JobApplicantsResponse> {
  const { data } = await api.get<JobApplicantsResponse>(
    `/companies/me/jobs/${jobId}/applicants`
  );
  return data;
}

/**
 * Update the application status of a candidate (Applied, Shortlisted, Interviewed, Offered, Rejected).
 */
export async function updateApplicantStatus(
  jobId: string,
  applicationId: string,
  status: UpdateApplicantStatusPayload["status"]
): Promise<{ message: string; application_id: string; status: string }> {
  const { data } = await api.patch<{
    message: string;
    application_id: string;
    status: string;
  }>(`/companies/me/jobs/${jobId}/applicants/${applicationId}/status`, {
    status,
  });
  return data;
}

/**
 * Close/archive a job listing.
 */
export async function closeCompanyJob(
  jobId: string
): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(
    `/companies/me/jobs/${jobId}`
  );
  return data;
}
