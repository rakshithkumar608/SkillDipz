"use client";

import CodePracticeArena from "@/components/practice/CodePracticeArena";
import MCQResultModal from "@/components/practice/MCQResultModal";
import MCQTestCard from "@/components/practice/MCQTestCard";
import MCQTestRunner from "@/components/practice/MCQTestRunner";
import {
  AssessmentResult,
  AssessmentSessionData,
  AssessmentTopic,
  fetchWeakSkills,
  getActiveSession,
  getAvailableAssessments,
  getCFProfile,
  getMyProfile,
  startAssessment,
  WeakSkill,
} from "@/lib/practiceApi";
import { AnimatePresence } from "framer-motion";
import { BookOpen, Code2, FlaskConical, Loader2, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type MainTab = "skill-tests" | "coding";

export default function PracticePage() {
  // ── Profile ─────────────────────────────────────────────────────────────────
  const [role, setRole] = useState<string>("backend");
  const [cfHandle, setCfHandle] = useState<string>("");
  const [cfProfileInfo, setCfProfileInfo] = useState<{
    rating: number | null;
    rank: string;
  } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>("skill-tests");

  // ── MCQ state ────────────────────────────────────────────────────────────────
  const [topics, setTopics] = useState<AssessmentTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<AssessmentSessionData | null>(null);
  const [sessionInitialSecs, setSessionInitialSecs] = useState<number | undefined>();
  const [sessionInitialAnswers, setSessionInitialAnswers] = useState<Record<string, string>>({});
  const [activeTopic, setActiveTopic] = useState<AssessmentTopic | null>(null);
  const [testResult, setTestResult] = useState<AssessmentResult | null>(null);

  // ── Coding practice skill curation ──────────────────────────────────────────
  const [lastTestSkills, setLastTestSkills] = useState<string[]>([]);
  const [weakSkills, setWeakSkills] = useState<WeakSkill[]>([]);

  // ── Load profile ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const profile = await getMyProfile();
        const rawRole = (profile.target_roles || "backend").toLowerCase();
        const normalized =
          rawRole.includes("fullstack") || rawRole.includes("full stack") ? "fullstack"
          : rawRole.includes("data") ? "data"
          : rawRole.includes("devops") ? "devops"
          : rawRole.includes("ai") || rawRole.includes("ml") ? "ai"
          : "backend";
        setRole(normalized);

        if (profile.cf_handle) {
          setCfHandle(profile.cf_handle);
          try {
            const cf = await getCFProfile(profile.cf_handle);
            setCfProfileInfo({ rating: cf.rating, rank: cf.rank });
          } catch {
            // Not found — handle still set for verify flow
          }
        }
      } catch {
        // Keep defaults
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, []);

  // ── Load weak skills from roadmap once profile is ready ─────────────────────
  useEffect(() => {
    if (!profileLoaded) return;
    (async () => {
      const skills = await fetchWeakSkills();
      setWeakSkills(skills);
    })();
  }, [profileLoaded]);

  // ── Load topics ──────────────────────────────────────────────────────────────
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const data = await getAvailableAssessments(role);
      setTopics(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load skill tests.");
    } finally {
      setTopicsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!profileLoaded) return;
    if (mainTab === "skill-tests") loadTopics();
  }, [mainTab, profileLoaded]);

  // ── Start MCQ test ───────────────────────────────────────────────────────────
  const handleStartTest = async (topic: AssessmentTopic) => {
    setStartingTopicId(topic.topic_id);
    try {
      // Check for in-progress session to resume
      const resumeData = await getActiveSession(topic.topic_id);
      if (resumeData.session) {
        const s = resumeData.session;
        setActiveTopic(topic);
        setActiveSession({
          session_id: s.session_id,
          topic_title: s.topic_title,
          time_limit_mins: Math.ceil(s.seconds_remaining / 60),
          expires_at: new Date(Date.now() + s.seconds_remaining * 1000).toISOString(),
          questions: s.questions,
        });
        setSessionInitialSecs(s.seconds_remaining);
        setSessionInitialAnswers(s.answers_so_far || {});
        toast.info("Resuming your in-progress test.");
        return;
      }

      // Start fresh
      const session = await startAssessment(topic.topic_id);
      setActiveTopic(topic);
      setActiveSession(session);
      setSessionInitialSecs(undefined);
      setSessionInitialAnswers({});
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not start test.");
    } finally {
      setStartingTopicId(null);
    }
  };

  const handleTestComplete = (result: AssessmentResult) => {
    setActiveSession(null);
    setTestResult(result);
    // Capture verified skills to curate coding problems
    if (result.skills_verified && result.skills_verified.length > 0) {
      setLastTestSkills(result.skills_verified);
    }
    loadTopics();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10 border border-indigo-500/10">
            <FlaskConical className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Skill Tests &amp; Practice</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              MCQ assessments + in-browser coding arena — zero mock data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cfHandle && cfProfileInfo && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/8 border border-orange-500/15 text-xs text-orange-400">
              <Trophy className="w-4 h-4" />
              <span className="text-orange-400/60">{cfHandle}</span>
              {cfProfileInfo.rating && <span>· {cfProfileInfo.rating}</span>}
              <span className="text-orange-400/60">{cfProfileInfo.rank}</span>
            </div>
          )}
          <button
            onClick={() => mainTab === "skill-tests" ? loadTopics() : undefined}
            disabled={topicsLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/6 text-xs text-slate-300 hover:bg-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${topicsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1.5 p-1 bg-white/3 rounded-xl border border-white/6 w-fit">
        {([
          { key: "skill-tests" as MainTab, label: "Skill Tests", icon: FlaskConical,
            active: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" },
          { key: "coding" as MainTab, label: "Code Practice", icon: Code2,
            active: "bg-sky-500/20 text-sky-400 border border-sky-500/30" },
        ] as const).map(({ key, label, icon: Icon, active }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mainTab === key ? active : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Skill Tests Tab */}
      {mainTab === "skill-tests" && (
        <div className="space-y-5">
          {/* Role + info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              Target Role: {role.toUpperCase()}
            </span>
            {weakSkills.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                ⚡ {weakSkills.length} Roadmap Skill Gaps Loaded &amp; AI-Generated
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Groq AI + Live API Concept Assessments
            </span>
          </div>

          {topicsLoading ? (
            <div className="flex items-center justify-center min-h-[35vh]">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="ml-2 text-sm text-slate-400">Loading assessments...</span>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <p className="text-slate-300 font-medium">No assessments yet for your role</p>
              <p className="text-slate-500 text-sm">Check back soon or ask your admin to create topics.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {topics.map((topic) => (
                <MCQTestCard
                  key={topic.topic_id}
                  topic={topic}
                  isStarting={startingTopicId === topic.topic_id}
                  onStart={() => handleStartTest(topic)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Code Practice Tab */}
      {mainTab === "coding" && (
        <CodePracticeArena
          lastTestSkills={lastTestSkills}
          weakSkills={weakSkills.map((s) => s.skill)}
        />
      )}

      {/* Modals */}
      <AnimatePresence>
        {activeSession && (
          <MCQTestRunner
            session={activeSession}
            initialSecondsLeft={sessionInitialSecs}
            initialAnswers={sessionInitialAnswers}
            onClose={() => setActiveSession(null)}
            onCompleted={handleTestComplete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {testResult && activeTopic && (
          <MCQResultModal
            result={testResult}
            topicTitle={activeTopic.title}
            onClose={() => {
              setTestResult(null);
              // Auto-switch to coding tab after MCQ complete (with skills already set)
              if (lastTestSkills.length > 0) {
                toast.info("💡 Check Code Practice — problems curated for your skills!", { duration: 5000 });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
