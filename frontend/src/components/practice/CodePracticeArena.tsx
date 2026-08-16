"use client";

import { useCheatPrevention } from "@/hooks/useCheatPrevention";
import {
  getArenaProblems,
  submitSolvedProblem,
  logCodingActivity,
  CodingArenaProblem,
  WeakSkill,
} from "@/lib/practiceApi";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Flame,
  FolderGit2,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Terminal,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types & Constants ────────────────────────────────────────────────────────

export type CodingProblem = CodingArenaProblem;

const DIFF_STYLE: Record<
  string,
  { badge: string; border: string; glow: string; text: string }
> = {
  EASY: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    border: "border-l-emerald-500",
    glow: "shadow-emerald-500/5",
    text: "text-emerald-400",
  },
  MEDIUM: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-l-amber-500",
    glow: "shadow-amber-500/5",
    text: "text-amber-400",
  },
  HARD: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    border: "border-l-rose-500",
    glow: "shadow-rose-500/5",
    text: "text-rose-400",
  },
};

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function deepEqual(a: any, b: any): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort((x, y) =>
      Array.isArray(x) ? 0 : String(x).localeCompare(String(y))
    );
    const sb = [...b].sort((x, y) =>
      Array.isArray(x) ? 0 : String(x).localeCompare(String(y))
    );
    return sa.every((v, i) => deepEqual(v, sb[i]));
  }
  if (
    typeof a === "object" &&
    typeof b === "object" &&
    a !== null &&
    b !== null
  ) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (!deepEqual(ka, kb)) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return a === b;
}

