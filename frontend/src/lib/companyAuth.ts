import api from "./api";
import { CompanyUser, useCompanyAuthStore } from "@/store/companyAuthStore";

export type { CompanyUser };

export interface CompanySignupPayload {
  company_name: string;
  contact_name: string;
  email: string;
  password: string;
  industry: string;
  gstin_or_cin: string;
  linkedin_company_url: string;
  company_website?: string;
  company_size?: "1-10" | "11-50" | "51-200" | "200+";
}

export interface CompanyLoginPayload {
  email: string;
  password: string;
}

export interface CompanyAuthResponse {
  company: CompanyUser;
  message: string;
}

export interface CompanyMeResponse {
  company: CompanyUser;
  session_valid: boolean;
}

export interface VerifyEmailResponse {
  message: string;
  approval_status: "pending" | "approved" | "rejected";
  redirect: string;
}

// Cookie helper (middleware reads sd_role to protect routes)
export function setCompanyRoleCookie(role: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `sd_role=${role}; path=/; SameSite=Lax; max-age=${30 * 24 * 3600}`;
}

export function clearCompanyRoleCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `sd_role=; path=/; max-age=0`;
}

/**
 * Company Signup — Submits Step 1 and Step 2 and returns company record
 */
export async function signupCompany(payload: CompanySignupPayload): Promise<{ message: string; company?: CompanyUser }> {
  const { data } = await api.post<{ message: string; company?: CompanyUser }>("/company/auth/signup", payload);
  if (data.company) {
    useCompanyAuthStore.getState().setCompany(data.company);
    setCompanyRoleCookie("COMPANY");
  }
  return data;
}

/**
 * Company Login — Session-based with HttpOnly Cookie (sdz.company.sid)
 */
export async function loginCompany(payload: CompanyLoginPayload): Promise<CompanyAuthResponse> {
  const { data } = await api.post<CompanyAuthResponse>("/company/auth/login", payload);
  useCompanyAuthStore.getState().setCompany(data.company);
  setCompanyRoleCookie("COMPANY");
  return data;
}

/**
 * Company Logout — Destroys server-side session in Redis and clears HttpOnly cookie
 */
export async function logoutCompany(): Promise<void> {
  try {
    await api.post("/company/auth/logout");
  } catch (err) {
    console.error("Company logout error:", err);
  } finally {
    useCompanyAuthStore.getState().clearCompany();
    clearCompanyRoleCookie();
  }
}

/**
 * Get current authenticated company (session-based)
 */
export async function getCompanyMe(): Promise<CompanyMeResponse> {
  const { data } = await api.get<CompanyMeResponse>("/company/auth/me");
  useCompanyAuthStore.getState().setCompany(data.company);
  return data;
}

/**
 * Verify Email with raw token from email link
 */
export async function verifyCompanyEmail(token: string): Promise<VerifyEmailResponse> {
  const { data } = await api.get<VerifyEmailResponse>(`/company/auth/verify-email?token=${encodeURIComponent(token)}`);
  return data;
}

/**
 * Resend verification link
 */
export async function resendCompanyVerification(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/company/auth/resend-verification", { email });
  return data;
}

// ── Admin Approval API helpers ────────────────────────────────────────────────

export async function getAllCompanies(status?: string): Promise<CompanyUser[]> {
  const url = status && status !== "all" ? `/admin/companies?status=${encodeURIComponent(status)}` : "/admin/companies";
  const { data } = await api.get<CompanyUser[]>(url);
  return data;
}

export async function getPendingCompanies(): Promise<CompanyUser[]> {
  const { data } = await api.get<CompanyUser[]>("/admin/companies/pending");
  return data;
}

export async function approveCompany(companyId: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/admin/companies/${companyId}/approve`);
  return data;
}

export async function rejectCompany(companyId: string, approval_note?: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/admin/companies/${companyId}/reject`, {
    approval_note,
  });
  return data;
}
