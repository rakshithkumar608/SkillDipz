"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
  Globe,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Sparkles,
  Award,
  Check,
  Building,
} from "lucide-react";
import { signupCompany } from "@/lib/companyAuth";

const FREE_AND_DISPOSABLE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "protonmail.com",
  "proton.me", "tutanota.com", "zoho.com", "aol.com", "rediffmail.com",
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "yopmail.com", "sharklasers.com", "guerrillamail.com", "throwawaymail.com",
  "dispostable.com", "burnermail.io", "fakemailgenerator.com",
]);

const INDIAN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
  "09": "Uttar Pradesh", "10": "Bihar", "19": "West Bengal", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "32": "Kerala", "33": "Tamil Nadu",
  "36": "Telangana", "37": "Andhra Pradesh",
};

const INDUSTRIES = [
  "Information Technology & Services",
  "Software & SaaS",
  "Financial Services & Fintech",
  "AI & Deep Learning",
  "E-Commerce & Digital Retail",
  "Healthcare & HealthTech",
  "EdTech & Learning Platforms",
  "Consulting & Strategy",
  "Hardware & Semiconductors",
  "Media, Gaming & Entertainment",
  "Other",
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1–10 (Startup)" },
  { value: "11-50", label: "11–50 (Early Stage)" },
  { value: "51-200", label: "51–200 (Growth Stage)" },
  { value: "200+", label: "200+ (Enterprise)" },
];

