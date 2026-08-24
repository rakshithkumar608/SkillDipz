"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  getAvailableAssessments,
  startAssessment,
  submitAssessment,
  getMyProfile,
  getLeetCodeProblems,
  LeetCodeProblemSummary,
  SkillMeta,
  AssessmentTopic,
  AssessmentSessionData,
  AssessmentResult,
} from "@/lib/practiceApi";
import MCQTestCard from "@/components/practice/MCQTestCard";
import MCQTestRunner from "@/components/practice/MCQTestRunner";
import MCQResultModal from "@/components/practice/MCQResultModal";
import LeetCodeProblemCard from "@/components/practice/LeetCodeProblemCard";
import LeetCodeWorkspace from "@/components/practice/LeetCodeWorkspace";
import {
  Code2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  Zap,
  Bookmark,
  ChevronRight,
  Filter,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type TabMode = "skill_tests" | "coding_problems";

export default function PracticeHubPage() {
  const { user } = useAuthStore();

  // Mode Selection: Mode A (MCQ Tests) vs Mode B (Coding Arena)
  const [activeTab, setActiveTab] = useState<TabMode>("skill_tests");
  const [studentRole, setStudentRole] = useState<string>("backend");

  // Mode A: MCQ Skill Tests
  const [topics, setTopics] = useState<AssessmentTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState<string>("ALL");
  const [topicSearch, setTopicSearch] = useState<string>("");
  const [mcqStatusFilter, setMcqStatusFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);

  // Active MCQ Session
  const [activeSession, setActiveSession] = useState<AssessmentSessionData | null>(null);
  const [testResult, setTestResult] = useState<AssessmentResult | null>(null);
  const [lastFinishedTopicId, setLastFinishedTopicId] = useState<string | null>(null);

  // Mode B: LeetCode AI Arena
  const [lcProblems, setLcProblems] = useState<LeetCodeProblemSummary[]>([]);
  const [lcLoading, setLcLoading] = useState(true);
  const [lcSkill, setLcSkill] = useState<string>("");
  const [studentSkills, setStudentSkills] = useState<string[]>([]);
  const [skillsMeta, setSkillsMeta] = useState<Record<string, SkillMeta>>({});
  const [isSkillLocked, setIsSkillLocked] = useState<boolean>(false);
  const [skillLockReason, setSkillLockReason] = useState<string | null>(null);
  const [hasSkillGap, setHasSkillGap] = useState<boolean>(true);
  const [lcDifficulty, setLcDifficulty] = useState<string>("ALL");
  const [lcConcept, setLcConcept] = useState<string>("ALL");
  const [lcSearch, setLcSearch] = useState<string>("");
  const [lcConceptsList, setLcConceptsList] = useState<string[]>([]);
  const [lcTotal, setLcTotal] = useState<number>(0);
  const [lcTotalSolved, setLcTotalSolved] = useState<number>(0);
  const [selectedLcQuestionId, setSelectedLcQuestionId] = useState<string | null>(null);

  // Load Student Info
  const loadProfile = useCallback(async () => {
    try {
      const p = await getMyProfile();
      const roleStr = p.target_role || p.target_roles || "";
      if (roleStr) {
        const r = roleStr.toLowerCase();
        if (r.includes("full")) setStudentRole("fullstack");
        else if (r.includes("front")) setStudentRole("frontend");
        else if (r.includes("data")) setStudentRole("data");
        else if (r.includes("devops") || r.includes("cloud")) setStudentRole("devops");
        else if (r.includes("ai") || r.includes("ml")) setStudentRole("ai");
        else if (r.includes("c++") || r.includes("cpp")) setStudentRole("c++");
        else if (r.includes("java")) setStudentRole("java");
        else if (r.includes("python")) setStudentRole("python");
        else setStudentRole(roleStr);
      }
    } catch {
      // fallback
    }
  }, []);

  // Load Skill Tests Topics
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const data = await getAvailableAssessments(studentRole);
      const list = data || [];
      setTopics(list);
      if (list.length > 0) {
        const extracted = Array.from(new Set(list.map((t) => t.skill_tags[0] || t.title.split("—")[0].trim())));
        setStudentSkills(extracted);
        if (!lcSkill || !extracted.includes(lcSkill)) {
          setLcSkill(extracted[0]);
        }
      } else {
        setStudentSkills([]);
      }
    } catch {
      toast.error("Failed to load skill test topics");
    } finally {
      setTopicsLoading(false);
    }
  }, [studentRole, lcSkill]);

  // Load LeetCode AI Problems
  const loadLcProblems = useCallback(async () => {
    setLcLoading(true);
    try {
      const res = await getLeetCodeProblems({
        skill: lcSkill || undefined,
        difficulty: lcDifficulty !== "ALL" ? lcDifficulty : undefined,
        concept: lcConcept !== "ALL" ? lcConcept : undefined,
        search: lcSearch.trim() || undefined,
        page: 1,
        limit: 100,
      });
      setLcProblems(res.problems || []);
      setLcTotal(res.total || 0);
      setLcTotalSolved(res.total_solved || 0);
      setLcConceptsList(res.concepts || []);
      setSkillsMeta(res.skills_meta || {});
      setIsSkillLocked(res.is_locked ?? false);
      setSkillLockReason(res.lock_reason ?? null);
      setHasSkillGap(res.has_skill_gap ?? (res.problems.length > 0));
      if (res.student_skills && res.student_skills.length > 0) {
        setStudentSkills(res.student_skills);
        if (!lcSkill || !res.student_skills.includes(lcSkill)) {
          setLcSkill(res.student_skills[0]);
        }
      } else if (res.has_skill_gap === false) {
        setStudentSkills([]);
      }
    } catch {
      toast.error("Failed to load coding problems.");
    } finally {
      setLcLoading(false);
    }
  }, [lcSkill, lcDifficulty, lcConcept, lcSearch]);

  // Initial Boot
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (activeTab === "coding_problems") {
      loadLcProblems();
    }
  }, [activeTab, loadLcProblems]);

  // Start Assessment Handler
  const handleStartTest = async (topicId: string) => {
    setStartingTopicId(topicId);
    try {
      const session = await startAssessment(topicId);
      setActiveSession(session);
      setLastFinishedTopicId(topicId);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        "Could not start assessment.";
      toast.error(errorMsg);
    } finally {
      setStartingTopicId(null);
    }
  };

  // Filtered MCQ Topics
  const filteredTopics = topics.filter((t) => {
    if (topicFilter !== "ALL" && t.difficulty.toUpperCase() !== topicFilter.toUpperCase()) {
      return false;
    }
    if (mcqStatusFilter === "unlocked" && t.is_unlocked === false) {
      return false;
    }
    if (mcqStatusFilter === "locked" && t.is_unlocked !== false) {
      return false;
    }
    if (topicSearch.trim()) {
      const q = topicSearch.toLowerCase();
      const titleMatch = t.title.toLowerCase().includes(q);
      const tagMatch = t.skill_tags.some((st) => st.toLowerCase().includes(q));
      if (!titleMatch && !tagMatch) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto space-y-6 text-slate-200">
      {/* ── Page Header  */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Code2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Skill Tests & Coding Arena
            </h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm">
            Roadmap-driven 10-question MCQ sets and progressively unlocked AI coding challenges tailored strictly to your skill gaps.
          </p>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-inner">
          <button
            onClick={() => setActiveTab("skill_tests")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === "skill_tests"
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Mode A: MCQ Sets ({topics.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("coding_problems")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === "coding_problems"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Mode B: Coding Arena ({lcTotal})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE A: MCQ SKILL TESTS TAB (10 Qs PER SET, 50 Qs TOTAL PER SKILLGAP)     */}
      {/* ========================================================================= */}
      {activeTab === "skill_tests" && (
        <section className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search topics or skills..."
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Status & Difficulty Tabs */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setMcqStatusFilter("all")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    mcqStatusFilter === "all"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All Sets ({topics.length})
                </button>
                <button
                  onClick={() => setMcqStatusFilter("unlocked")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    mcqStatusFilter === "unlocked"
                      ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Unlocked ({topics.filter((t) => t.is_unlocked !== false).length})
                </button>
                <button
                  onClick={() => setMcqStatusFilter("locked")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    mcqStatusFilter === "locked"
                      ? "bg-rose-600/30 text-rose-300 border border-rose-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Locked ({topics.filter((t) => t.is_unlocked === false).length})
                </button>
              </div>

              <div className="flex items-center gap-1">
                {["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED"].map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setTopicFilter(diff)}
                    className={`px-3 py-1.5 rounded-xl font-medium border transition-all ${
                      topicFilter === diff
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {diff === "ALL" ? "All Levels" : diff}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Topics Grid */}
          {topicsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-400 font-medium">
                Loading roadmap skill test sets (10 questions per set)…
              </p>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-20 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-8 space-y-4 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">No Learning Roadmap or Skill Gap Found</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Skill tests are personalized and strictly generated based on your Learning Roadmap concepts and skill gaps. Generate your Learning Roadmap to unlock tailored AI skill assessments.
                </p>
              </div>
              <a
                href="/student/roadmap"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
              >
                <span>Generate Learning Roadmap</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="text-center py-16 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-8 space-y-2">
              <HelpCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No skill tests match your filter</p>
              <p className="text-xs text-slate-500">Try changing the difficulty filter or searching for another keyword.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTopics.map((topic) => (
                <MCQTestCard
                  key={topic.topic_id}
                  topic={topic}
                  onStart={() => handleStartTest(topic.topic_id)}
                  isStarting={startingTopicId === topic.topic_id}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODE B: LEETCODE CODING ARENA TAB (POWERED BY GROQ AI WITH LOCKING)       */}
      {/* ========================================================================= */}
      {activeTab === "coding_problems" && (
        <section className="space-y-6 animate-in fade-in-50 duration-200">
          {lcLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs text-slate-400 font-medium">
                Loading 100–120+ LeetCode coding challenges for {lcSkill || "your skills"}…
              </p>
            </div>
          ) : studentSkills.length === 0 ? (
            <div className="text-center py-20 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-8 space-y-4 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <Code2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">No Skill Gap Selected Yet</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Coding practice challenges are automatically generated by AI to bridge your specific Skill Gaps from your Learning Roadmap. Generate your Learning Roadmap to unlock personalized coding challenges.
                </p>
              </div>
              <a
                href="/student/roadmap"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all"
              >
                <span>Generate Learning Roadmap</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* LeetCode Controls Bar */}
              <div className="space-y-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                {/* Skill selector & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Skill Picker Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                      Skill:
                    </span>
                    {studentSkills.map((s) => {
                      const meta = skillsMeta[s];
                      const isTabLocked = meta?.is_unlocked === false;
                      const isCurrent = lcSkill.toLowerCase() === s.toLowerCase();

                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setLcSkill(s);
                            setLcConcept("ALL");
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            isCurrent
                              ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                              : isTabLocked
                              ? "bg-slate-950/40 border-slate-800/80 text-slate-500 hover:text-slate-300"
                              : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {isTabLocked && <Lock className="w-3 h-3 text-amber-400/80" />}
                          <span>{s}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search coding challenges..."
                      value={lcSearch}
                      onChange={(e) => setLcSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Difficulty & Concept Filter */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
                  {/* Difficulty Tabs */}
                  <div className="flex items-center gap-1.5">
                    {["ALL", "EASY", "MEDIUM", "HARD"].map((d) => (
                      <button
                        key={d}
                        onClick={() => setLcDifficulty(d)}
                        className={`px-3 py-1 rounded-xl font-semibold border transition-all ${
                          lcDifficulty === d
                            ? "bg-slate-800 text-white border-slate-600 shadow-sm"
                            : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {d === "ALL" ? "All Difficulties" : d}
                      </button>
                    ))}
                  </div>

                  {/* Concept Filter Pills */}
                  {lcConceptsList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto max-w-xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Concept:
                      </span>
                      <button
                        onClick={() => setLcConcept("ALL")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          lcConcept === "ALL"
                            ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        All ({lcConceptsList.length})
                      </button>
                      {lcConceptsList.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          onClick={() => setLcConcept(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all truncate max-w-[150px] ${
                            lcConcept === c
                              ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                              : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Locked Skill Warning Banner */}
              {isSkillLocked && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Coding Challenges Locked for {lcSkill}</h4>
                      <p className="text-xs text-amber-300/80">
                        {skillLockReason || `Watch video tutorials for ${lcSkill} on your Learning Roadmap to unlock.`}
                      </p>
                    </div>
                  </div>

                  <a
                    href="/student/roadmap"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shrink-0"
                  >
                    <span>Go to Learning Roadmap</span>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Problems Grid */}
              {lcProblems.length === 0 ? (
                <div className="text-center py-16 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-8 space-y-2">
                  <Terminal className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">No problems found for {lcSkill}</p>
                  <p className="text-xs text-slate-500">Try adjusting your difficulty or concept filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      Showing {lcProblems.length} of {lcTotal} coding challenges for <strong>{lcSkill}</strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <span>Solved: <strong className="text-emerald-400">{lcTotalSolved}</strong></span>
                      <span className="font-mono text-emerald-400 font-semibold">⚡ Powered by Groq AI</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {lcProblems.map((p) => (
                      <LeetCodeProblemCard
                        key={p.question_id}
                        problem={p}
                        onSelect={() => setSelectedLcQuestionId(p.question_id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODALS & TEST RUNNER                                                      */}
      {/* ========================================================================= */}

      {/* LeetCode Workspace Overlay */}
      {selectedLcQuestionId && (
        <LeetCodeWorkspace
          questionId={selectedLcQuestionId}
          onClose={() => setSelectedLcQuestionId(null)}
          onSolved={loadLcProblems}
        />
      )}

      {/* Active MCQ Test Runner Overlay */}
      {activeSession && (
        <MCQTestRunner
          session={activeSession}
          onClose={() => setActiveSession(null)}
          onCompleted={(result) => {
            setActiveSession(null);
            setTestResult(result);
            loadTopics();
          }}
        />
      )}

      {/* MCQ Test Results Modal */}
      {testResult && (
        <MCQResultModal
          result={testResult}
          topicTitle={topics.find((t) => t.topic_id === lastFinishedTopicId)?.title || "Skill Assessment"}
          onClose={() => setTestResult(null)}
        />
      )}
    </div>
  );
}
