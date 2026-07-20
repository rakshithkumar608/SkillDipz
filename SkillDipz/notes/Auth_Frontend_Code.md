# SkillDipz — Frontend Authentication Code
> **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zustand · Axios  
> **Auth:** JWT (Access + Refresh tokens) + Google OAuth  
> **Real-time:** WebSocket on login success

---

## ⚠️ 0. Changes Required in Existing `onboarding/page.tsx`

> The onboarding page already exists at `src/app/(auth)/onboarding/page.tsx`.  
> The **"Sign in"**, **"Get Started"**, and **"Start Your Journey"** buttons currently have **no navigation wired up**.  
> Only **3 small changes** needed — nothing else in the file changes.

---

### Change 1 — Navbar "Sign in" button → `/login`

```diff
- <button className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-neutral-300 transition hover:text-white whitespace-nowrap">
-   Sign in
- </button>
+ <a
+   href="/login"
+   className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-neutral-300 transition hover:text-white whitespace-nowrap"
+ >
+   Sign in
+ </a>
```

---

### Change 2 — Navbar "Get Started" button → `/register`

```diff
- <HoverBorderGradient
-   containerClassName="cursor-pointer"
-   className="flex items-center gap-2 text-xs sm:text-sm font-medium whitespace-nowrap px-4 py-2"
- >
-   Get Started <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
- </HoverBorderGradient>
+ <a href="/register">
+   <HoverBorderGradient
+     containerClassName="cursor-pointer"
+     className="flex items-center gap-2 text-xs sm:text-sm font-medium whitespace-nowrap px-4 py-2"
+   >
+     Get Started <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
+   </HoverBorderGradient>
+ </a>
```

---

### Change 3 — Hero "Start Your Journey" button → `/register`

```diff
- <HoverBorderGradient
-   containerClassName="cursor-pointer"
-   className="flex items-center gap-2 text-sm sm:text-base font-medium px-6 py-3 whitespace-nowrap"
- >
-   Start Your Journey <ArrowRight className="h-4 w-4" />
- </HoverBorderGradient>
+ <a href="/register">
+   <HoverBorderGradient
+     containerClassName="cursor-pointer"
+     className="flex items-center gap-2 text-sm sm:text-base font-medium px-6 py-3 whitespace-nowrap"
+   >
+     Start Your Journey <ArrowRight className="h-4 w-4" />
+   </HoverBorderGradient>
+ </a>
```

---

### Ready-to-paste: Updated Navbar div (replaces lines 118–129)

```tsx
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/login"
              className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-neutral-300 transition hover:text-white whitespace-nowrap"
            >
              Sign in
            </a>
            <a href="/register">
              <HoverBorderGradient
                containerClassName="cursor-pointer"
                className="flex items-center gap-2 text-xs sm:text-sm font-medium whitespace-nowrap px-4 py-2"
              >
                Get Started <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </HoverBorderGradient>
            </a>
          </div>
```

### Ready-to-paste: Updated Hero CTA (replaces lines 147–154)

```tsx
            <div className="mt-8 sm:mt-12 flex justify-center gap-4 sm:gap-6">
              <a href="/register">
                <HoverBorderGradient
                  containerClassName="cursor-pointer"
                  className="flex items-center gap-2 text-sm sm:text-base font-medium px-6 py-3 whitespace-nowrap"
                >
                  Start Your Journey <ArrowRight className="h-4 w-4" />
                </HoverBorderGradient>
              </a>
            </div>
```

> Everything else in `onboarding/page.tsx` (carousel, stats, roles, footer) stays **unchanged**.

---

## File Structure

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── onboarding/page.tsx       ← Landing/Onboarding (existing, enhanced)
│   │   ├── login/page.tsx            ← Login page (Student + Company tabs)
│   │   └── register/page.tsx         ← Register page (Student + Company)
│   ├── student/
│   │   └── overview/page.tsx         ← Protected dashboard (post-login)
│   └── middleware.ts                 ← Route protection
├── lib/
│   ├── api.ts                        ← Axios instance with JWT interceptors
│   ├── auth.ts                       ← Auth helper functions
│   └── socket.ts                     ← WebSocket client
├── store/
│   └── authStore.ts                  ← Zustand auth state
└── hooks/
    └── useAuth.ts                    ← Auth hook
