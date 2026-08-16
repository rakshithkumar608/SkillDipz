"use client";

import { useEffect, useState } from "react";
import type { CandidateDetail } from "@/store/companyStore";
import { scheduleCompanyInterview } from "@/lib/interviewApi";
import { toast } from "sonner";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  User,
  Link as LinkIcon,
  Loader2,
  X,
  Phone,
  Mail,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

interface Props {
  candidate: CandidateDetail;
  onClose: () => void;
}

function fitColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-rose-400";
}

// Get default date string for tomorrow at 11:00 AM in local timezone format (YYYY-MM-DDTHH:MM)
function getDefaultScheduledAt(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = tomorrow.getFullYear();
  const mm = pad(tomorrow.getMonth() + 1);
  const dd = pad(tomorrow.getDate());
  const hh = pad(tomorrow.getHours());
  const min = pad(tomorrow.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function CandidateModal({ candidate, onClose }: Props) {
  const [showScheduler, setShowScheduler] = useState(false);
  const [interviewType, setInterviewType] = useState(
    candidate.target_role
      ? `${candidate.target_role} Interview`
      : "Technical Interview"
  );
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt);
  const [durationMins, setDurationMins] = useState(45);
  const [interviewerName, setInterviewerName] = useState("");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScheduledSuccess, setIsScheduledSuccess] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const displaySkills =
    candidate.matched_skills.length > 0
      ? candidate.matched_skills
      : candidate.skills.slice(0, 8);

  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      toast.error("Please select a valid date and time for the interview.");
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledDate = new Date(scheduledAt);
      const res = await scheduleCompanyInterview({
        student_id: candidate.student_id,
        interview_type: interviewType,
        scheduled_at: scheduledDate.toISOString(),
        duration_mins: durationMins,
        interviewer_name: interviewerName.trim() || undefined,
        video_call_url: videoCallUrl.trim() || undefined,
        proctoring_enabled: true,
      });

      setIsScheduledSuccess(true);
      toast.success(
        `Interview scheduled with ${candidate.name}! Notification sent in real-time.`,
        {
          description: `Scheduled for ${scheduledDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          duration: 6000,
        }
      );
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to schedule interview session.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200 scrollbar-thin scrollbar-thumb-slate-700">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors z-10 border border-slate-700"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-start gap-3.5 sm:gap-4 pr-12">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-br from-sky-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
            <span className="text-base sm:text-lg font-bold text-white tracking-wider">
              {candidate.avatar_initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {candidate.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 truncate mt-0.5">
              {[candidate.college, candidate.branch]
                .filter(Boolean)
                .join(" · ") || "Student Developer"}
            </p>
            {candidate.target_role && (
              <p className="text-xs mt-1 text-sky-400 font-medium truncate">
                Target Role:{" "}
                <span className="text-sky-300 font-semibold">
                  {candidate.target_role}
                </span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p
              className={`text-xl sm:text-2xl font-bold tracking-tight ${fitColor(
                candidate.ai_skill_fit_pct
              )}`}
            >
              {candidate.ai_skill_fit_pct}%
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
              SKILLS MATCH
            </p>
          </div>
        </div>

        {/* ── SCHEDULER VIEW ──────────────────────────────────────────────── */}
        {showScheduler ? (
          <div className="p-5 sm:p-6 pt-2 space-y-4">
            {isScheduledSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Interview Request Sent!
                </h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  The interview has been saved in real-time. {candidate.name} has
                  received a real-time notification and can view and prepare for
                  the session in their interview portal.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduler(false);
                      setIsScheduledSuccess(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-white/10 transition-colors"
                  >
                    Back to Profile
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-white transition-colors shadow-md shadow-sky-500/20"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmSchedule} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-bold text-white">
                      Schedule Official Interview
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Proctored Session
                  </span>
                </div>

                {/* Interview Type / Post Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Interview Type / Post Name
                    </label>
                    <span className="text-[10px] text-slate-400">Custom Position</span>
                  </div>
                  <div className="relative">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={interviewType}
                      onChange={(e) => setInterviewType(e.target.value)}
                      required
                      placeholder="e.g. Senior Backend Developer, AI Engineer, Full Stack Lead, Technical Round 1..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Write any job post, role title, or round type you wish to call the candidate for.
                  </p>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Date & Time
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Duration
                    </label>
                    <select
                      value={durationMins}
                      onChange={(e) => setDurationMins(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes (Standard)</option>
                      <option value={60}>60 Minutes (In-depth)</option>
                      <option value={90}>90 Minutes</option>
                    </select>
                  </div>
                </div>

                {/* Interviewer Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Interviewer Name / Title
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={interviewerName}
                      onChange={(e) => setInterviewerName(e.target.value)}
                      placeholder="e.g. Senior Tech Lead, Engineering Manager"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Video Call Link */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Video Meeting Link (Optional)
                  </label>
                  <div className="relative">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="url"
                      value={videoCallUrl}
                      onChange={(e) => setVideoCallUrl(e.target.value)}
                      placeholder="https://meet.google.com/... or Zoom link"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    If left blank, candidates will connect via the SkillDipz
                    proctored WebRTC interview room.
                  </p>
                </div>

                {/* Anti-cheat badge */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
                  <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>
                    Full proctoring enabled (tab-switch & fullscreen exit tracking).
                  </span>
                </div>

                {/* Submit & Cancel buttons */}
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduler(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-linear-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scheduling…
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5" />
                        Confirm & Schedule
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ── DEFAULT PROFILE VIEW ────────────────────────────────────────── */
          <>
            {/* Acquired Skills Portfolio */}
            <div className="mx-4 sm:mx-6 mb-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-850 border border-slate-750">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                ACQUIRED SKILLS PORTFOLIO
              </p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {displaySkills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800 text-slate-100 shadow-sm"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    {skill}
                  </span>
                ))}
              </div>

              {candidate.missing_skills.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2 mt-3.5">
                    SKILL GAPS
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {candidate.missing_skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Verified Contact Info */}
            <div className="mx-4 sm:mx-6 mb-5 p-3.5 sm:p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                VERIFIED CONTACT INFO
              </p>
              {candidate.phone ? (
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-100">
                  <Phone className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="font-medium">{candidate.phone}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Contact info hidden (student privacy setting is not public)
                </p>
              )}
              {candidate.email && (
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-200">
                  <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{candidate.email}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowScheduler(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-linear-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg shadow-sky-500/20 active:scale-[0.98] cursor-pointer"
              >
                <Calendar className="w-4 h-4 shrink-0" />
                Schedule Interview
              </button>

              {candidate.github ? (
                <a
                  href={
                    candidate.github.startsWith("http")
                      ? candidate.github
                      : `https://github.com/${candidate.github}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-white/10 transition-all duration-200 shadow-sm active:scale-[0.98]"
                >
                  <FaGithub className="w-4 h-4 shrink-0" />
                  Candidate GitHub
                </a>
              ) : (
                <button
                  disabled
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800/40 text-slate-500 text-xs sm:text-sm font-semibold border border-white/5 cursor-not-allowed"
                >
                  <FaGithub className="w-4 h-4 shrink-0" />
                  No GitHub
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
