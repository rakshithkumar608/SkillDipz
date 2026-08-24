"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { resendCompanyVerification } from "@/lib/companyAuth";

function VerifyEmailSentContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error("Please enter your email to resend.");
      return;
    }
    setResending(true);
    try {
      await resendCompanyVerification(email);
      setResendSent(true);
      toast.success("A new verification link has been sent if an unverified account exists.");
    } catch {
      toast.error("Could not send verification email. Please try again shortly.");
    } finally {
      setResending(false);
    }
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
          {/* Email Icon Glow */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Check Your Work Inbox</h2>
            <p className="text-sm text-slate-400">
              We sent a verification link to{" "}
              {email ? (
                <span className="font-semibold text-emerald-300 font-mono block mt-1">{email}</span>
              ) : (
                "your corporate email address"
              )}
            </p>
          </div>

          <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4 text-xs text-slate-400 space-y-2 text-left">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Next Steps</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
              <li>Click the verification link in your email (valid for 24 hours).</li>
              <li>Once verified, your account enters the admin approval queue.</li>
              <li>You will receive an approval notification to begin posting jobs & viewing candidates.</li>
            </ol>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={handleResend}
              disabled={resending || resendSent}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {resending ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <RefreshCw className="w-4 h-4 text-emerald-400" />
              )}
              <span>{resendSent ? "Link Resent!" : "Resend Verification Email"}</span>
            </button>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <VerifyEmailSentContent />
    </Suspense>
  );
}
