"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerUser, loginWithGoogle, getRedirectPath } from "@/lib/auth";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import { ArrowLeft, Building2, Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import ConsentCheckbox, { PrivacyPolicyLink } from "@/components/common/ConsentCheckbox";


type Tab = "STUDENT" | "COMPANY";

export default function RegisterScreen() {
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
  // DPDP consent — both start unticked; data-processing consent is mandatory
  const [consentDataProcessing, setConsentDataProcessing] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consentDataProcessing) {
      setError("Please agree to the Privacy Notice to create an account.");
      return;
    }
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
              consent_data_processing: consentDataProcessing,
              consent_marketing: consentMarketing,
            }
          : {
              email: form.email,
              password: form.password,
              full_name: form.full_name,
              role: "COMPANY" as const,
              company_name: form.company_name,
              industry: form.industry,
              consent_data_processing: consentDataProcessing,
              consent_marketing: consentMarketing,
            };
      const data = await registerUser(payload);
      if (data.needs_verification) {
        toast.success("Account created! Check your email for a verification code.");
        router.push(`/verify-otp?email=${encodeURIComponent(form.email)}`);
      } else {
        toast.success("Account created successfully!");
        router.push(getRedirectPath(data.user.role));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Registration failed. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
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
            ?.detail || "Google sign-up failed. Please try again.";
        toast.error(msg);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error("Google Sign-up Error:", errorResponse);
      const detail = errorResponse.error_description || errorResponse.error || "Google sign-up was cancelled or blocked.";
      toast.error(`Google sign-up error: ${detail}`);
    },
  });

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]" />
      <div className="absolute left-0 right-0 top-[-10%] h-[600px] w-full bg-[radial-gradient(circle_400px_at_50%_200px,#7c3aed22,#000)]" />

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
            style={{ height: "auto", width: "auto" }}
          />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-2">
            Create Account
          </h1>
          <p className="text-neutral-400 text-sm text-center mb-6">
            Join SkillDipz and start building your career
          </p>

          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-6 border border-white/10">
            <button
              onClick={() => {
                setTab("STUDENT");
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${
                tab === "STUDENT"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <GraduationCap size={18} />
              <span>Student</span>
            </button>

            <button
              onClick={() => {
                router.push("/company/auth/signup");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-neutral-400 hover:text-white transition-all duration-300 cursor-pointer"
            >
              <Building2 size={18} />
              <span>Company</span>
            </button>
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
                Sign up with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-neutral-500 text-xs uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              id="register-name"
              type="text"
              required
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Full Name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
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
                {showPwd ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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

            <div className="space-y-3 pt-1">
              <ConsentCheckbox
                id="consent-data-processing"
                checked={consentDataProcessing}
                onChange={setConsentDataProcessing}
                required
                label={
                  <>
                    I have read and agree to the{" "}
                    <PrivacyPolicyLink />, and consent to SkillDipz processing
                    my {tab === "STUDENT" ? "profile, resume and skill" : "company"}{" "}
                    data to provide this service. (Required)
                  </>
                }
              />
              <ConsentCheckbox
                id="consent-marketing"
                checked={consentMarketing}
                onChange={setConsentMarketing}
                label="Send me product updates and career tips by email. (Optional)"
              />
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading || !consentDataProcessing}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
