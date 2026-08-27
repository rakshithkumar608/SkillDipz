"use client";

import { useEffect, useState, useRef } from "react";
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
  UserCheck,
  Play,
  Bookmark,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import {
  DetailedRubric,
  fetchInterviewFeedback,
  fetchInterviewTimestampFeedbacks,
  InterviewFeedbackData,
  InterviewTimestampFeedbackItem,
  TimestampCategory,
} from "@/lib/interviewApi";
import {
  analyzePerformanceForMentorship,
  MentorRecommendationResult,
} from "@/lib/mentorRecommendation";

export interface MentorFilterContext {
  weaknessLabels: string[];
  searchTags: string[];
  reason: string;
  summary: string;
}

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
  onBookMentor?: (filterContext?: MentorFilterContext) => void;
}

const CATEGORY_STYLES: Record<TimestampCategory, { bg: string; text: string; border: string }> = {
  Communication: { bg: "bg-sky-500/15", text: "text-sky-300", border: "border-sky-500/30" },
  Technical: { bg: "bg-indigo-500/15", text: "text-indigo-300", border: "border-indigo-500/30" },
  Confidence: { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/30" },
  "Problem Solving": { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  "Answer Quality": { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30" },
  "Body Language": { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30" },
  Positive: { bg: "bg-teal-500/15", text: "text-teal-300", border: "border-teal-500/30" },
  Improvement: { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/30" },
};

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
  const [timestampNotes, setTimestampNotes] = useState<InterviewTimestampFeedbackItem[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [serverRecordingUrl, setServerRecordingUrl] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      setLoadingFeedback(true);
      Promise.all([
        fetchInterviewFeedback(sessionId).catch(() => ({
          status: "PENDING" as const,
          message: "Unable to load feedback",
          feedback: undefined,
          recording_url: null,
        })),
        fetchInterviewTimestampFeedbacks(sessionId).catch(() => ({
          interview_id: sessionId,
          total: 0,
          timestamps: [],
        })),
      ])
        .then(([fbRes, tsRes]) => {
          if (fbRes.status === "SUBMITTED" && fbRes.feedback) {
            setTeamFeedback(fbRes.feedback);
            setIsPending(false);
          } else {
            setIsPending(true);
            setTeamFeedback(null);
          }
          if (fbRes.recording_url) {
            setServerRecordingUrl(fbRes.recording_url);
          }
          if (tsRes && tsRes.timestamps) {
            setTimestampNotes(tsRes.timestamps);
          }
        })
        .finally(() => {
          setLoadingFeedback(false);
        });
    } else {
      setTeamFeedback(null);
      setTimestampNotes([]);
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

  const displayScore = teamFeedback ? teamFeedback.overall_score : initialOverallScore;

  // Real Performance Weakness Analysis
  const mentorRecommendation: MentorRecommendationResult = analyzePerformanceForMentorship(
    teamFeedback ? teamFeedback.scores : null,
    rubric,
    displayScore
  );

  const handleJumpToTimestamp = (sec: number) => {
    setActiveTab("recording");
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, sec);
        videoRef.current.play().catch(() => {});
      }
    }, 150);
  };

  const handleTriggerMentorFind = () => {
    onClose();
    if (onBookMentor) {
      if (mentorRecommendation.isRecommended) {
        onBookMentor({
          weaknessLabels: mentorRecommendation.weaknesses.map((w) => w.label),
          searchTags: mentorRecommendation.searchTags,
          reason: mentorRecommendation.reason,
          summary: mentorRecommendation.filterSummary,
        });
      } else {
        onBookMentor(undefined);
      }
    }
  };

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
        <div className="relative p-6 sm:p-8 bg-linear-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800">
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
              <div className="w-16 h-16 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center text-white shadow-lg">
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
                <Video className="w-4 h-4 inline mr-1.5" /> Video Recording & Timestamps
                {timestampNotes.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-bold">
                    {timestampNotes.length}
                  </span>
                )}
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
              {/* ─── REAL MENTOR RECOMMENDATION CONNECTION ───────────────────── */}
              {mentorRecommendation.isRecommended && (
                <div className="p-6 rounded-3xl bg-linear-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          Personalized Recommendation
                        </span>
                        <span className="text-xs text-slate-400">
                          Based on performance analysis
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        1-to-1 Mentoring Recommended
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                        {mentorRecommendation.reason}
                      </p>
                    </div>

                    <button
                      onClick={handleTriggerMentorFind}
                      className="px-5 py-3 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 shrink-0 transition"
                    >
                      <Users className="w-4 h-4" />
                      <span>Find a Mentor</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Weakness Score Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-500/15">
                    <span className="text-[11px] text-slate-400 font-medium">Areas needing focus:</span>
                    {mentorRecommendation.weaknesses.map((w) => (
                      <span
                        key={w.key}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-200 border border-purple-500/30 flex items-center gap-1.5"
                      >
                        <span>{w.label}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-purple-900/60 text-purple-300 text-[10px] font-mono">
                          {Math.round(w.score)}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

                  {/* Timestamp Highlights Preview */}
                  {timestampNotes.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-purple-400" />
                        Timestamped Video Review Notes ({timestampNotes.length})
                      </h4>
                      <div className="space-y-2">
                        {timestampNotes.map((note) => {
                          const style = CATEGORY_STYLES[note.category] || CATEGORY_STYLES.Technical;
                          return (
                            <div
                              key={note.feedback_id}
                              onClick={() => handleJumpToTimestamp(note.timestamp_seconds)}
                              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 cursor-pointer flex items-center justify-between gap-3 group transition"
                            >
                              <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-mono font-bold text-xs flex items-center gap-1 group-hover:bg-purple-600 group-hover:text-white transition">
                                  <Play className="w-3 h-3 fill-current" />
                                  {note.formatted_timestamp}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                                  {note.category}
                                </span>
                                <span className="text-xs text-slate-200 font-medium">{note.comment}</span>
                              </div>
                              <span className="text-[10px] text-purple-400 font-semibold opacity-0 group-hover:opacity-100 transition shrink-0">
                                Jump to video ➔
                              </span>
                            </div>
                          );
                        })}
                      </div>
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
            /* Tab 2: Recording Playback with Interactive Timestamps */
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video max-h-[420px] flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTimeSec((e.target as HTMLVideoElement).currentTime)}
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
                      onClick={() => {
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                      }}
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

              {/* Timestamp Feedbacks List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-purple-400" />
                  Reviewer Timestamped Feedback & Notes ({timestampNotes.length})
                </h4>

                {timestampNotes.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                    No specific timestamp notes added by the reviewer yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timestampNotes.map((note) => {
                      const style = CATEGORY_STYLES[note.category] || CATEGORY_STYLES.Technical;
                      const isCurrent = Math.abs(currentTimeSec - note.timestamp_seconds) < 3;
                      return (
                        <div
                          key={note.feedback_id}
                          onClick={() => handleJumpToTimestamp(note.timestamp_seconds)}
                          className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 transition ${
                            isCurrent
                              ? "bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-500/10"
                              : "bg-slate-950/80 border-slate-800 hover:border-purple-500/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-mono font-bold text-xs flex items-center gap-1.5 hover:bg-purple-600 hover:text-white transition shrink-0">
                              <Play className="w-3 h-3 fill-current" />
                              {note.formatted_timestamp}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${style.bg} ${style.text} ${style.border}`}>
                              {note.category}
                            </span>
                            <span className="text-xs text-slate-200 font-medium leading-relaxed">
                              {note.comment}
                            </span>
                          </div>
                          <span className="text-[10px] text-purple-400 font-bold shrink-0">
                            Jump ➔
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                onClick={handleTriggerMentorFind}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition"
              >
                <Users className="w-4 h-4" />
                {mentorRecommendation.isRecommended ? "Find a Mentor" : "Book 1-on-1 Mentor Follow-up"}
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
