"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { loginMentor } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, UserCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function MentorLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    try {
      setLoading(true);
      const data = await loginMentor({
        email: email.trim().toLowerCase(),
        password,
      });

      toast.success("Welcome back, Mentor!");
      router.push("/mentor/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        "Invalid credentials or you do not have mentor privileges.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090e] text-white flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f1e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]" />
      <div className="absolute left-0 right-0 top-[-10%] h-[600px] w-full rounded-full bg-[radial-gradient(circle_400px_at_50%_200px,#6366f122,#000)]" />

      {/* Back button */}
      <Link
        href="/onboarding"
        aria-label="Back to Onboarding"
        className="absolute top-5 left-5 sm:top-8 sm:left-8 z-30 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-neutral-400 hover:text-white transition-all backdrop-blur-md shadow-lg group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
      </Link>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/images/skilldepz.png"
            alt="SkillDipz"
            width={140}
            height={36}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-indigo-500/20 bg-slate-950/80 backdrop-blur-xl p-8 shadow-2xl shadow-indigo-950/40"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-3">
              <UserCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Mentor Portal Login
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sign in to manage your availability, conduct mock rounds, and submit evaluations.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed flex items-start gap-2">
              <span className="shrink-0 mt-0.5 font-bold">✕</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Email Address
              </label>
              <input
                id="mentor-login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="mentor-login-password"
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In as Mentor</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              Don't have a mentor account yet?{" "}
              <Link
                href="/mentor/register"
                className="text-indigo-400 hover:text-indigo-300 font-bold ml-1 transition-colors"
              >
                Register Here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
