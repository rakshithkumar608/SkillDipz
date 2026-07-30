import api from "@/lib/api";
import { CompanyProfileDetail, SelectCompanyResponse, TargetCompaniesResponse, VerifiedCompany } from "@/types/targetCompany";


/**
 * Fetch all matched and selected companies for the current student.
 * Served from Redis cache (30 min TTL) — refreshed on score/profile update.
 */
export const getTargetCompanies = async (refresh?: boolean): Promise<TargetCompaniesResponse> => {
  const { data } = await api.get<TargetCompaniesResponse>(
    "/students/me/target-companies",
    refresh ? { params: { refresh: true } } : undefined
  );
  return data;
};

/**
 * Student explicitly selects a company to target.
 * Backend immediately runs resume match and returns result.
 */
export const selectTargetCompany = async (
  company_id: string
): Promise<SelectCompanyResponse> => {
  const { data } = await api.post<SelectCompanyResponse>(
    "/students/me/target-companies/select",
    { company_id }
  );
  return data;
};

/**
 * Remove a company from the student's target list.
 */
export const unselectTargetCompany = async (company_id: string): Promise<void> => {
  await api.delete(`/students/me/target-companies/${company_id}`);
};

/**
 * Full company profile: description, required skills, interview rounds, tips.
 */
export const getCompanyProfile = async (
  company_id: string
): Promise<CompanyProfileDetail> => {
  const { data } = await api.get<CompanyProfileDetail>(
    `/companies/${company_id}/profile`
  );
  return data;
};

/**
 * List all verified companies on the platform (for student to browse and select).
 */
export const listVerifiedCompanies = async (
  role?: string
): Promise<VerifiedCompany[]> => {
  const params = role ? { role } : {};
  const { data } = await api.get<VerifiedCompany[]>("/companies", { params });
  return data;
};