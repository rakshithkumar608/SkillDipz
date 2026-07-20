"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { getRedirectPath } from "@/lib/auth";
import { toast } from "sonner";

export default function VerifyOTPPage() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start 60-second countdown on mount
  useEffect(() => {
    setCountdown(60);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Allow only digits
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1); // only last char
    setOtp(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      toast.error("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp: code });
      useAuthStore.getState().setAuth(data.user, data.access_token, data.refresh_token);
      toast.success("Email verified! Welcome to SkillDipz 🎉");
      router.push(getRedirectPath(data.user.role));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Invalid or expired code. Try again.";
      toast.error(msg);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      await api.post("/auth/resend-otp", { email });
      toast.success("New code sent! Check your inbox.");
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to resend code. Please try again.";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/(.{2}).+(@.+)/, "$1***$2")
    : "your email";

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
      <div className="absolute left-0 right-0 top-[-10%] h-[600px] w-full rounded-full bg-[radial-gradient(circle_400px_at_50%_200px,#7c3aed22,#000)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/images/skilldepz.png"
            alt="SkillDipz"
            width={140}
            height={42}
            style={{ height: "auto", width: "auto" }}
          />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <MailCheck className="w-8 h-8 text-violet-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Verify your email</h1>
          <p className="text-neutral-400 text-sm text-center mb-8">
            We sent a 6-digit code to{" "}
            <span className="text-white font-medium">{maskedEmail}</span>
          </p>

          <form onSubmit={handleSubmit}>
            {/* OTP Inputs */}
            <div className="flex gap-2 justify-center mb-8" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all
                    bg-white/5 text-white outline-none
                    ${digit
                      ? "border-violet-500 ring-1 ring-violet-500/50"
                      : "border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    }`}
                />
              ))}
            </div>

            <button
              id="verify-submit"
              type="submit"
              disabled={loading || otp.join("").length < 6}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                         font-semibold text-sm transition-all disabled:opacity-50
                         flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          {/* Resend */}
          <div className="text-center mt-6">
            <p className="text-neutral-500 text-sm">
              Didn&apos;t receive a code?{" "}
              <button
                onClick={handleResend}
                disabled={resending || countdown > 0}
                className="text-violet-400 hover:text-violet-300 font-medium transition-colors
                           disabled:text-neutral-600 disabled:cursor-not-allowed
                           inline-flex items-center gap-1"
              >
                {resending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
            </p>
          </div>

          <p className="text-center text-xs text-neutral-600 mt-4">
            Wrong email?{" "}
            <a href="/register" className="text-violet-400 hover:text-violet-300 transition-colors">
              Go back
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
