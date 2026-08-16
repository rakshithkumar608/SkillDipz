"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Plus, RefreshCw, Loader2, Bot, Building2,
  CheckCircle, XCircle, Shield, X, Sparkles, Clock, FileText, Award,
  Play, CreditCard, ShoppingBag, Globe, Package, UtensilsCrossed, Zap, Code2, Users
} from "lucide-react";
import { toast } from "sonner";
import {
  getMyInterviews,
  startAIInterview,
  joinInterview,
  AIStartResponse,
  InterviewSession,
} from "@/lib/interviewApi";
import AIInterviewRoom from "@/components/interview/AIInterviewRoom";
import CompanyInterviewRoom from "@/components/interview/CompanyInterviewRoom";
import InterviewCard from "@/components/interview/InterviewCard";

const AI_COMPANIES = [
  { key: "razorpay", name: "Razorpay", icon: CreditCard },
  { key: "flipkart", name: "Flipkart", icon: ShoppingBag },
  { key: "google", name: "Google", icon: Globe },
  { key: "amazon", name: "Amazon", icon: Package },
  { key: "zomato", name: "Zomato", icon: UtensilsCrossed },
  { key: "swiggy", name: "Swiggy", icon: Zap },
];

export default function MockInterviewPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAISetup, setShowAISetup] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("razorpay");
  const [customCompanyName, setCustomCompanyName] = useState("");
  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const [interviewType, setInterviewType] = useState<"technical" | "hr">("technical");
  const [durationMins, setDurationMins] = useState(30);
  const [startingAI, setStartingAI] = useState(false);

  const [activeAISession, setActiveAISession] = useState<AIStartResponse | null>(null);
  const [activeCompanySession, setActiveCompanySession] = useState<InterviewSession | null>(null);
  const [resultData, setResultData] = useState<any>(null);

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

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* AI Practice Active Session */}
      {activeAISession && (
        <AIInterviewRoom
          sessionId={activeAISession.session_id}
          firstQuestion={activeAISession.first_question}
          questionNumber={activeAISession.question_number}
          durationMins={activeAISession.duration_mins}
          companyName={activeAISession.company_name}
          interviewType={activeAISession.interview_type}
          onComplete={(res) => {
            setActiveAISession(null);
            setResultData(res);
            load();
          }}
          onTerminated={() => {
            setActiveAISession(null);
            load();
          }}
        />
      )}

      {/* Live Company Active Session */}
      {activeCompanySession && (
        <CompanyInterviewRoom
          sessionId={activeCompanySession.session_id}
          companyName={activeCompanySession.company_name || "Company Interview"}
          interviewerName={activeCompanySession.interviewer_name || "Company Specialist"}
          videoCallUrl={activeCompanySession.video_call_url}
          durationMins={activeCompanySession.duration_mins}
          onLeave={() => {
            setActiveCompanySession(null);
            load();
          }}
          onTerminated={() => {
            setActiveCompanySession(null);
            load();
          }}
        />
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-linear-to-tr from-violet-500/20 to-sky-500/20 border border-white/10">
              <Video className="w-6 h-6 text-sky-400" />
            </div>
            Mock Interviews (Company-Conducted & Proctored)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time proctored sessions scheduled by hiring companies or simulated by AI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAISetup(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 font-bold text-xs text-white shadow-lg shadow-violet-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> Practice AI Interview
          </button>
        </div>
      </div>

      {/* Grid of Interview Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="p-4 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Bot className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Mock Interviews Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              You don't have any scheduled company interviews or AI practice sessions yet. Start a simulated interview now!
            </p>
          </div>
          <button
            onClick={() => setShowAISetup(true)}
            className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-lg shadow-violet-600/30"
          >
            Start Practice Interview
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => (
            <InterviewCard
              key={s.session_id}
              session={s}
              onJoin={(session) => {
                if (session.mode === "company") handleJoinCompanyInterview(session);
              }}
              onViewResult={(session) => {
                setResultData({
                  overall_score: session.overall_score || 0,
                  feedback: session.feedback || "No feedback recorded",
                  transcript: session.transcript || "",
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal: AI Setup Popup */}
      <AnimatePresence>
        {showAISetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowAISetup(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="w-4 h-4" /> AI Practice Simulator
                </div>
                <h2 className="text-xl font-bold text-white">Configure Your Mock Interview</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select a company domain, interview type, and duration for real-time proctored AI evaluation.
                </p>
              </div>

              {/* Company Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Select Target Company Environment</label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomCompany(!useCustomCompany);
                    }}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    {useCustomCompany ? "← Choose from popular presets" : "+ Enter custom company"}
                  </button>
                </div>

                {useCustomCompany ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-slate-800/80 border border-violet-500/50 rounded-2xl p-2.5 pr-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 flex items-center justify-center font-black text-xs uppercase shrink-0">
                        {customCompanyName.trim() ? customCompanyName.trim().slice(0, 2) : <Building2 className="w-4 h-4" />}
                      </div>
                      <input
                        type="text"
                        value={customCompanyName}
                        onChange={(e) => setCustomCompanyName(e.target.value)}
                        placeholder="e.g. Microsoft, Uber, CRED, Atlassian..."
                        className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      The AI will adapt its interview persona specifically to target <span className="text-violet-300 font-semibold">{customCompanyName || "your company"}</span>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {AI_COMPANIES.map((c) => {
                      const Icon = c.icon;
                      const isSel = selectedCompany === c.key;
                      return (
                        <button
                          key={c.key}
                          onClick={() => setSelectedCompany(c.key)}
                          className={`p-3.5 rounded-2xl border text-left flex flex-col items-center justify-center gap-2 transition-all ${
                            isSel
                              ? "bg-violet-600/20 border-violet-500 text-white font-bold shadow-lg shadow-violet-500/10"
                              : "bg-slate-800/60 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSel ? "text-violet-400" : "text-slate-400"}`} />
                          <span className="text-xs">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Interview Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Interview Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setInterviewType("technical")}
                    className={`p-3.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      interviewType === "technical"
                        ? "bg-sky-500/20 border-sky-500 text-sky-300"
                        : "bg-slate-800/60 border-white/5 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Code2 className="w-4 h-4 text-sky-400" />
                    Technical Deep-Dive
                  </button>
                  <button
                    onClick={() => setInterviewType("hr")}
                    className={`p-3.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      interviewType === "hr"
                        ? "bg-purple-500/20 border-purple-500 text-purple-300"
                        : "bg-slate-800/60 border-white/5 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Users className="w-4 h-4 text-purple-400" />
                    HR & Culture Fit
                  </button>
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Duration (Minutes)</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDurationMins(mins)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                        durationMins === mins
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-slate-800/60 border-white/5 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleStartAI}
                disabled={startingAI}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 text-white font-bold text-sm shadow-xl shadow-violet-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {startingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Initializing Environment…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Begin Proctored Session
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Result & Feedback Popup */}
      <AnimatePresence>
        {resultData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col gap-6 shadow-2xl relative"
            >
              <button
                onClick={() => setResultData(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Interview Evaluation Results</h2>
                  <p className="text-xs text-slate-400">Performance summary and AI evaluator feedback.</p>
                </div>
              </div>

              <div className="overflow-y-auto space-y-6 pr-2">
                {/* Score Banner */}
                <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Overall Performance</p>
                    <p className="text-3xl font-black text-emerald-400 mt-1">
                      {resultData.overall_score ? resultData.overall_score.toFixed(0) : "N/A"}
                      <span className="text-lg text-slate-500 font-normal"> / 100</span>
                    </p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                    PASSED EVALUATION
                  </div>
                </div>

                {/* Feedback */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-400" /> Evaluator Feedback & Key Takeaways
                  </h3>
                  <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {resultData.feedback || "No detailed feedback available."}
                  </div>
                </div>

                {/* Transcript */}
                {resultData.transcript && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-400" /> Interview Conversation Transcript
                    </h3>
                    <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {resultData.transcript}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setResultData(null)}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all"
              >
                Close Results
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
