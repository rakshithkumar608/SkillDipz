"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Video,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  RotateCcw,
  Zap,
  Users,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { DetailedRubric } from "@/lib/interviewApi";

interface FeedbackReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  overallScore: number;
  companyName?: string;
  interviewType?: string;
  feedback?: string;
  rubric?: DetailedRubric | null;
  recordingUrl?: string | null;
  recordedBlob?: Blob | null;
  transcript?: string | null;
  conversation?: { role: string; content: string }[];
  onBookMentor?: () => void;
}

export default function FeedbackReportModal({
  isOpen,
  onClose,
  overallScore,
  companyName = "SkillDipz AI Assessment",
  interviewType = "Technical Assessment",
  feedback = "Solid technical articulation and structure demonstrated across questions.",
  rubric,
  recordingUrl,
  recordedBlob,
  transcript,
  conversation,
  onBookMentor,
}: FeedbackReportModalProps) {
  const [activeTab, setActiveTab] = useState<"rubric" | "recording" | "transcript">("rubric");
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showTranscript, setShowTranscript] = useState(false);

  if (!isOpen) return null;

  // Derive video source URL
  const videoSrc = recordingUrl
    ? recordingUrl.startsWith("http")
      ? recordingUrl
      : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${recordingUrl}`
    : recordedBlob
    ? URL.createObjectURL(recordedBlob)
    : null;

  const hasRubric = !!rubric && (
    rubric.dsa_problem_solving != null ||
    rubric.system_architecture != null ||
    rubric.behavioral_culture_fit != null ||
    rubric.code_quality != null ||
    rubric.communication_clarity != null
  );

  const rubricFactors = hasRubric
    ? [
        {
          title: "DSA & Problem Solving",
          score: rubric?.dsa_problem_solving ?? null,
          color: "bg-sky-500",
          text: "text-sky-400",
          bg: "bg-sky-500/10",
          border: "border-sky-500/20",
        },
        {
          title: "System Architecture & Design",
          score: rubric?.system_architecture ?? null,
          color: "bg-purple-500",
          text: "text-purple-400",
          bg: "bg-purple-500/10",
          border: "border-purple-500/20",
        },
        {
          title: "Behavioral & Culture Fit",
          score: rubric?.behavioral_culture_fit ?? null,
          color: "bg-emerald-500",
          text: "text-emerald-400",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
        },
        {
          title: "Code Quality & Engineering Standards",
          score: rubric?.code_quality ?? null,
          color: "bg-amber-500",
          text: "text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
        },
        {
          title: "Communication & Articulation",
          score: rubric?.communication_clarity ?? null,
          color: "bg-rose-500",
          text: "text-rose-400",
          bg: "bg-rose-500/10",
          border: "border-rose-500/20",
        },
      ].filter((f) => f.score !== null)
    : [];

  const getScoreBadge = (s: number) => {
    if (s >= 85) return { text: "Top 1% Ready", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
    if (s >= 75) return { text: "Industry Ready", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
    if (s >= 60) return { text: "Skilled Practitioner", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" };
    if (s > 0) return { text: "Emerging Candidate", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" };
    return { text: "Session Completed", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  };

  const badge = getScoreBadge(overallScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header Ribbon */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Assessment Report
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                  {badge.text}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {companyName}
              </h2>
              <p className="text-slate-400 text-sm">{interviewType} · Proctored Mock Session</p>
            </div>

            {/* Overall Score Dial */}
            <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-700/60 rounded-2xl p-4 shrink-0">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex flex-col items-center justify-center text-white shadow-lg">
                <span className="text-2xl font-black">{Math.round(overallScore)}</span>
                <span className="text-[10px] uppercase font-bold text-sky-200 tracking-wider">/ 100</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Career Readiness</p>
                <p className="text-sm font-semibold text-white">Score Index</p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Zap className="w-3 h-3" /> +150 XP Awarded
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-6 border-b border-slate-800 -mb-6 pb-2">
            <button
              onClick={() => setActiveTab("rubric")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === "rubric"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Award className="w-4 h-4 inline mr-1.5" /> 5-Factor Rubric & Feedback
            </button>
            {videoSrc && (
              <button
                onClick={() => setActiveTab("recording")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "recording"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Video className="w-4 h-4 inline mr-1.5" /> Video Recording Playback
              </button>
            )}
            <button
              onClick={() => setActiveTab("transcript")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === "transcript"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1.5" /> Transcript & Answers
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[65vh] overflow-y-auto">
          {activeTab === "rubric" && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1.5">
                  Executive Evaluation
                </p>
                <p className="text-slate-200 text-sm leading-relaxed">{feedback}</p>
              </div>

              {/* 5-Factor Matrix */}
              {rubricFactors.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    Competency Rubric Matrix
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rubricFactors.map((factor, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border ${factor.bg} ${factor.border} flex flex-col justify-between gap-2`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-200">{factor.title}</span>
                          <span className={`font-bold ${factor.text}`}>{factor.score}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${factor.score}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                            className={`h-full ${factor.color} rounded-full`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Key Strengths & Improvements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Key Strengths
                  </h4>
                  {rubric?.key_strengths && rubric.key_strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {rubric.key_strengths.map((str, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No specific strengths recorded.</p>
                  )}
                </div>

                {/* Improvements */}
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2.5">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Areas to Elevate
                  </h4>
                  {rubric?.improvement_areas && rubric.improvement_areas.length > 0 ? (
                    <ul className="space-y-2">
                      {rubric.improvement_areas.map((imp, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No improvement points recorded.</p>
                  )}
                </div>
              </div>

              {/* Actionable Recommendations */}
              {rubric?.actionable_recommendations && rubric.actionable_recommendations.length > 0 && (
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2.5">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Recommended Action Plan
                  </h4>
                  <div className="space-y-2">
                    {rubric.actionable_recommendations.map((rec, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-900/60 border border-indigo-500/10 text-xs text-slate-200 flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recording Playback Tab */}
          {activeTab === "recording" && videoSrc && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video max-h-[420px] flex items-center justify-center">
                <video
                  src={videoSrc}
                  controls
                  className="w-full h-full object-contain"
                  playbackRate={playbackRate}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-purple-400" />
                  Session Proctored Audio/Video Capture
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 mr-1">Speed:</span>
                  {[1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        playbackRate === rate
                          ? "bg-purple-500 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transcript Tab */}
          {activeTab === "transcript" && (
            <div className="space-y-4">
              {conversation && conversation.length > 0 ? (
                <div className="space-y-3">
                  {conversation.map((turn, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl text-sm ${
                        turn.role === "ai"
                          ? "bg-slate-900/90 border border-sky-500/20 text-slate-200"
                          : "bg-sky-950/20 border border-sky-500/30 text-sky-100 ml-4"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        {turn.role === "ai" ? "🤖 AI Interviewer" : "👤 Your Answer"}
                      </span>
                      <p className="leading-relaxed whitespace-pre-wrap">{turn.content}</p>
                    </div>
                  ))}
                </div>
              ) : transcript ? (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {transcript}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No transcript available for this session.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-900/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Performance synced to your Career Readiness profile.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onBookMentor && (
              <button
                onClick={() => {
                  onClose();
                  onBookMentor();
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition"
              >
                <Users className="w-4 h-4" /> Book 1-on-1 Mentor Follow-up
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
