import { AuthUser, useAuthStore } from "@/store/authStore";
import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
  role: "STUDENT" | "COMPANY";
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: "STUDENT" | "COMPANY";
  college?: string;
  company_name?: string;
  industry?: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  needs_verification?: boolean;
}


// Cookie helper (middleware reads sd_role to protect routes)

function setRoleCookie(role: string):void{
  if(typeof document === "undefined") return;
  document.cookie = `sd_role=${role};path=/;SameSie=Lax;max-age=${7*24*3600}`;
}

function clearRoleCookie():void{
  if(typeof document === "undefined") return;
  document.cookie = `sd_role=;path=/;max-age=0`;
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
  role?: "STUDENT" | "COMPANY",
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/google", {
    id_token: googleIdToken,
    role: role || "STUDENT",
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
  role: "STUDENT" | "COMPANY";
  college?: string;
  phone?: string;
  company_name?: string;
  industry?: string;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;
  try {
    await api.post("/auth/logout", { refresh_token: refreshToken });
  } finally {
    useAuthStore.getState().clearAuth();
    clearRoleCookie(); // wipe sd_role so middleware stops protecting routes
  }
}

export function getRedirectPath(role: string): string {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  return "/";
}