function runCode(
  code: string,
  testCase: { input: any[]; expected: any }
): { passed: boolean; actual: any; error?: string } {
  try {
    const match = code.match(/function\s+(\w+)\s*\(/);
    if (!match)
      return {
        passed: false,
        actual: undefined,
        error: "No function definition found.",
      };
    const fnName = match[1];

    // eslint-disable-next-line no-new-func
    const fn = new Function(`${code}; return ${fnName};`)();
    if (typeof fn !== "function")
      return {
        passed: false,
        actual: undefined,
        error: "Could not find valid function.",
      };

    const actual = fn(...testCase.input);
    const passed = deepEqual(actual, testCase.expected);
    return { passed, actual };
  } catch (e: any) {
    return {
      passed: false,
      actual: undefined,
      error: e?.message ?? "Runtime execution error",
    };
  }
}

// ─── Cheat Badge Component ────────────────────────────────────────────────────

function CheatBadge({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-300 shadow-lg shadow-red-500/20 backdrop-blur-md"
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-red-400 animate-pulse" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider leading-none">
          Anti-Cheat Monitoring Active
        </p>
        <p className="text-[10px] text-red-400/80 leading-tight mt-0.5">
          Tab Switches: <span className="font-extrabold text-white">{count}/3</span>
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  lastTestSkills?: string[];
  weakSkills?: string[];
}

type View = "list" | "solve";

export default function CodePracticeArena({
  lastTestSkills = [],
  weakSkills = [],
}: Props) {
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState<CodingProblem[]>([]);
  const [backendWeakSkills, setBackendWeakSkills] = useState<WeakSkill[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<CodingProblem | null>(
    null
  );

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<string>("ALL");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");

  // Code editor state
  const [code, setCode] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    passed: number;
    total: number;
    details: {
      input: string;
      expected: string;
      actual: string;
      passed: boolean;
      error?: string;
    }[];
  } | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load Real Arena Problems from Backend ──────────────────────────────────
  const loadRealProblems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArenaProblems();
      setProblems(data.problems);
      setBackendWeakSkills(data.weak_skills);
      if (data.solved_ids) {
        setSolvedIds(new Set(data.solved_ids));
      }
    } catch {
      toast.error("Failed to load concept practice problems.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRealProblems();
  }, [loadRealProblems]);

  // Anti-cheat hook
  const { tabSwitchCount, isWarning } = useCheatPrevention({
    maxViolations: 3,
    onMaxViolations: () => {
      toast.error("Maximum tab switch violations reached! Returning to arena...");
      setTimeout(() => handleBack(), 1000);
    },
    enabled: view === "solve",
  });

  // Solve View Timer
  useEffect(() => {
    if (view === "solve") {
      setElapsedSecs(0);
      timerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, selectedProblem]);

  const handleSelectProblem = (problem: CodingProblem) => {
    setSelectedProblem(problem);
    setCode(problem.starterCode);
    setLogs([]);
    setSubmitResult(null);
    setView("solve");
  };

  const handleBack = () => {
    setView("list");
    setSelectedProblem(null);
    setSubmitResult(null);
    setLogs([]);
  };

  const handleRunSample = () => {
    if (!selectedProblem || !code.trim()) return;
    setRunning(true);
    setLogs([]);

    setTimeout(() => {
      const firstCase = selectedProblem.testCases[0];
      const result = runCode(code, firstCase);
      const newLogs: string[] = [];
      newLogs.push(`▶ Input: ${JSON.stringify(firstCase.input)}`);
      if (result.error) {
        newLogs.push(`✗ Error: ${result.error}`);
      } else {
        newLogs.push(`◉ Output: ${JSON.stringify(result.actual)}`);
        newLogs.push(`◉ Expected: ${JSON.stringify(firstCase.expected)}`);
        newLogs.push(
          result.passed ? "✓ Sample test passed!" : "✗ Sample test failed."
        );
      }
      setLogs(newLogs);
      setRunning(false);
    }, 250);
  };

  const handleSubmitCode = async () => {
    if (!selectedProblem || !code.trim()) return;
    setRunning(true);
    setSubmitResult(null);
    setLogs([]);

    setTimeout(async () => {
      const details = selectedProblem.testCases.map((tc) => {
        const result = runCode(code, tc);
        return {
          input: JSON.stringify(tc.input),
          expected: JSON.stringify(tc.expected),
          actual: result.error
            ? `Error: ${result.error}`
            : JSON.stringify(result.actual),
          passed: result.passed,
          error: result.error,
        };
      });

      const passed = details.filter((d) => d.passed).length;
      const total = details.length;

      setSubmitResult({ passed, total, details });
      setRunning(false);

      if (passed === total) {
        setSolvedIds((prev) => new Set([...prev, selectedProblem.id]));
        toast.success(`🎉 Excellent! All ${total} test cases passed!`);
        
        // Save to MongoDB permanently as solved
        try {
          await submitSolvedProblem({
            question_id: selectedProblem.id,
            title: selectedProblem.title,
            difficulty: selectedProblem.difficulty,
            topics: selectedProblem.topics,
          });
        } catch {
          // Non-critical if submission persistence fails
        }

        await logCodingActivity(
          selectedProblem.title,
          selectedProblem.difficulty,
          selectedProblem.topics
        );
      } else {
        toast.error(`${passed}/${total} test cases passed.`);
      }
    }, 350);
  };

  // ── Extract Concepts & Weak Skills ──────────────────────────────────────────
  const allConcepts = useMemo(() => {
    const conceptSet = new Set<string>();
    problems.forEach((p) => {
      const c = p.concept || p.topics?.[0] || p.skillTags?.[0];
      if (c) conceptSet.add(c);
    });
    return Array.from(conceptSet);
  }, [problems]);

  const combinedWeakSkills = useMemo(() => {
    const combined = [
      ...backendWeakSkills,
      ...weakSkills.map((s) => ({ skill: s, gap: 1, status: "in_progress" })),
    ];
    return Array.from(
      new Map(combined.map((item) => [item.skill.toLowerCase(), item])).values()
    );
  }, [backendWeakSkills, weakSkills]);

  // Filtered problems list
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.concept && p.concept.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.topics.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesConcept =
        selectedConcept === "ALL" ||
        (p.concept && p.concept.toLowerCase() === selectedConcept.toLowerCase()) ||
        p.topics.some((t) => t.toLowerCase() === selectedConcept.toLowerCase()) ||
        p.skillTags.some((s) => s.toLowerCase() === selectedConcept.toLowerCase());

      const matchesDifficulty =
        selectedDifficulty === "ALL" ||
        p.difficulty.toUpperCase() === selectedDifficulty.toUpperCase();

      return matchesSearch && matchesConcept && matchesDifficulty;
    });
  }, [problems, searchQuery, selectedConcept, selectedDifficulty]);

  const elapsedMins = Math.floor(elapsedSecs / 60);
  const elapsedSecsPart = elapsedSecs % 60;

  // ── 1. ARENA LIST VIEW ──────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-2">
        {/* Top Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Concept-Wise Practice Arena
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Skill Gap & Concept Coding Arena
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Practice real-time programming challenges specifically generated
                around your identified skill gaps. Master sub-concepts step by step.
              </p>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md self-start md:self-auto">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Solved Challenges</p>
                <p className="text-lg font-bold text-white">
                  {solvedIds.size} <span className="text-xs font-normal text-slate-500">/ {problems.length}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Weak Skills Banner */}
          {combinedWeakSkills.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Target Skill Gaps:
              </span>
              {combinedWeakSkills.map((s) => (
                <button
                  key={s.skill}
                  onClick={() => setSelectedConcept(s.skill)}
                  className={`text-xs px-3 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                    selectedConcept.toLowerCase() === s.skill.toLowerCase()
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/10"
                      : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  {s.skill}
                  {s.gap > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-200">
                      Gap {s.gap}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter & Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/80 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, concept, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Concept Dropdown/Pill */}
            <div className="flex items-center gap-1 bg-slate-950/60 border border-white/10 p-1 rounded-xl">
              <Layers className="w-3.5 h-3.5 text-slate-400 ml-2" />
              <select
                value={selectedConcept}
                onChange={(e) => setSelectedConcept(e.target.value)}
                className="bg-transparent text-xs text-slate-200 py-1 pr-3 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">All Concepts</option>
                {allConcepts.map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filters */}
            <div className="flex items-center gap-1 bg-slate-950/60 border border-white/10 p-1 rounded-xl">
              {["ALL", "EASY", "MEDIUM", "HARD"].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDifficulty(d)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    selectedDifficulty === d
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadRealProblems}
              disabled={loading}
              title="Refresh / Fetch Latest Problems"
              className="p-2 rounded-xl bg-slate-950/60 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-md space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm font-medium text-slate-300">
              Generating concept-wise challenges for your skill gaps...
            </p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-md space-y-3">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No matching challenges found</h3>
            <p className="text-xs text-slate-500">Try adjusting your concept filter or search terms.</p>
          </div>
        ) : (
          /* Problems List / Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProblems.map((problem, idx) => {
              const diff = DIFF_STYLE[problem.difficulty] ?? DIFF_STYLE["EASY"];
              const isSolved = solvedIds.has(problem.id);
              const conceptName = problem.concept || problem.topics?.[0] || problem.skillTags?.[0] || "General";

              return (
                <motion.div
                  key={problem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`group relative flex flex-col justify-between bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-5 backdrop-blur-md transition-all duration-200 hover:shadow-xl ${diff.border} border-l-4`}
                >
                  <div className="space-y-3">
                    {/* Card Header: Concept Tag + Difficulty */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-medium">
                        <FolderGit2 className="w-3 h-3 text-indigo-400" />
                        {conceptName}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${diff.badge}`}>
                        {problem.difficulty}
                      </span>
                    </div>

                    {/* Title & Index */}
                    <div>
                      <span className="text-[11px] font-mono font-bold text-slate-500 block mb-1">
                        PROBLEM #{String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                        {problem.title}
                      </h3>
                    </div>

                    {/* Description excerpt */}
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {problem.description}
                    </p>

                    {/* Topics Pills */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {problem.topics.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {problem.testCases.length} Test Specs
                    </span>
                    <button
                      onClick={() => handleSelectProblem(problem)}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                        isSolved
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                          : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 group-hover:scale-105"
                      }`}
                    >
                      {isSolved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                        </>
                      ) : (
                        <>
                          Solve Challenge <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 2. PROBLEM SOLVE VIEW ──────────────────────────────────────────────────
  if (!selectedProblem) return null;
  const diff = DIFF_STYLE[selectedProblem.difficulty] ?? DIFF_STYLE["EASY"];
  const conceptTitle =
    selectedProblem.concept || selectedProblem.topics?.[0] || "General Concept";

  return (
    <div className="max-w-7xl mx-auto space-y-4 px-1 sm:px-2">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-white/10 p-3.5 rounded-2xl backdrop-blur-xl">
        {/* Back Button & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Arena Problems
          </button>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>/</span>
            <span className="text-indigo-400">{conceptTitle}</span>
            <span>/</span>
            <span className="text-white font-bold truncate max-w-[200px]">
              {selectedProblem.title}
            </span>
          </div>
        </div>

        {/* Action Controls & Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {String(elapsedMins).padStart(2, "0")}:{String(elapsedSecsPart).padStart(2, "0")}
            </span>
          </div>

          {/* Run Sample */}
          <button
            onClick={handleRunSample}
            disabled={running}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-slate-200 font-semibold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" /> Run Sample
          </button>

          {/* Submit */}
          <button
            onClick={handleSubmitCode}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs text-emerald-300 font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/10"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Submit Code
          </button>

          {/* Anti-Cheat Badge */}
          {isWarning ? (
            <CheatBadge count={tabSwitchCount} />
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Anti-Cheat Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[620px]">
        {/* LEFT PANE: Problem Description */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-6 overflow-y-auto max-h-[82vh] backdrop-blur-xl">
          {/* Header info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                Concept: {conceptTitle}
              </span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${diff.badge}`}>
                {selectedProblem.difficulty}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{selectedProblem.title}</h2>
          </div>

          {/* Problem Statement */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Problem Description
            </h4>
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/50 border border-white/5 rounded-xl p-4">
              {selectedProblem.description}
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Examples
            </h4>
            {selectedProblem.examples.map((ex, i) => (
              <div
                key={i}
                className="bg-slate-950/70 rounded-xl p-4 space-y-2 border border-white/5"
              >
                <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                  Example {i + 1}
                </p>
                <div className="font-mono text-xs text-slate-300 space-y-1">
                  <p><span className="text-slate-500">Input:</span> {ex.input}</p>
                  <p><span className="text-slate-500">Output:</span> {ex.output}</p>
                </div>
                {ex.explanation && (
                  <p className="text-xs text-slate-400 italic pt-1 border-t border-white/5">
                    {ex.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Function Signature */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Function Signature
            </h4>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-white/10 font-mono text-xs text-emerald-400">
              {selectedProblem.functionSignature}
            </div>
          </div>

          {/* Topics */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {selectedProblem.topics.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400 font-medium"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT PANE: Code Editor & Execution Console */}
        <div className="flex flex-col gap-4">
          {/* JavaScript Editor */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden flex-1 flex flex-col backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Solution Editor (JavaScript)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">ES6 standard</span>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-72 lg:h-96 bg-slate-950/90 p-4 font-mono text-xs text-cyan-300 placeholder-slate-600 resize-none focus:outline-none leading-relaxed"
              style={{ tabSize: 2 }}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  setCode((c) => c.substring(0, start) + "  " + c.substring(end));
                  setTimeout(() => {
                    e.currentTarget.selectionStart = start + 2;
                    e.currentTarget.selectionEnd = start + 2;
                  }, 0);
                }
              }}
            />
          </div>

          {/* Test Case Submission Results */}
          <AnimatePresence>
            {submitResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-2xl border p-4 space-y-3 backdrop-blur-xl ${
                  submitResult.passed === submitResult.total
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {submitResult.passed === submitResult.total ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="text-sm font-bold">
                      {submitResult.passed} / {submitResult.total} Test Cases Passed
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {submitResult.details.map((d, i) => (
                    <div
                      key={i}
                      className={`text-xs p-2.5 rounded-xl font-mono flex items-center justify-between ${
                        d.passed
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                      }`}
                    >
                      <span>
                        Test #{i + 1}: {d.passed ? "PASSED" : "FAILED"}
                      </span>
                      {!d.passed && (
                        <span className="text-[11px] opacity-80">
                          Got: {d.actual} | Expected: {d.expected}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Console Logs Box */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Execution Output Console
                </span>
              </div>
              {running && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
            </div>

            <div className="p-4 min-h-[90px] max-h-[140px] overflow-y-auto font-mono text-xs space-y-1 bg-slate-950">
              {logs.length === 0 ? (
                <p className="text-slate-600 italic">No output yet. Run sample or submit code.</p>
              ) : (
                logs.map((log, i) => (
                  <p
                    key={i}
                    className={
                      log.startsWith("✓")
                        ? "text-emerald-400 font-bold"
                        : log.startsWith("✗")
                        ? "text-rose-400 font-bold"
                        : log.startsWith("▶")
                        ? "text-cyan-400"
                        : "text-slate-300"
                    }
                  >
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
