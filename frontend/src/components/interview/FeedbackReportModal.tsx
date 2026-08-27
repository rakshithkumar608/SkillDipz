"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Video,
  FileText,
  X,
  Zap,
  Users,
  ShieldCheck,
  Loader2,
  Clock,
  Briefcase,
  UserCheck,
} from "lucide-react";
import {
  DetailedRubric,
  fetchInterviewFeedback,
  InterviewFeedbackData,
} from "@/lib/interviewApi";

interface FeedbackReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
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
  sessionId,
  overallScore: initialOverallScore,
  companyName = "SkillDipz Assessment",
  interviewType = "Technical Assessment",
  feedback: initialFeedback,
  rubric,
  recordingUrl: initialRecordingUrl,
  recordedBlob,
  transcript,
  conversation,
  onBookMentor,
}: FeedbackReportModalProps) {
  const [activeTab, setActiveTab] = useState<"rubric" | "recording" | "transcript">("rubric");
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<InterviewFeedbackData | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [serverRecordingUrl, setServerRecordingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      setLoadingFeedback(true);
      fetchInterviewFeedback(sessionId)
        .then((res) => {
          if (res.status === "SUBMITTED" && res.feedback) {
            setTeamFeedback(res.feedback);
            setIsPending(false);
          } else {
            setIsPending(true);
            setTeamFeedback(null);
          }
          if (res.recording_url) {
            setServerRecordingUrl(res.recording_url);
          }
        })
        .catch((err) => {
          console.warn("Could not load team feedback:", err);
          setIsPending(false);
        })
        .finally(() => {
          setLoadingFeedback(false);
        });
    } else {
      setTeamFeedback(null);
      setIsPending(false);
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const resolvedRecordingUrl = serverRecordingUrl || initialRecordingUrl;
  const videoSrc = resolvedRecordingUrl
    ? resolvedRecordingUrl.startsWith("http")
      ? resolvedRecordingUrl
      : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${resolvedRecordingUrl}`
    : recordedBlob
    ? URL.createObjectURL(recordedBlob)
    : null;

  // Derive score to display
  const displayScore = teamFeedback ? teamFeedback.overall_score : initialOverallScore;

  const getScoreBadge = (s: number) => {
    if (s >= 85) return { text: "Top 1% Ready", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
    if (s >= 75) return { text: "Industry Ready", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
    if (s >= 60) return { text: "Skilled Practitioner", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" };
    if (s > 0) return { text: "Emerging Candidate", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" };
    return { text: "Session Completed", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  };

  const badge = getScoreBadge(displayScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-[#0b0f19] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header Ribbon */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Assessment Report
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                  {badge.text}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {companyName}
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                {interviewType} · Proctored Mock Session
              </p>
              {teamFeedback && (
                <p className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5 pt-1">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    Evaluated by {teamFeedback.reviewer_name} ({teamFeedback.reviewer_role})
                  </span>
                </p>
              )}
            </div>

            {/* Overall Score Dial */}
            <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-700/60 rounded-2xl p-4 shrink-0 shadow-lg">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center text-white shadow-lg">
                <span className="text-2xl font-black">{Math.round(displayScore)}</span>
                <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">/ 100</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Evaluation Index</p>
                <p className="text-sm font-bold text-white">Overall Score</p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-semibold">
                  <Zap className="w-3 h-3" /> +150 XP Awarded
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-6 border-b border-slate-800 -mb-6 pb-2">
            <button
              onClick={() => setActiveTab("rubric")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "rubric"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Award className="w-4 h-4 inline mr-1.5" /> Core Feedback & Scores
            </button>
            {videoSrc && (
              <button
                onClick={() => setActiveTab("recording")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "transcript"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1.5" /> Transcript & Dialogue
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[65vh] overflow-y-auto">
          {loadingFeedback ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading verified feedback from database...</p>
            </div>
          ) : activeTab === "rubric" ? (
            /* Tab 1: Rubric & Real Scores */
            <div className="space-y-6">
              {/* If Feedback is Pending */}
              {isPending && !teamFeedback && !rubric ? (
                <div className="p-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
                  <Clock className="w-10 h-10 text-amber-400 mx-auto" />
                  <h3 className="text-sm sm:text-base font-bold text-amber-300">
                    Your interviewer hasn&apos;t submitted feedback yet.
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    The interviewer has been notified to review your session recording and score your 6 core competencies. Please check back shortly.
                  </p>
                </div>
              ) : teamFeedback ? (
                /* Real Submitted Team / Interviewer Feedback */
                <div className="space-y-6">
                  {/* Detailed Written Feedback */}
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Detailed Interviewer Assessment
                    </h4>
                    <p className="text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {teamFeedback.detailed_feedback}
                    </p>
                  </div>

                  {/* 6 Core Competency Factor Scores */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      6 Core Competency Factor Scores
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { label: "1. Communication", val: teamFeedback.scores.communication, color: "text-sky-400", bar: "bg-sky-500" },
                        { label: "2. Technical Knowledge", val: teamFeedback.scores.technical_knowledge, color: "text-indigo-400", bar: "bg-indigo-500" },
                        { label: "3. Confidence", val: teamFeedback.scores.confidence, color: "text-purple-400", bar: "bg-purple-500" },
                        { label: "4. Problem Solving", val: teamFeedback.scores.problem_solving, color: "text-emerald-400", bar: "bg-emerald-500" },
                        { label: "5. Answer Quality", val: teamFeedback.scores.answer_quality, color: "text-amber-400", bar: "bg-amber-500" },
                        { label: "6. Professionalism", val: teamFeedback.scores.professionalism, color: "text-rose-400", bar: "bg-rose-500" },
                      ].map((item, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-300">{item.label}</span>
                            <span className={`font-black ${item.color}`}>{Math.round(item.val)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${item.bar} rounded-full`} style={{ width: `${item.val}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Key Strengths Observed
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {teamFeedback.strengths || "Candidate showed high proficiency in fundamentals."}
                      </p>
                    </div>

                    {/* Improvements */}
                    <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Areas to Improve
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {teamFeedback.improvements || "Focus on edge-case validation and structured design articulation."}
                      </p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {teamFeedback.recommendations && (
                    <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-2">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Interviewer Recommendations & Action Plan
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {teamFeedback.recommendations}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback Rubric View for AI Practices */
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1.5">
                      Session Evaluation
                    </p>
                    <p className="text-slate-200 text-sm leading-relaxed">{initialFeedback}</p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "recording" && videoSrc ? (
            /* Tab 2: Recording Playback */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video max-h-[420px] flex items-center justify-center">
                <video
                  src={videoSrc}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-purple-400" />
                  Proctored Session Video Recording
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
          ) : (
            /* Tab 3: Transcript */
            <div className="space-y-4">
              {conversation && conversation.length > 0 ? (
                <div className="space-y-3">
                  {conversation.map((turn, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl text-sm ${
                        turn.role === "ai"
                          ? "bg-slate-900/90 border border-indigo-500/20 text-slate-200"
                          : "bg-indigo-950/20 border border-indigo-500/30 text-indigo-100 ml-4"
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
