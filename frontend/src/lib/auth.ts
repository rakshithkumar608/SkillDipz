import { AuthUser, UserRole, useAuthStore } from "@/store/authStore";
import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
  role?: UserRole;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  college?: string;
  company_name?: string;
  industry?: string;
  consent_data_processing: boolean;
  consent_marketing?: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  needs_verification?: boolean;
}


// Cookie helper (middleware reads sd_role to protect routes)

export function setRoleCookie(role: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `sd_role=${role}; path=/; SameSite=Lax; max-age=${30 * 24 * 3600}`;
}

export function clearRoleCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `sd_role=; path=/; max-age=0`;
}

//  Auth functions

export async function loginWithCredentials(
  payload: LoginPayload,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  // Store user + tokens in Zustand for UI + Bearer header
  useAuthStore
    .getState()
    .setAuth(data.user, data.access_token, data.refresh_token);
    setRoleCookie(data.user.role);
    // HttpOnly cookie is set by the backend — browser handles it automatically
  return data;
}

export async function loginWithGoogle(
  googleIdToken: string,
  role?: "STUDENT" | "COMPANY" | "MENTOR",
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/google", {
    id_token: googleIdToken,
    role: (role as "STUDENT" | "COMPANY") || "STUDENT",
  });
  useAuthStore
    .getState()
    .setAuth(data.user, data.access_token, data.refresh_token);
    setRoleCookie(data.user.role);
  return data;
}

export async function registerUser(payload: {
  full_name: string;
  email: string;
  password: string;
  role: "STUDENT" | "COMPANY" | "MENTOR";
  college?: string;
  phone?: string;
  company_name?: string;
  industry?: string;
  consent_data_processing: boolean;
  consent_marketing?: boolean;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  return data;
}

export interface MentorRegisterPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface MentorLoginPayload {
  email: string;
  password: string;
}

export async function registerMentor(payload: MentorRegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/mentor/register", payload);
  useAuthStore
    .getState()
    .setAuth(data.user, data.access_token, data.refresh_token);
  setRoleCookie(data.user.role);
  return data;
}

export async function loginMentor(payload: MentorLoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/mentor/login", payload);
  useAuthStore
    .getState()
    .setAuth(data.user, data.access_token, data.refresh_token);
  setRoleCookie(data.user.role);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;
  try {
    if (refreshToken) {
      await api.post("/auth/logout", { refresh_token: refreshToken });
    } else {
      await api.post("/auth/logout", {});
    }
  } catch (err) {
    console.warn("Logout request failed:", err);
  } finally {
    useAuthStore.getState().clearAuth();
    clearRoleCookie(); // wipe sd_role so middleware stops protecting routes
  }
}

export function getRedirectPath(role: string): string {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  if (role === "MENTOR" || role === "INTERVIEWER") return "/mentor/dashboard";
  return "/";
}
