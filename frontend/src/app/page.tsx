"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useCompanyAuthStore } from "@/store/companyAuthStore";
import { getRedirectPath, setRoleCookie } from "@/lib/auth";
import { setCompanyRoleCookie } from "@/lib/companyAuth";
import Image from "next/image";

const PROGRESS_DURATION_MS = 3800;
const TOTAL_DONE_MS = PROGRESS_DURATION_MS;

const STATUS_MESSAGES = [
  { threshold: 0, text: "Preparing your workspace..." },
  { threshold: 28, text: "Loading your learning path..." },
  { threshold: 55, text: "Setting up your experience..." },
  { threshold: 82, text: "Almost there..." },
  { threshold: 100, text: "Ready to build your skills!" },
];

export default function SkillDipzIntro() {
  const router = useRouter();

  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const redirectedRef = useRef(false);

  // Force body background white so no dark bleed-through ever
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    document.documentElement.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prev;
      document.documentElement.style.backgroundColor = "";
    };
  }, []);

  const handleDestinationRedirect = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    // 1. Check Student / User Auth Store
    const authState = useAuthStore.getState();
    const companyAuthState = useCompanyAuthStore.getState();

    let targetRole: "STUDENT" | "MENTOR" | "INTERVIEWER" | "ADMIN" | "COMPANY" | null = null;
    let companyStatus: string | null = null;

    if (authState.user && authState.accessToken) {
      targetRole = authState.user.role as any;
    } else if (companyAuthState.company) {
      targetRole = "COMPANY";
      companyStatus = companyAuthState.company.approval_status;
    } else if (typeof window !== "undefined") {
      // 2. Direct LocalStorage fallback (if zustand async rehydration hasn't finished)
      try {
        const rawAuth = localStorage.getItem("skilldipz-auth");
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth);
          if (parsed?.state?.accessToken && parsed?.state?.user) {
            targetRole = parsed.state.user.role;
            authState.setAuth(
              parsed.state.user,
              parsed.state.accessToken,
              parsed.state.refreshToken
            );
          }
        }
      } catch {}

      if (!targetRole) {
        try {
          const rawCompany = localStorage.getItem("skilldipz-company-auth");
          if (rawCompany) {
            const parsed = JSON.parse(rawCompany);
            if (parsed?.state?.company) {
              targetRole = "COMPANY";
              companyStatus = parsed.state.company.approval_status;
              companyAuthState.setCompany(parsed.state.company);
            }
          }
        } catch {}
      }
    }

    if (targetRole === "STUDENT") {
      setRoleCookie("STUDENT");
      router.push(getRedirectPath("STUDENT")); // -> /student/overview
    } else if (targetRole === "MENTOR" || targetRole === "INTERVIEWER") {
      setRoleCookie(targetRole);
      router.push("/mentor/dashboard");
    } else if (targetRole === "COMPANY") {
      setCompanyRoleCookie("COMPANY");
      if (companyStatus === "pending") {
        router.push("/company/auth/pending");
      } else {
        router.push(getRedirectPath("COMPANY")); // -> /company/dashboard
      }
    } else {
      router.push("/onboarding");
    }
  };

  useEffect(() => {
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;

      const raw = Math.min((elapsed / PROGRESS_DURATION_MS) * 100, 100);
      setProgress(Math.round(raw));

      if (elapsed >= TOTAL_DONE_MS) {
        setProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          handleDestinationRedirect();
        }, 500);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStatus =
    [...STATUS_MESSAGES].reverse().find((s) => progress >= s.threshold) ??
    STATUS_MESSAGES[0];

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden flex flex-col"
      style={{ backgroundColor: "#ffffff" }}
    >
      {/* Counter top-right */}
      <div className="absolute top-5 right-6 z-20">
        <span className="text-[10px] font-bold tracking-[0.2em] text-slate-300 uppercase font-mono">
          {String(progress).padStart(3, "0")}%
        </span>
      </div>

      {/* SVG fills the screen */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full flex items-center justify-center"
        >
          <Image
            src="/lootie/Study discussion.svg"
            alt="Study illustration"
            width={900}
            height={900}
            priority
            className="object-contain"
            style={{
              width: "min(90vw, 700px)",
              height: "calc(100vh - 160px)",
            }}
          />
        </motion.div>
      </div>

      {/* Bottom strip: name + progress */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4 px-8 pb-10 pt-2"
        style={{ backgroundColor: "#ffffff" }}
      >
        {/* Brand name */}
        <div className="flex flex-col items-center gap-0.5">
          <h1
            className="font-black tracking-tight text-slate-900 leading-none select-none"
            style={{
              fontFamily: "'Inter', 'SF Pro Display', sans-serif",
              fontSize: "clamp(28px, 7vw, 48px)",
              letterSpacing: "-0.03em",
            }}
          >
            SkillDipz
          </h1>
          <p className="text-[10px] font-semibold tracking-[0.24em] text-slate-400 uppercase">
            AI Career Accelerator
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div className="w-full h-[3px] bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600 rounded-full relative overflow-hidden"
              style={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0.05 }}
            >
              {!isCompleted && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                />
              )}
            </motion.div>
          </div>

          <div className="h-4 overflow-hidden flex justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentStatus.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="text-[11px] font-medium text-slate-400 tracking-wide text-center"
              >
                {currentStatus.text}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}