```

---

## 1. `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
NEXT_PUBLIC_SOCKET_URL=ws://localhost:8000/ws
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

---

## 2. `src/store/authStore.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "STUDENT" | "COMPANY" | "CREATOR" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  is_verified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "skilldipz-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
```

---

## 3. `src/lib/api.ts`

```typescript
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refresh_token: refreshToken }
        );
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          data.access_token,
          data.refresh_token
        );
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 4. `src/lib/auth.ts`

```typescript
import api from "./api";
import { useAuthStore, AuthUser } from "@/store/authStore";

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
  // Student only:
  college?: string;
  phone?: string;
  // Company only:
  company_name?: string;
  industry?: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

export async function loginWithCredentials(
  payload: LoginPayload
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  useAuthStore.getState().setAuth(
    data.user,
    data.access_token,
    data.refresh_token
  );
  return data;
}

export async function registerUser(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  useAuthStore.getState().setAuth(
    data.user,
    data.access_token,
    data.refresh_token
  );
  return data;
}

export async function loginWithGoogle(googleIdToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/google", {
    id_token: googleIdToken,
  });
  useAuthStore.getState().setAuth(
    data.user,
    data.access_token,
    data.refresh_token
  );
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;
  try {
    await api.post("/auth/logout", { refresh_token: refreshToken });
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

export function getRedirectPath(role: string): string {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/";
}
```

---

## 5. `src/hooks/useAuth.ts`

```typescript
"use client";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { logout, getRedirectPath } from "@/lib/auth";

export function useAuth() {
  const { user, accessToken, isLoading, clearAuth } = useAuthStore();
  const router = useRouter();

  const isAuthenticated = !!accessToken && !!user;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const redirectAfterLogin = (role: string) => {
    router.push(getRedirectPath(role));
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    handleLogout,
    redirectAfterLogin,
  };
}
```

---

## 6. `src/middleware.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/onboarding"];
const STUDENT_ROUTES = ["/student"];
const COMPANY_ROUTES = ["/company"];

