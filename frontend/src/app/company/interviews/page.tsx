"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCompanyAuthStore } from "@/store/companyAuthStore";
import {
  getCompanyInterviews,
  evaluateCompanyInterview,
  submitInterviewTeamFeedback,
  addInterviewTimestampFeedback,
  fetchInterviewTimestampFeedbacks,
  deleteInterviewTimestampFeedback,
  type CompanyInterviewSession,
  type DetailedRubric,
  type FeedbackScores,
  type InterviewTimestampFeedbackItem,
  type TimestampCategory,
} from "@/lib/interviewApi";
import {
  Calendar,
  Clock,
  Video,
  User,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Briefcase,
  Users,
  Play,
  Film,
  Award,
  Sparkles,
  X,
  FileVideo,
  Sliders,
  Check,
  Bookmark,
  Plus,
  Trash2,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

function statusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return {
        label: "Scheduled",
        cls: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      };
    case "waiting":
      return {
        label: "Waiting (Joinable)",
        cls: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
      };
    case "in_progress":
      return {
        label: "In Progress",
        cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      };
    case "completed":
      return {
        label: "Completed",
        cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
      };
    case "terminated":
      return {
        label: "Terminated (Violation)",
        cls: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        cls: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      };
    default:
      return {
        label: status,
        cls: "bg-slate-800 text-slate-300 border-white/10",
      };
  }
}

