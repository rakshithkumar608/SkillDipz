"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, CheckCircle2, ArrowRight, Building2, LogOut, RefreshCw, XCircle } from "lucide-react";
import { getCompanyMe, logoutCompany } from "@/lib/companyAuth";
import { useCompanyAuthStore } from "@/store/companyAuthStore";

export default function CompanyPendingApprovalPage() {
  const router = useRouter();
  const { company } = useCompanyAuthStore();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(
    company?.approval_status || "pending"
  );
  const [rejectionNote, setRejectionNote] = useState<string | null>(company?.approval_note || null);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await getCompanyMe();
      setStatus(res.company.approval_status);
      setRejectionNote(res.company.approval_note || null);
      if (res.company.approval_status === "approved") {
        router.push("/company/dashboard");
      }
    } catch {
      // Session might not be set or pending
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Check immediately on mount
    checkStatus();
    // Fast polling every 5 seconds for live admin approval
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logoutCompany();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
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

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-white/10 text-center space-y-6"
        >
          {status === "pending" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                  <span>Status: Under Review</span>
                </div>
                <h2 className="text-2xl font-black text-white">Account Pending Approval</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Thank you for verifying your corporate email! Our platform team reviews every company registration to maintain platform integrity for students.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4 text-xs text-slate-400 space-y-2.5 text-left">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>What happens next?</span>
                </div>
                <ul className="space-y-1.5 text-slate-400 pl-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Domain & company background verification (typically within a few hours).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Instant access to Candidate Search, Assessments, & Job Postings upon approval.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={checkStatus}
                  disabled={checking}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-white/10 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${checking ? "animate-spin" : ""}`} />
                  <span>{checking ? "Checking Approval Status…" : "Check Approval Status"}</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}

          {status === "rejected" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <XCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">Application Not Approved</h2>
                <p className="text-xs text-rose-300/80 leading-relaxed">
                  Unfortunately, your company registration could not be approved at this time.
                </p>
                {rejectionNote && (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl text-xs text-rose-300 text-left mt-2">
                    <span className="font-semibold block mb-0.5">Admin Note:</span>
                    {rejectionNote}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Link
                  href="/company/auth/signup"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition-all"
                >
                  Register with Different Credentials →
                </Link>
              </div>
            </>
          )}

          {status === "approved" && (
            <div className="space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white">Account Approved!</h2>
                <p className="text-xs text-slate-300">Welcome to SkillDipz Employer Portal.</p>
              </div>
              <Link
                href="/company/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition-all"
              >
                Go to Employer Dashboard →
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
