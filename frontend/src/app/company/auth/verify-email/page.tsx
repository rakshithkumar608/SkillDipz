"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Building2 } from "lucide-react";
import { verifyCompanyEmail } from "@/lib/companyAuth";

export default function VerifyCompanyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<string>("pending");
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token was provided in the link.");
      return;
    }

    if (hasExecuted.current) return;
    hasExecuted.current = true;

    async function runVerification() {
      try {
        const res = await verifyCompanyEmail(token);
        setStatus("success");
        setApprovalStatus(res.approval_status);
        setTimeout(() => {
          if (res.approval_status === "approved") {
            router.push("/company/dashboard");
          } else {
            router.push("/company/auth/pending");
          }
        }, 2000);
      } catch (err: unknown) {
        setStatus("error");
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          "Verification link is invalid or has expired. Please request a new one.";
        setErrorMessage(msg);
      }
    }

    runVerification();
  }, [token, router]);

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
          {status === "verifying" && (
            <div className="space-y-4 py-4">
              <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Verifying Company Email…</h3>
                <p className="text-xs text-slate-400">Validating your cryptographic security token</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white">Company Email Verified!</h3>
                <p className="text-xs text-slate-300">
                  Your work email is verified. Your account is now in the review queue.
                </p>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium">Redirecting to status page…</p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4 py-2">
              <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white">Verification Failed</h3>
                <p className="text-xs text-rose-300/80">{errorMessage}</p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/company/auth/signup"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition-all text-center"
                >
                  Register Again →
                </Link>
                <Link
                  href="/login"
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
