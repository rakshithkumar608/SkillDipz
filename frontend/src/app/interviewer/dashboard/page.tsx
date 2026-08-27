"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";
import {
  AssignedInterviewSession,
  DetailedRubric,
  fetchInterviewerInterviews,
  submitInterviewTeamFeedback,
  addInterviewTimestampFeedback,
  fetchInterviewTimestampFeedbacks,
  deleteInterviewTimestampFeedback,
  type FeedbackScores,
  type InterviewTimestampFeedbackItem,
  type TimestampCategory,
} from "@/lib/interviewApi";
import {
  Users,
  Star,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  Search,
  Video,
  Award,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  ShieldCheck,
  Film,
  Play,
  RotateCcw,
  Sliders,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  GraduationCap,
  Mail,
  UserCheck,
  Bookmark,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function InterviewerDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    assigned: AssignedInterviewSession[];
    pending: AssignedInterviewSession[];
    completed: AssignedInterviewSession[];
    total: number;
    interviewer: { id: string; name?: string; email?: string };
  }>({
    assigned: [],
    pending: [],
    completed: [],
    total: 0,
    interviewer: { id: "" },
  });

  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Evaluation Modal State
  const [evaluatingSession, setEvaluatingSession] = useState<AssignedInterviewSession | null>(null);
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
  const [submittingReview, setSubmittingReview] = useState(false);

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

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchInterviewerInterviews();
      setData(res);
    } catch (err: any) {
      console.error("Failed to load interviewer interviews:", err);
      toast.error(err?.response?.data?.detail || "Failed to load assigned interviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully.");
    } catch (e) {
      console.error(e);
    } finally {
      window.location.href = "/login";
    }
  };

  const handleOpenEvaluation = (session: AssignedInterviewSession) => {
    setEvaluatingSession(session);
    setDetailedFeedback(session.interviewer_feedback || "");
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
    if (!evaluatingSession) return;
    if (!newComment.trim()) {
      toast.error("Please enter feedback comment for this timestamp.");
      return;
    }

    const captureSec = videoPlayerRef.current ? videoPlayerRef.current.currentTime : currentVideoTime;

    try {
      setSubmittingTimestamp(true);
      await addInterviewTimestampFeedback(evaluatingSession.session_id, {
        timestamp_seconds: captureSec,
        category: newCategory,
        comment: newComment.trim(),
      });
      toast.success(`Timestamp feedback added at ${formatSec(captureSec)}!`);
      setNewComment("");
      setShowTimestampForm(false);
      loadTimestamps(evaluatingSession.session_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add timestamp feedback.");
    } finally {
      setSubmittingTimestamp(false);
    }
  };

  const handleDeleteTimestamp = async (feedbackId: string) => {
    if (!evaluatingSession) return;
    try {
      await deleteInterviewTimestampFeedback(evaluatingSession.session_id, feedbackId);
      toast.success("Timestamp note deleted.");
      loadTimestamps(evaluatingSession.session_id);
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

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingSession) return;

    if (!detailedFeedback.trim()) {
      toast.error("Please provide detailed assessment feedback for the candidate.");
      return;
    }

    try {
      setSubmittingReview(true);
      const res = await submitInterviewTeamFeedback(evaluatingSession.session_id, {
        scores: rubricScores,
        strengths: strengths.trim(),
        improvements: improvements.trim(),
        recommendations: recommendations.trim(),
        detailed_feedback: detailedFeedback.trim(),
      });

      toast.success(res.message || "Official feedback submitted successfully!");
      setEvaluatingSession(null);
      loadInterviews();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Filter list
  const currentList =
    activeTab === "all"
      ? data.assigned
      : activeTab === "pending"
      ? data.pending
      : data.completed;

  const filteredList = currentList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.student_name.toLowerCase().includes(q) ||
      s.student_college.toLowerCase().includes(q) ||
      s.student_email.toLowerCase().includes(q) ||
      s.interview_type.toLowerCase().includes(q) ||
      s.company_name.toLowerCase().includes(q)
    );
  });

  const activeVideoUrl = evaluatingSession?.recording_url
    ? evaluatingSession.recording_url.startsWith("http")
      ? evaluatingSession.recording_url
      : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${evaluatingSession.recording_url}`
    : null;

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Background ambient gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#070913]/85 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/skilldepz.png"
                alt="SkillDipz"
                width={130}
                height={34}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Interviewer Evaluation Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Authenticated User Pill */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-linear-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-black">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "I"}
              </div>
              <span className="text-xs font-bold text-slate-200 hidden sm:inline max-w-30 truncate">
                {user?.full_name || "Interviewer"}
              </span>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 relative z-10">
        {/* Welcome & Stats Hero */}
        <div className="p-8 sm:p-10 rounded-3xl bg-linear-to-br from-indigo-950/40 via-slate-900/70 to-slate-950 border border-indigo-500/20 backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Authorized Interviewer
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Candidate Mock Interview Reviews
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Review assigned candidate session recordings, evaluate 5-factor competency rubrics, and deliver actionable feedback.
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
                <p className="text-xl font-black text-white">{data.total}</p>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
                <p className="text-xl font-black text-amber-400">{data.pending.length}</p>
                <span className="text-[10px] font-bold text-amber-400 uppercase">Pending</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
                <p className="text-xl font-black text-emerald-400">{data.completed.length}</p>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Reviewed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-fit">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "pending"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ⏳ Pending Reviews ({data.pending.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "completed"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ✅ Completed ({data.completed.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "all"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Assigned ({data.total})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by candidate, college, track..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-400">Loading assigned mock interviews from MongoDB...</p>
          </div>
        ) : filteredList.length === 0 ? (
          /* Empty State: Zero mock data */
          <div className="p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3 max-w-xl mx-auto shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No interviews assigned to you.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When an administrator assigns completed mock rounds or candidate interviews to your account, they will appear here in real time.
            </p>
          </div>
        ) : (
          /* Real Assigned Interviews Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map((session) => {
              const isReviewed = session.review_status === "reviewed";
              const hasVideo = !!session.recording_url;

              return (
                <motion.div
                  key={session.session_id}
                  whileHover={{ y: -4 }}
                  className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between gap-5 transition-all relative overflow-hidden group"
                >
                  <div className="space-y-4">
                    {/* Top: Candidate info & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">
                          {session.student_name}
                        </h3>
                        <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                          <span>{session.student_college || session.student_email || "Student Candidate"}</span>
                        </p>
                        <p className="text-[11px] text-indigo-400 font-semibold mt-1">
                          {session.company_name} · {session.interview_type.toUpperCase()} Track
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                            isReviewed
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse"
                          }`}
                        >
                          {isReviewed ? "Reviewed" : "Pending Review"}
                        </span>
                        {hasVideo && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center gap-1">
                            <Film className="w-3 h-3 text-purple-400" />
                            <span>Video Ready</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Box */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Duration</span>
                        <p className="font-semibold text-slate-200">{session.duration_mins} Mins</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned On</span>
                        <p className="font-semibold text-slate-200">
                          {session.assigned_at
                            ? new Date(session.assigned_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "Recent"}
                        </p>
                      </div>
                    </div>

                    {/* Previous Score if Evaluated */}
                    {isReviewed && session.overall_score != null && (
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                        <span className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-emerald-400" /> Evaluated Score
                        </span>
                        <span className="text-sm font-black text-emerald-400">
                          {Math.round(session.overall_score)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions / CTA */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEvaluation(session)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition ${
                        isReviewed
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                          : "bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{isReviewed ? "Update Evaluation & Rubric" : "Review & Grade Candidate"}</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* EVALUATION & RUBRIC MODAL */}
      <AnimatePresence>
        {evaluatingSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0b0f19]/95 backdrop-blur-xl z-20">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Sliders className="w-3 h-3" /> Candidate Evaluation Rubric
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {evaluatingSession.student_name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    {evaluatingSession.company_name} · {evaluatingSession.interview_type.toUpperCase()} Track
                  </p>
                </div>

                <button
                  onClick={() => setEvaluatingSession(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form & Video */}
              <form onSubmit={handleSubmitEvaluation} className="p-6 sm:p-8 space-y-6">
                {/* Video Playback Section */}
                {activeVideoUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Film className="w-4 h-4 text-purple-400" /> Candidate Session Recording
                      </label>
                      <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-mono font-bold">
                        Playback Time: {formatSec(currentVideoTime)}
                      </span>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video max-h-90 flex items-center justify-center shadow-xl">
                      <video
                        ref={videoPlayerRef}
                        src={activeVideoUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                        onTimeUpdate={(e) => setCurrentVideoTime((e.target as HTMLVideoElement).currentTime)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <span className="text-slate-400">
                        Capture exact timestamps to give targeted feedback.
                      </span>

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
                    </div>

                    {/* Add Timestamp Feedback Form */}
                    {showTimestampForm && (
                      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                            <Bookmark className="w-4 h-4 text-indigo-400" />
                            Add Timestamp Note at <span className="font-mono text-white font-black">{formatSec(currentVideoTime)}</span>
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
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold"
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
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="e.g. Long pause before answering or Strong technical explanation"
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
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
                            type="button"
                            disabled={submittingTimestamp}
                            onClick={handleAddTimestampFeedback}
                            className="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {submittingTimestamp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Save Timestamp Note</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Timestamped Notes Timeline List */}
                    {timestamps.length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                          Timestamped Review Notes ({timestamps.length})
                        </h4>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {timestamps.map((ts) => (
                            <div
                              key={ts.feedback_id}
                              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs group"
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
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                    <Film className="w-4 h-4 text-slate-500" />
                    <span>No proctored video recording attached to this session.</span>
                  </div>
                )}

                {/* 6-Factor Competency Rubric Grading */}
                <div className="space-y-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-400" />
                    6 Core Competency Factors (0 - 100)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Communication */}
                    <div className="space-y-1.5">
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

                    {/* Technical Knowledge */}
                    <div className="space-y-1.5">
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

                    {/* Confidence */}
                    <div className="space-y-1.5">
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

                    {/* Problem Solving */}
                    <div className="space-y-1.5">
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

                    {/* Answer Quality */}
                    <div className="space-y-1.5">
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

                    {/* Professionalism */}
                    <div className="space-y-1.5">
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
                </div>

                {/* Overall Score Indicator */}
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-400" />
                    Calculated Overall Score:
                  </span>
                  <span className="text-lg font-black text-white">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                      Key Strengths Observed
                    </label>
                    <textarea
                      rows={3}
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      placeholder="Candidate's standout strengths during the session..."
                      className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                      Areas to Improve
                    </label>
                    <textarea
                      rows={3}
                      value={improvements}
                      onChange={(e) => setImprovements(e.target.value)}
                      placeholder="Candidate's improvement areas or gaps..."
                      className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs leading-relaxed focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                    Actionable Recommendations
                  </label>
                  <textarea
                    rows={2}
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    placeholder="Specific preparation steps or study suggestions..."
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs leading-relaxed focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Evaluator Written Detailed Feedback */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Detailed Interviewer Feedback *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={detailedFeedback}
                    onChange={(e) => setDetailedFeedback(e.target.value)}
                    placeholder="Comprehensive assessment of candidate answers and overall performance..."
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs leading-relaxed focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEvaluatingSession(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-6 py-2.5 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
                  >
                    {submittingReview ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Evaluation...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit Final Review</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