export default function CompanyInterviewsPage() {
  const router = useRouter();
  const { user, _hasHydrated: userHydrated } = useAuthStore();
  const { company, _hasHydrated: companyHydrated } = useCompanyAuthStore();
  const [sessions, setSessions] = useState<CompanyInterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "recordings" | "scheduled" | "completed" | "terminated"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Video Recording Playback & Grading Modal State
  const [selectedVideoSession, setSelectedVideoSession] = useState<CompanyInterviewSession | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showGrading, setShowGrading] = useState(false);
  const [rubricScores, setRubricScores] = useState<FeedbackScores>({
    communication: 85,
    technical_knowledge: 80,
    confidence: 85,
    problem_solving: 80,
    answer_quality: 85,
    professionalism: 90,
  });
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [detailedFeedback, setDetailedFeedback] = useState("");
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  // Timestamped Feedback State
  const [timestamps, setTimestamps] = useState<InterviewTimestampFeedbackItem[]>([]);
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [showTimestampForm, setShowTimestampForm] = useState(false);
  const [newCategory, setNewCategory] = useState<TimestampCategory>("Technical");
  const [newComment, setNewComment] = useState("");
  const [submittingTimestamp, setSubmittingTimestamp] = useState(false);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  const formatSec = (s: number) => {
    const total = Math.max(0, Math.floor(s));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const loadTimestamps = useCallback(async (sessionId: string) => {
    try {
      const res = await fetchInterviewTimestampFeedbacks(sessionId);
      setTimestamps(res.timestamps || []);
    } catch {
      setTimestamps([]);
    }
  }, []);

  const handleOpenVideoModal = (session: CompanyInterviewSession) => {
    setSelectedVideoSession(session);
    setDetailedFeedback(session.feedback || "");
    setStrengths(session.rubric?.key_strengths?.join(", ") || "");
    setImprovements(session.rubric?.improvement_areas?.join(", ") || "");
    setRecommendations(session.rubric?.actionable_recommendations?.join(", ") || "");
    setShowTimestampForm(false);
    setNewComment("");
    loadTimestamps(session.session_id);

    if (session.rubric) {
      setRubricScores({
        communication: session.rubric.communication_clarity ?? 85,
        technical_knowledge: session.rubric.system_architecture ?? 80,
        confidence: 85,
        problem_solving: session.rubric.dsa_problem_solving ?? 80,
        answer_quality: session.rubric.code_quality ?? 85,
        professionalism: session.rubric.behavioral_culture_fit ?? 90,
      });
    } else {
      setRubricScores({
        communication: 85,
        technical_knowledge: 80,
        confidence: 85,
        problem_solving: 80,
        answer_quality: 85,
        professionalism: 90,
      });
    }
  };

  const handleAddTimestampFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoSession) return;
    if (!newComment.trim()) {
      toast.error("Please enter feedback comment for this timestamp.");
      return;
    }

    const captureSec = videoPlayerRef.current ? videoPlayerRef.current.currentTime : currentVideoTime;

    try {
      setSubmittingTimestamp(true);
      await addInterviewTimestampFeedback(selectedVideoSession.session_id, {
        timestamp_seconds: captureSec,
        category: newCategory,
        comment: newComment.trim(),
      });
      toast.success(`Timestamp feedback added at ${formatSec(captureSec)}!`);
      setNewComment("");
      setShowTimestampForm(false);
      loadTimestamps(selectedVideoSession.session_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add timestamp feedback.");
    } finally {
      setSubmittingTimestamp(false);
    }
  };

  const handleDeleteTimestamp = async (feedbackId: string) => {
    if (!selectedVideoSession) return;
    try {
      await deleteInterviewTimestampFeedback(selectedVideoSession.session_id, feedbackId);
      toast.success("Timestamp note deleted.");
      loadTimestamps(selectedVideoSession.session_id);
    } catch {
      toast.error("Failed to delete timestamp note.");
    }
  };

  const handleSeekToTimestamp = (sec: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = Math.max(0, sec);
      videoPlayerRef.current.play().catch(() => {});
    }
  };

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanyInterviews();
      setSessions(data.sessions ?? []);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to load scheduled interviews.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isHydrated = companyHydrated || userHydrated;
    const isAuthed = !!(company || user);
    if (isHydrated && isAuthed) {
      loadInterviews();
    }
  }, [companyHydrated, userHydrated, company, user, loadInterviews]);

  const filteredSessions = sessions.filter((s) => {
    if (activeFilter === "recordings" && !s.recording_url) {
      return false;
    }
    if (activeFilter === "scheduled" && s.status !== "scheduled" && s.status !== "waiting") {
      return false;
    }
    if (activeFilter === "completed" && s.status !== "completed") {
      return false;
    }
    if (activeFilter === "terminated" && s.status !== "terminated") {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (s.student_name || "").toLowerCase().includes(q);
      const matchEmail = (s.student_email || "").toLowerCase().includes(q);
      const matchCollege = (s.student_college || "").toLowerCase().includes(q);
      const matchRole = (s.target_role || "").toLowerCase().includes(q);
      return matchName || matchEmail || matchCollege || matchRole;
    }
    return true;
  });

  const recordingsCount = sessions.filter((s) => !!s.recording_url).length;

  // Hydration Skeleton 
  const isHydrated = companyHydrated || userHydrated;
  if (!isHydrated) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-6xl mx-auto space-y-6">
        <div className="h-10 w-64 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Derive video URL for modal
  const activeVideoUrl = selectedVideoSession?.recording_url
    ? selectedVideoSession.recording_url.startsWith("http")
      ? selectedVideoSession.recording_url
      : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${selectedVideoSession.recording_url}`
    : null;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/10">
            <Video className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Company Interview Portal & Recorded Videos
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Directory of scheduled candidate rounds, live meeting links, proctoring metrics, and candidate interview recordings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadInterviews}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/company/browse"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
          >
            <Users className="w-3.5 h-3.5" />
            Schedule More Candidates
          </Link>
        </div>
      </div>

      {/* 2. Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-white/10 w-fit overflow-x-auto">
          {[
            { key: "all", label: `All (${sessions.length})` },
            {
              key: "recordings",
              label: `🎥 Recorded Videos (${recordingsCount})`,
            },
            {
              key: "scheduled",
              label: `Scheduled (${
                sessions.filter((s) => s.status === "scheduled" || s.status === "waiting").length
              })`,
            },
            {
              key: "completed",
              label: `Completed (${sessions.filter((s) => s.status === "completed").length})`,
            },
            {
              key: "terminated",
              label: `Terminated (${sessions.filter((s) => s.status === "terminated").length})`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as typeof activeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === tab.key
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, role, college..."
            className="w-full bg-[#0e1117] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadInterviews}
            className="text-xs font-semibold underline hover:text-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. List Content */}
      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
          <p className="text-xs text-slate-400">Loading candidate interviews & recordings…</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-3xl bg-slate-900/40 border border-white/5 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            {searchQuery
              ? `No interviews matching "${searchQuery}"`
              : activeFilter === "recordings"
              ? "No Candidate Video Recordings Yet"
              : "No Interview Requests Yet"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeFilter === "recordings"
              ? "Recordings will appear here as soon as candidates complete their proctored technical rounds or mentor sessions."
              : "When you schedule an interview with candidates from Browse Candidates or Student Database, the requests will appear here in real time."}
          </p>
          <Link
            href="/company/browse"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-white transition-colors mt-2"
          >
            Browse Candidates
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map((session) => {
            const badge = statusBadge(session.status);
            const scheduledDate = session.scheduled_at
              ? new Date(session.scheduled_at)
              : null;
            const hasRecording = !!session.recording_url;

            return (
              <div
                key={session.session_id}
                className="p-5 rounded-2xl bg-[#0e1117] border border-white/10 hover:border-sky-500/30 transition-all space-y-4 shadow-lg shadow-black/20 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top: Candidate info & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {session.student_name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {session.student_college || session.student_email || "Student Candidate"}
                      </p>
                      {session.target_role && (
                        <span className="inline-block mt-1 text-[11px] font-semibold text-sky-400">
                          {session.target_role}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      {hasRecording && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center gap-1">
                          <Film className="w-3 h-3 text-purple-400" />
                          <span>Video Saved</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-white/5">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Round Type
                      </span>
                      <span className="font-semibold text-slate-200 capitalize">
                        {session.interview_type} Round
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Duration
                      </span>
                      <span className="font-semibold text-slate-200">
                        {session.duration_mins} Minutes
                      </span>
                    </div>

                    <div className="col-span-2 space-y-1 pt-1 border-t border-white/5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Date & Time
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>
                          {scheduledDate
                            ? scheduledDate.toLocaleString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "TBD"}
                        </span>
                      </div>
                    </div>

                    {session.interviewer_name && (
                      <div className="col-span-2 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Interviewer
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{session.interviewer_name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {hasRecording ? (
                      <button
                        type="button"
                        onClick={() => handleOpenVideoModal(session)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Video</span>
                      </button>
                    ) : session.video_call_url ? (
                      <a
                        href={session.video_call_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Open Meeting</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        Proctored Session
                      </span>
                    )}
                  </div>

                  {session.overall_score != null && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-emerald-400" />
                        {Math.round(session.overall_score)}% Score
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. CANDIDATE VIDEO RECORDING PLAYBACK MODAL */}
      <AnimatePresence>
        {selectedVideoSession && activeVideoUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0f19] border border-white/15 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0b0f19]/95 backdrop-blur-xl z-20">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Film className="w-3 h-3" /> Recorded Video
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {selectedVideoSession.student_name} — {selectedVideoSession.interview_type.toUpperCase()} Round
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    Candidate: {selectedVideoSession.student_email} · {selectedVideoSession.student_college || "Student Candidate"}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedVideoSession(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Embedded Video Player */}
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video max-h-[420px] flex items-center justify-center">
                    <video
                      ref={videoPlayerRef}
                      src={activeVideoUrl}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                      onTimeUpdate={(e) => setCurrentVideoTime((e.target as HTMLVideoElement).currentTime)}
                    />
                  </div>

                  {/* Player Controls & Video Info */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs">
                    <div className="flex items-center gap-3 text-slate-300">
                      <span className="flex items-center gap-1 text-purple-400 font-semibold">
                        <FileVideo className="w-4 h-4" /> Proctored Video Capture
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono font-bold">
                        Time: {formatSec(currentVideoTime)}
                      </span>
                      {selectedVideoSession.recording_duration_sec && (
                        <span className="text-slate-400">
                          Duration: <strong className="text-white">{Math.round(selectedVideoSession.recording_duration_sec)}s</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (videoPlayerRef.current) {
                            videoPlayerRef.current.pause();
                          }
                          setShowTimestampForm(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Feedback at {formatSec(currentVideoTime)}</span>
                      </button>

                      <a
                        href={activeVideoUrl}
                        download={`candidate_${selectedVideoSession.student_name}_interview.webm`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Raw Video</span>
                      </a>
                    </div>
                  </div>

                  {/* Add Timestamp Feedback Form */}
                  {showTimestampForm && (
                    <form
                      onSubmit={handleAddTimestampFeedback}
                      className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                          <Bookmark className="w-4 h-4 text-indigo-400" />
                          Add Timestamped Note at <span className="font-mono text-white font-black">{formatSec(currentVideoTime)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTimestampForm(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                            Category
                          </label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value as TimestampCategory)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-semibold"
                          >
                            <option value="Communication">Communication</option>
                            <option value="Technical">Technical</option>
                            <option value="Confidence">Confidence</option>
                            <option value="Problem Solving">Problem Solving</option>
                            <option value="Answer Quality">Answer Quality</option>
                            <option value="Body Language">Body Language</option>
                            <option value="Positive">Positive</option>
                            <option value="Improvement">Improvement</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                            Feedback Comment
                          </label>
                          <input
                            type="text"
                            required
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="e.g. Strong technical explanation or Long pause before answering"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowTimestampForm(false)}
                          className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingTimestamp}
                          className="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {submittingTimestamp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Save Timestamp Note</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Timestamped Notes Timeline List */}
                  {timestamps.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                        Timestamped Review Notes ({timestamps.length})
                      </h4>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {timestamps.map((ts) => (
                          <div
                            key={ts.feedback_id}
                            className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-between gap-3 text-xs group"
                          >
                            <div
                              onClick={() => handleSeekToTimestamp(ts.timestamp_seconds)}
                              className="flex items-center gap-2.5 cursor-pointer flex-1"
                            >
                              <span className="px-2 py-0.5 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 font-mono font-bold flex items-center gap-1 group-hover:bg-purple-600 group-hover:text-white transition">
                                <Play className="w-2.5 h-2.5 fill-current" />
                                {ts.formatted_timestamp}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                {ts.category}
                              </span>
                              <span className="text-slate-200 font-medium">{ts.comment}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteTimestamp(ts.feedback_id)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Candidate Assessment & Rubric / Grading Form */}
                <div className="space-y-4 p-5 rounded-2xl bg-slate-900/60 border border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-400" />
                      5-Factor Competency Rubric & Evaluation
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowGrading(!showGrading)}
                      className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{showGrading ? "View Summary" : "Grade Candidate / Edit Rubric"}</span>
                    </button>
                  </div>

                  {showGrading ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!selectedVideoSession) return;
                        if (!detailedFeedback.trim()) {
                          toast.error("Please provide detailed assessment feedback for the candidate.");
                          return;
                        }
                        try {
                          setSavingEvaluation(true);
                          await submitInterviewTeamFeedback(selectedVideoSession.session_id, {
                            scores: rubricScores,
                            strengths: strengths.trim(),
                            improvements: improvements.trim(),
                            recommendations: recommendations.trim(),
                            detailed_feedback: detailedFeedback.trim(),
                          });
                          toast.success("Candidate team evaluation saved successfully!");
                          setShowGrading(false);
                          loadInterviews();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.detail || "Failed to save evaluation.");
                        } finally {
                          setSavingEvaluation(false);
                        }
                      }}
                      className="space-y-4 pt-2"
                    >
                      {/* 6 Competency Factor Sliders */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/80 p-4 rounded-2xl border border-white/5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-300">1. Communication</span>
                            <span className="font-black text-sky-400">{rubricScores.communication}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rubricScores.communication}
                            onChange={(e) => setRubricScores({ ...rubricScores, communication: Number(e.target.value) })}
                            className="w-full accent-sky-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-300">2. Technical Knowledge</span>
                            <span className="font-black text-indigo-400">{rubricScores.technical_knowledge}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rubricScores.technical_knowledge}
                            onChange={(e) => setRubricScores({ ...rubricScores, technical_knowledge: Number(e.target.value) })}
                            className="w-full accent-indigo-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-300">3. Confidence</span>
                            <span className="font-black text-purple-400">{rubricScores.confidence}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rubricScores.confidence}
                            onChange={(e) => setRubricScores({ ...rubricScores, confidence: Number(e.target.value) })}
                            className="w-full accent-purple-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-300">4. Problem Solving</span>
                            <span className="font-black text-emerald-400">{rubricScores.problem_solving}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rubricScores.problem_solving}
                            onChange={(e) => setRubricScores({ ...rubricScores, problem_solving: Number(e.target.value) })}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-300">5. Answer Quality</span>
                            <span className="font-black text-amber-400">{rubricScores.answer_quality}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rubricScores.answer_quality}
                            onChange={(e) => setRubricScores({ ...rubricScores, answer_quality: Number(e.target.value) })}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-300">6. Professionalism</span>
                            <span className="font-black text-rose-400">{rubricScores.professionalism}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rubricScores.professionalism}
                            onChange={(e) => setRubricScores({ ...rubricScores, professionalism: Number(e.target.value) })}
                            className="w-full accent-rose-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Calculated Overall Score Preview */}
                      <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-indigo-400" />
                          Auto-Calculated Overall Score:
                        </span>
                        <span className="text-base font-black text-white">
                          {Math.round(
                            (rubricScores.communication +
                              rubricScores.technical_knowledge +
                              rubricScores.confidence +
                              rubricScores.problem_solving +
                              rubricScores.answer_quality +
                              rubricScores.professionalism) /
                              6
                          )}
                          %
                        </span>
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] font-bold text-emerald-400 uppercase block mb-1">
                            Key Strengths Observed
                          </label>
                          <textarea
                            rows={2}
                            value={strengths}
                            onChange={(e) => setStrengths(e.target.value)}
                            placeholder="e.g. Excellent domain knowledge in distributed architectures."
                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-amber-400 uppercase block mb-1">
                            Areas to Improve
                          </label>
                          <textarea
                            rows={2}
                            value={improvements}
                            onChange={(e) => setImprovements(e.target.value)}
                            placeholder="e.g. Practice structured thinking for edge cases."
                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs"
                          />
                        </div>
                      </div>

                      {/* Recommendations & Detailed Feedback */}
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-[11px] font-bold text-indigo-400 uppercase block mb-1">
                            Actionable Recommendations
                          </label>
                          <textarea
                            rows={2}
                            value={recommendations}
                            onChange={(e) => setRecommendations(e.target.value)}
                            placeholder="e.g. Recommended next steps or specific courses to prepare."
                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                            Detailed Interviewer Feedback *
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={detailedFeedback}
                            onChange={(e) => setDetailedFeedback(e.target.value)}
                            placeholder="Comprehensive assessment of candidate answers and overall performance..."
                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => setShowGrading(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingEvaluation}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                        >
                          {savingEvaluation ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Submit Official Feedback</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">1. Communication</span>
                          <span className="text-base font-black text-sky-400">
                            {Math.round(selectedVideoSession.rubric?.communication_clarity ?? rubricScores.communication)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">2. Technical Knowledge</span>
                          <span className="text-base font-black text-indigo-400">
                            {Math.round(selectedVideoSession.rubric?.system_architecture ?? rubricScores.technical_knowledge)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">3. Confidence</span>
                          <span className="text-base font-black text-purple-400">
                            {Math.round(rubricScores.confidence)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">4. Problem Solving</span>
                          <span className="text-base font-black text-emerald-400">
                            {Math.round(selectedVideoSession.rubric?.dsa_problem_solving ?? rubricScores.problem_solving)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">5. Answer Quality</span>
                          <span className="text-base font-black text-amber-400">
                            {Math.round(selectedVideoSession.rubric?.code_quality ?? rubricScores.answer_quality)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold">6. Professionalism</span>
                          <span className="text-base font-black text-rose-400">
                            {Math.round(selectedVideoSession.rubric?.behavioral_culture_fit ?? rubricScores.professionalism)}%
                          </span>
                        </div>
                      </div>

                      {selectedVideoSession.feedback && (
                        <div className="pt-3 border-t border-white/5">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Evaluator Feedback</span>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{selectedVideoSession.feedback}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