export function middleware(req: NextRequest) {
  const token = req.cookies.get("accessToken")?.value;
  const role = req.cookies.get("userRole")?.value;
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Not logged in — block protected routes
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged in — block auth pages
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL(getRedirectPath(role || ""), req.url));
  }

  // Role-based guards
  if (token && pathname.startsWith("/student") && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (token && pathname.startsWith("/company") && role !== "COMPANY") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

function getRedirectPath(role: string) {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  return "/";
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 7. `src/app/(auth)/login/page.tsx`  ← **FULL LOGIN PAGE**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Chrome } from "lucide-react";
import { loginWithCredentials, loginWithGoogle, getRedirectPath } from "@/lib/auth";
import { useGoogleLogin } from "@react-oauth/google";

type Tab = "STUDENT" | "COMPANY";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("STUDENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginWithCredentials({ email, password, role: tab });
      router.push(getRedirectPath(data.user.role));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError(null);
      try {
        const data = await loginWithGoogle(tokenResponse.access_token);
        router.push(getRedirectPath(data.user.role));
      } catch {
        setError("Google sign-in failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError("Google sign-in was cancelled."),
  });

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
      <div className="absolute left-0 right-0 top-[-10%] h-[600px] w-full rounded-full bg-[radial-gradient(circle_400px_at_50%_200px,#7c3aed22,#000)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/images/skilldepz.png" alt="SkillDipz" width={140} height={42} className="h-auto" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
          <p className="text-neutral-400 text-sm text-center mb-6">
            Sign in to continue your journey
          </p>

          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
            {(["STUDENT", "COMPANY"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-violet-600 text-white shadow-lg"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {t === "STUDENT" ? "🎓 Student" : "🏢 Company"}
              </button>
            ))}
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={() => googleLogin()}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all text-sm font-medium mb-4 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Chrome className="w-4 h-4" />
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-neutral-500 text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Signing in..." : `Sign in as ${tab === "STUDENT" ? "Student" : "Company"}`}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Create one
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
```

---

## 8. `src/app/(auth)/register/page.tsx` ← **FULL REGISTER PAGE**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Chrome } from "lucide-react";
import { registerUser, loginWithGoogle, getRedirectPath } from "@/lib/auth";
import { useGoogleLogin } from "@react-oauth/google";

type Tab = "STUDENT" | "COMPANY";

export default function RegisterPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("STUDENT");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    college: "",
    phone: "",
    company_name: "",
    industry: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload =
        tab === "STUDENT"
          ? {
              email: form.email,
              password: form.password,
              full_name: form.full_name,
              role: "STUDENT" as const,
              college: form.college,
              phone: form.phone,
            }
          : {
              email: form.email,
              password: form.password,
              full_name: form.full_name,
              role: "COMPANY" as const,
              company_name: form.company_name,
              industry: form.industry,
            };
      const data = await registerUser(payload);
      router.push(getRedirectPath(data.user.role));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError(null);
      try {
        const data = await loginWithGoogle(tokenResponse.access_token);
        router.push(getRedirectPath(data.user.role));
      } catch {
        setError("Google sign-up failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError("Google sign-up was cancelled."),
  });

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
      <div className="absolute left-0 right-0 top-[-10%] h-[600px] w-full bg-[radial-gradient(circle_400px_at_50%_200px,#7c3aed22,#000)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/images/skilldepz.png" alt="SkillDipz" width={140} height={42} className="h-auto" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
          <p className="text-neutral-400 text-sm text-center mb-6">
            Join SkillDipz and start building your career
          </p>

          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
            {(["STUDENT", "COMPANY"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-violet-600 text-white shadow-lg"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {t === "STUDENT" ? "🎓 Student" : "🏢 Company"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => googleLogin()}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all text-sm font-medium mb-4 disabled:opacity-50"
          >
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-4 h-4" />}
            Sign up with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-neutral-500 text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shared Fields */}
            <input
              id="register-name"
              type="text"
              required
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Full Name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
            />
            <input
              id="register-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Email Address"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
            />
            <div className="relative">
              <input
                id="register-password"
                type={showPwd ? "text" : "password"}
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Password (min 8 chars)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Student-only fields */}
            {tab === "STUDENT" && (
              <>
                <input
                  id="register-college"
                  type="text"
                  value={form.college}
                  onChange={(e) => update("college", e.target.value)}
                  placeholder="College / University"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
                <input
                  id="register-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="Phone Number (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </>
            )}

            {/* Company-only fields */}
            {tab === "COMPANY" && (
              <>
                <input
                  id="register-company"
                  type="text"
                  required
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="Company Name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
                <select
                  id="register-industry"
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-300 focus:outline-none focus:border-violet-500 transition-all"
                >
                  <option value="" className="bg-zinc-900">Select Industry</option>
                  <option value="Fintech" className="bg-zinc-900">Fintech</option>
                  <option value="E-commerce" className="bg-zinc-900">E-commerce</option>
                  <option value="SaaS" className="bg-zinc-900">SaaS</option>
                  <option value="Healthcare" className="bg-zinc-900">Healthcare</option>
                  <option value="EdTech" className="bg-zinc-900">EdTech</option>
                  <option value="Tech" className="bg-zinc-900">Tech</option>
                  <option value="Other" className="bg-zinc-900">Other</option>
                </select>
              </>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
```

---

## 9. `src/app/layout.tsx` — Wrap with Google OAuth Provider

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SkillDipz — Build a Career That Matches Your True Potential",
  description:
    "AI-powered career platform. Skill gap analysis, dynamic learning roadmaps, mock interviews, and company matching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
```

---

## 10. Install Required Packages

```bash
npm install @react-oauth/google jwt-decode
```

---

## Auth Flow Summary

```
Onboarding Page (/)
  ├── [Sign In] → /login
  │   ├── Student Tab → Email/Password → POST /v1/auth/login {role: "STUDENT"}
  │   ├── Company Tab → Email/Password → POST /v1/auth/login {role: "COMPANY"}
  │   └── Google → Google OAuth → POST /v1/auth/google {id_token}
  │         ↓ success
  │   JWT saved to Zustand (persisted) + cookie set
  │         ↓
  │   Student → /student/overview
  │   Company → /company/dashboard
  │
  └── [Get Started] → /register
      ├── Student Tab → form → POST /v1/auth/register {role: "STUDENT"}
      ├── Company Tab → form → POST /v1/auth/register {role: "COMPANY"}
      └── Google → same as login Google flow
```