export default function CompanySignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [form, setForm] = useState({
    // Step 1
    contact_name: "",
    email: "",
    password: "",
    company_name: "",
    industry: "Information Technology & Services",
    // Step 2
    gstin_or_cin: "",
    linkedin_company_url: "",
    company_website: "",
    company_size: "11-50" as "1-10" | "11-50" | "51-200" | "200+",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Live Domain Analysis ───────────────────────────────────────────────────
  const domainAnalysis = useMemo(() => {
    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes("@")) return null;
    const domain = email.split("@")[1];
    if (!domain || !domain.includes(".")) return null;

    if (FREE_AND_DISPOSABLE_DOMAINS.has(domain)) {
      return {
        isCorporate: false,
        message: `'${domain}' is a free/disposable provider. Corporate domain required.`,
      };
    }
    return {
      isCorporate: true,
      domain,
      message: `Corporate domain detected (@${domain})`,
    };
  }, [form.email]);

  // ── Live GSTIN / CIN Analysis ──────────────────────────────────────────────
  const gstinCinAnalysis = useMemo(() => {
    const raw = form.gstin_or_cin.trim().toUpperCase();
    if (!raw) return null;

    // GSTIN Check: 15 chars (e.g. 29AAAAA0000A1Z5)
    if (raw.length === 15) {
      const stateCode = raw.substring(0, 2);
      const panPart = raw.substring(2, 12);
      const zPart = raw[13];
      const stateName = INDIAN_STATES[stateCode] || "Indian State";

      if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(raw)) {
        return {
          valid: true,
          type: "GSTIN",
          badge: `✅ Valid GSTIN (${stateName})`,
        };
      }
      if (zPart !== "Z") {
        return { valid: false, type: "GSTIN", error: "14th character of GSTIN must be 'Z'." };
      }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panPart)) {
        return { valid: false, type: "GSTIN", error: "Invalid PAN segment in GSTIN." };
      }
    }

    // CIN Check: 21 chars (e.g. U72200KA2015PTC084999)
    if (raw.length === 21) {
      if (/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(raw)) {
        const status = raw[0] === "L" ? "Listed" : "Unlisted";
        const state = raw.substring(6, 8);
        const year = raw.substring(8, 12);
        return {
          valid: true,
          type: "CIN",
          badge: `✅ Valid CIN (${status} Company, ${state}, Est. ${year})`,
        };
      }
    }

    if (raw.length > 0 && raw.length < 15) {
      return { valid: false, error: "Enter 15-digit GSTIN or 21-digit CIN." };
    }
    if (raw.length > 15 && raw.length < 21) {
      return { valid: false, error: "CIN must be 21 characters." };
    }
    if (raw.length > 21) {
      return { valid: false, error: "Identifier is too long." };
    }

    return null;
  }, [form.gstin_or_cin]);

  // ── Live LinkedIn Analysis ─────────────────────────────────────────────────
  const linkedinAnalysis = useMemo(() => {
    const url = form.linkedin_company_url.trim();
    if (!url) return null;
    if (url.includes("/in/")) {
      return { valid: false, error: "Must be a Company page URL, not a personal profile." };
    }
    if (/^https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_\-\.%]{2,100}\/?$/i.test(url)) {
      return { valid: true, badge: "✅ Valid LinkedIn Company Page" };
    }
    return { valid: false, error: "Must match https://linkedin.com/company/yourcompany" };
  }, [form.linkedin_company_url]);

  // ── Password Strength ──────────────────────────────────────────────────────
  const pwdStrength = useMemo(() => {
    const pwd = form.password;
    if (!pwd) return { score: 0, label: "Empty", color: "bg-slate-700" };
    let score = 0;
    if (pwd.length >= 10) score += 1;
    if (pwd.length >= 14) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: "Weak (min 10 chars)", color: "bg-rose-500" };
    if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 3, label: "Good", color: "bg-emerald-500" };
    return { score: 4, label: "Strong & Secure", color: "bg-emerald-400" };
  }, [form.password]);

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error("Please enter your registered company name.");
      return;
    }
    if (!form.contact_name.trim()) {
      toast.error("Please enter the contact person's name.");
      return;
    }
    if (!domainAnalysis || !domainAnalysis.isCorporate) {
      toast.error("A valid corporate domain email is required. Free email providers are rejected.");
      return;
    }
    if (form.password.length < 10) {
      toast.error("Password must be at least 10 characters.");
      return;
    }
    setStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gstinCinAnalysis || !gstinCinAnalysis.valid) {
      toast.error(gstinCinAnalysis?.error || "Please enter a valid 15-digit GSTIN or 21-digit CIN.");
      return;
    }
    if (!linkedinAnalysis || !linkedinAnalysis.valid) {
      toast.error(linkedinAnalysis?.error || "Please enter a valid LinkedIn company URL.");
      return;
    }

    setLoading(true);
    try {
      await signupCompany({
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        industry: form.industry,
        gstin_or_cin: form.gstin_or_cin.trim().toUpperCase(),
        linkedin_company_url: form.linkedin_company_url.trim(),
        company_website: form.company_website.trim() || undefined,
        company_size: form.company_size,
      });

      toast.success("Registration submitted! Your account is now awaiting admin approval.");
      router.push(`/company/auth/pending`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not complete registration. Please verify company details.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Ambient Glows & Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98108_1px,transparent_1px),linear-gradient(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[32rem] h-[32rem] bg-teal-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Left Navigation Arrow */}
      <Link
        href="/login"
        className="absolute top-6 left-6 z-30 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:border-white/20 transition-all backdrop-blur-md"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Login</span>
      </Link>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <Image
              src="/images/skilldepz.png"
              alt="SkillDipz"
              width={160}
              height={48}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Header Title */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold tracking-wide uppercase">
            <Building className="w-3.5 h-3.5" />
            Employer & Recruiter Onboarding
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Register Your Organization
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Access pre-vetted developer talent, post skill-matched jobs, and administer custom coding challenges.
          </p>
        </motion.div>

        {/* Interactive 2-Step Stepper Bar */}
        <div className="mt-8 flex items-center justify-center gap-4">
          {/* Step 1 Pill */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              step === 1
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10"
                : "bg-slate-900/60 border border-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                step === 1 ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              1
            </div>
            <span className="text-xs font-bold">1. Account Credentials</span>
          </button>

          {/* Stepper Divider */}
          <div className={`w-8 h-0.5 rounded-full transition-colors ${step === 2 ? "bg-emerald-500" : "bg-slate-800"}`} />

          {/* Step 2 Pill */}
          <div
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all ${
              step === 2
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10"
                : "bg-slate-900/60 border border-white/5 text-slate-500"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                step === 2 ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-500"
              }`}
            >
              2
            </div>
            <span className="text-xs font-bold">2. Corporate Verification</span>
          </div>
        </div>
      </div>

      {/* Main Glass Form Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl z-10"
      >
        <div className="bg-slate-900/80 backdrop-blur-2xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-white/10 relative">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                onSubmit={handleStep1Next}
                className="space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Step 1 of 2: Create Account Credentials
                    </h2>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    Corporate Access Only
                  </span>
                </div>

                {/* Company Name & Contact Person Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Company Name <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acme Technologies Inc"
                        value={form.company_name}
                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                        className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Contact Person Name <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sarah Connor (Tech Recruiter)"
                        value={form.contact_name}
                        onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                        className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Corporate Work Email with Live Anti-Fraud Domain Detector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Official Work Email <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">No Gmail / Yahoo / Hotmail</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. sarah@acmetech.io"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={`w-full bg-slate-950/70 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                        domainAnalysis && !domainAnalysis.isCorporate
                          ? "border-rose-500/70 focus:border-rose-500"
                          : domainAnalysis?.isCorporate
                          ? "border-emerald-500/70 focus:border-emerald-500"
                          : "border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  {/* Live Domain Feedback Pill */}
                  {domainAnalysis && (
                    <div className="mt-1.5">
                      {domainAnalysis.isCorporate ? (
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{domainAnalysis.message}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{domainAnalysis.message}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Password with Strength Analyzer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Minimum 10 characters (passphrase recommended)"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((s) => (
                          <div
                            key={s}
                            className={`h-full flex-1 rounded-full transition-all duration-300 ${
                              s <= pwdStrength.score ? pwdStrength.color : "bg-slate-800"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Strength: <span className="font-semibold text-slate-300">{pwdStrength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Industry Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Primary Industry / Sector <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <select
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
                    >
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind} className="bg-slate-900 text-white">
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 1 CTA */}
                <button
                  type="submit"
                  disabled={!!domainAnalysis && !domainAnalysis.isCorporate}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Continue to Corporate Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                onSubmit={handleFinalSubmit}
                className="space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Step 2 of 2: Corporate Verification
                    </h2>
                  </div>
                  <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/25">
                    Strict Review Gate
                  </span>
                </div>

                {/* GSTIN / CIN with Structural Validator Badge */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Indian GSTIN or CIN <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">15-char GSTIN or 21-char CIN</span>
                  </div>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 29AAAAA0000A1Z5 or U72200KA2015PTC084999"
                      value={form.gstin_or_cin}
                      onChange={(e) => setForm({ ...form, gstin_or_cin: e.target.value.toUpperCase() })}
                      className={`w-full bg-slate-950/70 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors font-mono uppercase ${
                        gstinCinAnalysis && !gstinCinAnalysis.valid
                          ? "border-rose-500/70 focus:border-rose-500"
                          : gstinCinAnalysis?.valid
                          ? "border-emerald-500/70 focus:border-emerald-500"
                          : "border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  {/* Live GSTIN/CIN Validator Badge */}
                  {gstinCinAnalysis && (
                    <div className="mt-1.5">
                      {gstinCinAnalysis.valid ? (
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{gstinCinAnalysis.badge}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{gstinCinAnalysis.error}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* LinkedIn Company Page URL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Official LinkedIn Company Page <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">linkedin.com/company/...</span>
                  </div>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="url"
                      required
                      placeholder="https://www.linkedin.com/company/acmetechnologies"
                      value={form.linkedin_company_url}
                      onChange={(e) => setForm({ ...form, linkedin_company_url: e.target.value })}
                      className={`w-full bg-slate-950/70 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                        linkedinAnalysis && !linkedinAnalysis.valid
                          ? "border-rose-500/70 focus:border-rose-500"
                          : linkedinAnalysis?.valid
                          ? "border-emerald-500/70 focus:border-emerald-500"
                          : "border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  {linkedinAnalysis && (
                    <div className="mt-1.5">
                      {linkedinAnalysis.valid ? (
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{linkedinAnalysis.badge}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{linkedinAnalysis.error}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Company Website & Company Size Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Company Website <span className="text-slate-500">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="url"
                        placeholder="https://acmetech.io"
                        value={form.company_website}
                        onChange={(e) => setForm({ ...form, company_website: e.target.value })}
                        className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Company Size <span className="text-slate-500">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <select
                        value={form.company_size}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            company_size: e.target.value as "1-10" | "11-50" | "51-200" | "200+",
                          })
                        }
                        className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/70 cursor-pointer"
                      >
                        {COMPANY_SIZES.map((sz) => (
                          <option key={sz.value} value={sz.value} className="bg-slate-900 text-white">
                            {sz.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Trust & Anti-Fraud Security Guarantee Card */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>SkillDipz Multi-Tier Verification Guarantee</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
                    Every company registration is cryptographically verified via corporate email token and reviewed by platform administrators before granting candidate search access.
                  </p>
                </div>

                {/* Actions: Back & Submit */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="w-1/3 flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={Boolean(loading || (gstinCinAnalysis && !gstinCinAnalysis.valid) || (linkedinAnalysis && !linkedinAnalysis.valid))}
                    className="w-2/3 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Verifying & Submitting…</span>
                      </>
                    ) : (
                      <>
                        <span>Submit For Corporate Review</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer Sign In Link */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-slate-400">
              Already have an approved organization account?{" "}
              <Link href="/login" className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                Sign in here →
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
