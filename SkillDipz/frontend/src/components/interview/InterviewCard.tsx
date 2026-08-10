"use client";

import { InterviewSession } from "@/lib/interviewApi";
import {
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Play,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

interface InterviewCardProps {
  session: InterviewSession;
  onJoin: (session: InterviewSession) => void;
  onViewResult: (session: InterviewSession) => void;
}

export default function InterviewCard({
  session,
  onJoin,
  onViewResult,
}: InterviewCardProps) {
  const isAI = session.mode === "ai";
  const isCompleted = session.status === "completed";
  const isTerminated = session.status === "terminated";
  const isJoinable =
    session.status === "scheduled" ||
    session.status === "waiting" ||
    session.status === "in_progress";

  const getStatusBadge = () => {
    switch (session.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse">
            <Play className="w-3.5 h-3.5" /> In Progress
          </span>
        );
      case "waiting":
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Scheduled
          </span>
        );
      case "terminated":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-3.5 h-3.5" /> Terminated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3.5 h-3.5" /> {session.status}
          </span>
        );
    }
  };

  const formattedDate = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date(session.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <div className="bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 shadow-xl backdrop-blur-xl group">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm transition-all ${
              isAI
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                : "bg-sky-500/10 border-sky-500/30 text-sky-400"
            }`}
          >
            {session.company_name ? (
              <span className="uppercase text-xs font-black tracking-wider text-slate-200">
                {session.company_name.slice(0, 2)}
              </span>
            ) : isAI ? (
              <Bot className="w-5 h-5" />
            ) : (
              <Building2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base leading-snug">
                {session.company_name || "SkillDipz Mock Interview"}
              </h3>
            </div>
            <p className="text-xs text-slate-400 capitalize flex items-center gap-1.5 mt-0.5">
              <span>{session.interview_type} Interview</span>
              <span>•</span>
              <span>{session.duration_mins} Mins</span>
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Middle Details */}
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            {formattedDate}
          </span>
          <span className="capitalize text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-800/60 border border-white/5">
            {isAI ? "AI Simulated" : "Company Live"}
          </span>
        </div>

        {session.interviewer_name && (
          <p className="text-xs text-slate-300">
            Interviewer:{" "}
            <span className="font-medium text-white">
              {session.interviewer_name}
            </span>
          </p>
        )}

        {/* Score Badge if completed */}
        {isCompleted && session.overall_score !== undefined && session.overall_score !== null && (
          <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Overall Performance
            </span>
            <span className="text-sm font-extrabold text-emerald-400">
              {session.overall_score.toFixed(0)} / 100
            </span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-end">
        {isCompleted && (
          <button
            onClick={() => onViewResult(session)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-violet-400" /> View Feedback & Transcript
          </button>
        )}

        {!isAI && isJoinable && (
          <button
            onClick={() => onJoin(session)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Join Interview Call
          </button>
        )}

        {isTerminated && (
          <p className="text-xs text-red-400/90 font-medium italic">
            Terminated due to proctoring violation.
          </p>
        )}
      </div>
    </div>
  );
}
