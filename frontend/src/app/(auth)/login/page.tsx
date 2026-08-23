"use client";

import {
  getRedirectPath,
  loginWithCredentials,
  loginWithGoogle,
} from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import { ArrowLeft, Building2, Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";

type Tab = "STUDENT" | "COMPANY";

export default function LoginScreen() {
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
    setLoading(true);
    try {
      const data = await loginWithCredentials({ email, password, role: tab });
      toast.success("Login successful!");
      router.push(getRedirectPath(data.user.role));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Invalid credentials. Please try again.";
      toast.error(msg);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const data = await loginWithGoogle(tokenResponse.access_token, tab);
        toast.success("Google login successful!");
        router.push(getRedirectPath(data.user.role));
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Google login failed. Please try again.";
        toast.error(msg);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error("Google Login Error:", errorResponse);
      const detail = errorResponse.error_description || errorResponse.error || "Google sign-in was cancelled or blocked.";
      toast.error(`Google login error: ${detail}`);
    },
  });

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]" />
      <div className="absolute left-0 right-0 top-[-10%] h-[600px] w-full rounded-full bg-[radial-gradient(circle_400px_at_50%_200px,#7c3aed22,#000)]" />

      {/* Top Left Back Arrow (Icon only) */}
      <Link
        href="/onboarding"
        aria-label="Back to Onboarding"
        className="absolute top-5 left-5 sm:top-8 sm:left-8 z-30 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-neutral-400 hover:text-white transition-all backdrop-blur-md shadow-lg group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image
            src="/images/skilldepz.png"
            alt="SkillDipz"
            width={140}
            height={42}
            style={{height:"auto", width: "auto"}}
          />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
          <p className="text-neutral-400 text-sm text-center mb-6">
            Sign in to continue your journey
          </p>

          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-6 border border-white/10">
            {(["STUDENT", "COMPANY"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${
                  tab === t
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {t === "STUDENT" ? (
                  <>
                    <GraduationCap size={18} />
                    <span>Student</span>
                  </>
                ) : (
                  <>
                    <Building2 size={18} />
                    <span>Company</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Google Login — Students only */}
          {tab === "STUDENT" && (
            <>
              <button
                type="button"
                onClick={() => googleLogin()}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all text-sm font-medium mb-4 disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FcGoogle className="w-5 h-5" />
                )}
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-neutral-500 text-xs uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/10"/>
              </div>
            </>
          )}

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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute inset-y-0 right-4 flex items-center text-neutral-500 hover:text-white transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
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
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Signing in..." : `Sign in as ${tab === "STUDENT" ? "Student" : "Company"}`}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">Create one</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
