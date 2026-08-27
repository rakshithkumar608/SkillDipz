"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Plus,
  RefreshCw,
  Loader2,
  Bot,
  Building2,
  CheckCircle,
  XCircle,
  Shield,
  X,
  Sparkles,
  Clock,
  FileText,
  Award,
  Play,
  CreditCard,
  ShoppingBag,
  Globe,
  Package,
  UtensilsCrossed,
  Zap,
  Code2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMyInterviews,
  startAIInterview,
  joinInterview,
  AIStartResponse,
  InterviewSession,
  DetailedRubric,
  MentorshipBooking,
} from "@/lib/interviewApi";
import AIInterviewRoom from "@/components/interview/AIInterviewRoom";
import CompanyInterviewRoom from "@/components/interview/CompanyInterviewRoom";
import InterviewCard from "@/components/interview/InterviewCard";
import MentorshipTab from "@/components/interview/MentorshipTab";
import FeedbackReportModal from "@/components/interview/FeedbackReportModal";

const AI_COMPANIES = [
  { key: "google", name: "Google", icon: Globe, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { key: "amazon", name: "Amazon", icon: Package, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "razorpay", name: "Razorpay", icon: CreditCard, color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  { key: "flipkart", name: "Flipkart", icon: ShoppingBag, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  { key: "zomato", name: "Zomato", icon: UtensilsCrossed, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  { key: "swiggy", name: "Swiggy", icon: Zap, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
];

export default function MockInterviewPage() {
  const [activeTab, setActiveTab] = useState<"ai_arena" | "mentorship" | "history">("ai_arena");
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAISetup, setShowAISetup] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("google");
  const [customCompanyName, setCustomCompanyName] = useState("");
  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const [interviewType, setInterviewType] = useState<"technical" | "hr">("technical");
  const [durationMins, setDurationMins] = useState(30);
  const [startingAI, setStartingAI] = useState(false);

  // Active Sessions
  const [activeAISession, setActiveAISession] = useState<AIStartResponse | null>(null);
  const [activeCompanySession, setActiveCompanySession] = useState<InterviewSession | null>(null);

  // Detailed Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportData, setSelectedReportData] = useState<{
    overallScore: number;
    companyName: string;
    interviewType: string;
    feedback: string;
    rubric?: DetailedRubric | null;
    recordingUrl?: string | null;
    recordedBlob?: Blob | null;
    transcript?: string | null;
    conversation?: { role: string; content: string }[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { sessions: data } = await getMyInterviews();
      setSessions(data);
    } catch {
      toast.error("Failed to load interview history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartAI = async () => {
    let companyKey = selectedCompany;
    let companyName = AI_COMPANIES.find((c) => c.key === selectedCompany)?.name;

    if (useCustomCompany) {
      if (!customCompanyName.trim()) {
        toast.error("Please enter a company name.");
        return;
      }
      companyKey = customCompanyName.trim().toLowerCase().replace(/\s+/g, "_");
      companyName = customCompanyName.trim();
    }

    setStartingAI(true);
    try {
      const resp = await startAIInterview({
        company_key: companyKey,
        company_name: companyName,
        interview_type: interviewType,
        duration_mins: durationMins,
      });
      setShowAISetup(false);
      setActiveAISession(resp);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not launch practice interview.");
    } finally {
      setStartingAI(false);
    }
  };

  const handleJoinCompanyInterview = async (session: InterviewSession) => {
    try {
      await joinInterview(session.session_id);
      setActiveCompanySession(session);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not join company interview.");
    }
  };

  const handleAIComplete = (result: {
    overall_score: number;
    feedback: string;
    transcript: string;
    rubric?: DetailedRubric;
    recordingUrl?: string;
    recordedBlob?: Blob;
  }) => {
    setActiveAISession(null);
    load();

    setSelectedReportData({
      overallScore: result.overall_score,
      companyName: activeAISession?.company_name || "AI Assessment",
      interviewType: activeAISession?.interview_type || "Technical",
      feedback: result.feedback,
      rubric: result.rubric,
      recordingUrl: result.recordingUrl,
      recordedBlob: result.recordedBlob,
      transcript: result.transcript,
    });
    setReportModalOpen(true);
  };

  const handleViewSessionReport = (session: InterviewSession) => {
    setSelectedReportData({
      overallScore: session.overall_score || 75,
      companyName: session.company_name || session.interviewer_name || "Interview Evaluation",
      interviewType: session.interview_type,
      feedback: session.feedback || "Completed session.",
      rubric: session.rubric,
      recordingUrl: session.recording_url,
      transcript: session.transcript,
      conversation: session.conversation,
    });
    setReportModalOpen(true);
  };

  const handleViewMentorReport = (booking: MentorshipBooking) => {
    setSelectedReportData({
      overallScore: booking.overall_score || 85,
      companyName: `1-to-1 Mentorship with ${booking.mentor_name} (${booking.mentor_company})`,
      interviewType: "1-on-1 Mentorship Deep-Dive",
      feedback: booking.mentor_feedback || "Thorough architecture review completed.",
      rubric: booking.rubric,
      recordingUrl: booking.recording_url,
    });
    setReportModalOpen(true);
  };

  // Full Screen Live Interview Overlays
  if (activeAISession) {
    return (
      <AIInterviewRoom
        sessionId={activeAISession.session_id}
        firstQuestion={activeAISession.first_question}
        questionNumber={activeAISession.question_number}
        durationMins={activeAISession.duration_mins}
        companyName={activeAISession.company_name}
        interviewType={activeAISession.interview_type}
        onComplete={handleAIComplete}
        onTerminated={(reason) => {
          setActiveAISession(null);
          toast.error(`Interview Terminated: ${reason}`);
          load();
        }}
      />
    );
  }

  if (activeCompanySession) {
    return (
      <CompanyInterviewRoom
        sessionId={activeCompanySession.session_id}
        companyName={activeCompanySession.company_name || "Company Interview"}
        interviewerName={activeCompanySession.interviewer_name || "Hiring Lead"}
        videoCallUrl={activeCompanySession.video_call_url}
        durationMins={activeCompanySession.duration_mins}
        onLeave={() => {
          setActiveCompanySession(null);
          load();
        }}
        onTerminated={(reason) => {
          setActiveCompanySession(null);
          toast.error(`Interview Terminated: ${reason}`);
          load();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Career Readiness Engine
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Level 4: Industry Ready Pro
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Mock Interview & Mentorship Arena
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">
            Proctored AI simulations, 1-to-1 FAANG mentor sessions, video playback, and 5-factor rubric evaluations.
          </p>
        </div>

        {/* Quick Launch CTA */}
        <button
          onClick={() => setShowAISetup(true)}
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2.5 transition shrink-0"
        >
          <Play className="w-4 h-4 fill-current" /> Launch AI Mock Practice
        </button>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 max-w-xl">
        <button
          onClick={() => setActiveTab("ai_arena")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeTab === "ai_arena"
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Bot className="w-4 h-4" /> AI Practice Arena
        </button>
        <button
          onClick={() => setActiveTab("mentorship")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeTab === "mentorship"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" /> 1-to-1 Mentorship
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeTab === "history"
              ? "bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-lg shadow-teal-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Award className="w-4 h-4" /> History & Rubrics ({sessions.length})
        </button>
      </div>

      {/* TAB 1: AI PRACTICE ARENA */}
      {activeTab === "ai_arena" && (
        <div className="space-y-8">
          {/* Target Company Fast-Start Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Target Company Presets
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-configured technical question banks modeled on actual hiring bar metrics.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {AI_COMPANIES.map((company) => {
                const Icon = company.icon;
                return (
                  <button
                    key={company.key}
                    onClick={() => {
                      setSelectedCompany(company.key);
                      setUseCustomCompany(false);
                      setShowAISetup(true);
                    }}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-4 transition-all duration-200 hover:scale-[1.03] bg-slate-900/60 border-slate-800 hover:border-violet-500/40`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${company.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{company.name}</p>
                      <span className="text-[10px] text-slate-400 font-semibold">7 Questions · Proctored</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
                <span>AI Practice Solves</span>
                <Bot className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-black text-white">
                {sessions.filter((s) => s.mode === "ai" && s.status === "completed").length} Sessions
              </p>
              <p className="text-[11px] text-slate-400">7-question simulated rounds with LLaMA 3.3 70B.</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
                <span>Average Performance</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400">
                {sessions.filter((s) => s.overall_score != null).length > 0
                  ? (
                      sessions.reduce((acc, s) => acc + (s.overall_score || 0), 0) /
                      sessions.filter((s) => s.overall_score != null).length
                    ).toFixed(1)
                  : "0.0"}
                <span className="text-sm font-normal text-slate-500"> / 100</span>
              </p>
              <p className="text-[11px] text-slate-400">
                {sessions.filter((s) => s.overall_score != null).length > 0
                  ? "Based on verified evaluations."
                  : "No completed evaluations yet."}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
                <span>Proctoring Integrity</span>
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400">
                {sessions.length > 0
                  ? `${Math.round(
                      (sessions.filter((s) => (s.violations_total || s.violations?.length || 0) === 0).length /
                        sessions.length) *
                        100
                    )}%`
                  : "100%"}
              </p>
              <p className="text-[11px] text-slate-400">Locked full-screen and tab violation listener.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 1-TO-1 MENTORSHIP */}
      {activeTab === "mentorship" && (
        <MentorshipTab
          onJoinMeeting={(meetingUrl, bookingId) => {
            // Join mentor interview session
            const session = sessions.find((s) => s.session_id === bookingId);
            if (session) {
              handleJoinCompanyInterview(session);
            } else {
              window.location.href = meetingUrl;
            }
          }}
          onViewReport={handleViewMentorReport}
        />
      )}

      {/* TAB 3: PAST SESSIONS & HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-400" />
              All Interview & Mentorship Records
            </h3>
            <button
              onClick={load}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading interview records...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
              <Award className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No mock sessions recorded yet.</p>
              <p className="text-xs text-slate-500">
                Launch an AI practice interview or book a 1-to-1 mentor session to build your Career Readiness score.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sessions.map((session) => (
                <InterviewCard
                  key={session.session_id}
                  session={session}
                  onJoin={() => handleJoinCompanyInterview(session)}
                  onViewFeedback={() => handleViewSessionReport(session)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: AI Practice Setup */}
      <AnimatePresence>
        {showAISetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowAISetup(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-violet-500/20 border border-violet-500/30 text-violet-400">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI Practice Simulation Setup</h2>
                  <p className="text-xs text-slate-400">Configure your target company and proctored environment.</p>
                </div>
              </div>

              {/* Company Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Company</label>
                <div className="grid grid-cols-3 gap-2">
                  {AI_COMPANIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setSelectedCompany(c.key);
                        setUseCustomCompany(false);
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${
                        !useCustomCompany && selectedCompany === c.key
                          ? "bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-500/10"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <c.icon className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="Or enter custom company name..."
                    value={customCompanyName}
                    onChange={(e) => {
                      setCustomCompanyName(e.target.value);
                      setUseCustomCompany(true);
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-xs text-white placeholder:text-slate-500 focus:outline-none transition ${
                      useCustomCompany ? "border-violet-500" : "border-slate-800"
                    }`}
                  />
                </div>
              </div>

              {/* Interview Track */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Interview Track</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInterviewType("technical")}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      interviewType === "technical"
                        ? "bg-violet-600/20 border-violet-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <p className="font-bold text-xs">Technical Track</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">DSA, System Design & Architecture</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterviewType("hr")}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      interviewType === "hr"
                        ? "bg-violet-600/20 border-violet-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <p className="font-bold text-xs">HR & Culture Track</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Behavioral, Leadership & STAR</p>
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                onClick={handleStartAI}
                disabled={startingAI}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-violet-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {startingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting Proctored Room...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Begin AI Practice Simulation
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FEEDBACK & RUBRIC REPORT MODAL */}
      {selectedReportData && (
        <FeedbackReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          overallScore={selectedReportData.overallScore}
          companyName={selectedReportData.companyName}
          interviewType={selectedReportData.interviewType}
          feedback={selectedReportData.feedback}
          rubric={selectedReportData.rubric}
          recordingUrl={selectedReportData.recordingUrl}
          recordedBlob={selectedReportData.recordedBlob}
          transcript={selectedReportData.transcript}
          conversation={selectedReportData.conversation}
          onBookMentor={() => {
            setActiveTab("mentorship");
          }}
        />
      )}
    </div>
  );
}
