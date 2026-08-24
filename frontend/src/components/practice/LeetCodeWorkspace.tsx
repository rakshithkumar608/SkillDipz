"use client";

import {
  CodeExecutionResponse,
  getLeetCodeProblemDetails,
  LeetCodeProblemDetail,
  runStudentCode,
  submitStudentCode,
} from "@/lib/practiceApi";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  HelpCircle,
  Lightbulb,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  questionId: string;
  onClose: () => void;
  onSolved?: () => void;
}

const DIFF_COLORS: Record<string, string> = {
  EASY: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  HARD: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

export default function LeetCodeWorkspace({
  questionId,
  onClose,
  onSolved,
}: Props) {
  const [problem, setProblem] = useState<LeetCodeProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [language, setLanguage] = useState<"python" | "javascript" | "typescript">("python");
  const [code, setCode] = useState("");

  const [leftTab, setLeftTab] = useState<"description" | "hints">("description");
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState(0);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionResult, setExecutionResult] = useState<CodeExecutionResponse | null>(null);
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getLeetCodeProblemDetails(questionId);
        setProblem(data);
        const starter =
          data.starter_code_templates?.[language] ||
          data.starter_code ||
          "def solve():\n    pass";
        setCode(starter);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to load coding problem.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [questionId]);

  // Handle language switch
  const handleLanguageChange = (newLang: "python" | "javascript" | "typescript") => {
    setLanguage(newLang);
    if (problem?.starter_code_templates?.[newLang]) {
      setCode(problem.starter_code_templates[newLang]);
    } else if (newLang === "python") {
      setCode(problem?.starter_code || "def solve():\n    pass");
    } else {
      setCode("function solve() {\n  // Write solution here\n}");
    }
  };

  const handleResetCode = () => {
    if (problem?.starter_code_templates?.[language]) {
      setCode(problem.starter_code_templates[language]);
    } else {
      setCode("def solve():\n    pass");
    }
    toast.success("Code reset to template.");
  };

  // Run Public Test Cases
  const handleRunCode = async () => {
    if (!problem) return;
    setIsRunning(true);
    setShowConsole(true);
    try {
      const res = await runStudentCode({
        question_id: problem.question_id,
        language,
        code,
      });
      setExecutionResult(res);
      if (res.status === "ACCEPTED") {
        toast.success("All sample test cases passed!");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Code execution failed.");
    } finally {
      setIsRunning(false);
    }
  };

  // Submit Solution against all cases
  const handleSubmitSolution = async () => {
    if (!problem) return;
    setIsSubmitting(true);
    setShowConsole(true);
    try {
      const res = await submitStudentCode({
        question_id: problem.question_id,
        language,
        code,
      });
      setExecutionResult(res);
      if (res.status === "ACCEPTED") {
        toast.success(res.message || "Accepted! Congratulations! 🎉");
        setProblem((prev) => (prev ? { ...prev, is_solved: true } : null));
        if (onSolved) onSolved();
      } else {
        toast.error(res.message || "Submission failed some test cases.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Submission evaluation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300">
          Loading LeetCode challenge workspace…
        </p>
      </div>
    );
  }

  if (!problem) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-white overflow-hidden animate-in fade-in-0 duration-200">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Problemset</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <h2 className="font-bold text-sm sm:text-base text-white flex items-center gap-2 truncate">
            <span>{problem.title}</span>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                DIFF_COLORS[problem.difficulty] || DIFF_COLORS["MEDIUM"]
              }`}
            >
              {problem.difficulty}
            </span>
            {problem.is_solved && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Solved
              </span>
            )}
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="relative">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-indigo-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none pr-8"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="typescript">TypeScript</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handleResetCode}
            title="Reset code template"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all text-xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
          >
            {isRunning ? (
              <span className="animate-spin text-indigo-400">⟳</span>
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            )}
            Run
          </button>

          {/* Submit Solution Button */}
          <button
            onClick={handleSubmitSolution}
            disabled={isRunning || isSubmitting}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20"
          >
            {isSubmitting ? (
              <span className="animate-spin text-white">⟳</span>
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Submit
          </button>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Problem Description & Specs (5 cols) */}
        <div className="lg:col-span-5 border-r border-slate-800/80 bg-slate-900/40 flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 pt-2 bg-slate-900/70 shrink-0">
            <button
              onClick={() => setLeftTab("description")}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                leftTab === "description"
                  ? "border-indigo-500 text-indigo-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Description
            </button>
            {problem.hints && problem.hints.length > 0 && (
              <button
                onClick={() => setLeftTab("hints")}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                  leftTab === "hints"
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                Hints ({problem.hints.length})
              </button>
            )}
          </div>

          {/* Description Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
            {leftTab === "description" ? (
              <>
                {/* Title and Metadata */}
                <div>
                  <h1 className="text-xl font-black text-white">{problem.title}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        DIFF_COLORS[problem.difficulty] || DIFF_COLORS["MEDIUM"]
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      #{problem.concept}
                    </span>
                    <span className="text-xs text-slate-500 font-mono ml-auto">
                      Acceptance: {problem.acceptance_rate}%
                    </span>
                  </div>
                </div>

                {/* Problem Statement */}
                <div className="text-slate-300 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                  {problem.description}
                </div>

                {/* Examples */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Examples
                  </h3>
                  {problem.examples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 font-mono text-xs"
                    >
                      <div className="text-slate-400 font-bold">Example {idx + 1}:</div>
                      <div className="text-slate-300">
                        <strong className="text-slate-500">Input:</strong> {ex.input}
                      </div>
                      <div className="text-emerald-400">
                        <strong className="text-slate-500">Output:</strong> {ex.output}
                      </div>
                      {ex.explanation && (
                        <div className="text-slate-400 text-[11px] font-sans pt-1">
                          <strong className="text-slate-500">Explanation:</strong> {ex.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Constraints */}
                {problem.constraints && problem.constraints.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Constraints
                    </h3>
                    <ul className="list-disc list-inside text-xs font-mono text-slate-300 space-y-1 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                      {problem.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Problem Solving Hints
                </h3>
                {problem.hints.map((hint, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200 space-y-1"
                  >
                    <span className="font-bold text-indigo-400 block">Hint {idx + 1}:</span>
                    <p className="leading-relaxed">{hint}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Code Editor & Test Case Console (7 cols) */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden bg-slate-950">
          {/* Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Solution.{language === "python" ? "py" : language === "typescript" ? "ts" : "js"}
              </span>
              <span className="text-[10px] text-slate-500">Auto-save Enabled</span>
            </div>

            <div className="flex-1 p-2 bg-[#0B0F19] overflow-hidden flex flex-col">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                placeholder="Write your solution here..."
                className="w-full flex-1 p-4 bg-transparent text-slate-100 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none placeholder-slate-600 selection:bg-indigo-600/40"
              />
            </div>
          </div>

          {/* Bottom Testcases & Output Panel */}
          <div className="h-64 border-t border-slate-800 bg-slate-900/90 flex flex-col overflow-hidden">
            {/* Panel Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 bg-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConsole(false)}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    !showConsole
                      ? "border-indigo-500 text-indigo-300"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Test Cases ({problem.public_test_cases.length})
                </button>
                <button
                  onClick={() => setShowConsole(true)}
                  className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
                    showConsole
                      ? "border-indigo-500 text-indigo-300"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Execution Results
                  {executionResult && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        executionResult.status === "ACCEPTED"
                          ? "bg-emerald-400"
                          : "bg-rose-400 animate-pulse"
                      }`}
                    />
                  )}
                </button>
              </div>

              {executionResult && (
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-slate-400">
                    Passed: <strong>{executionResult.passed_cases}/{executionResult.total_cases}</strong>
                  </span>
                  <span className="text-slate-400">
                    Runtime: <strong>{executionResult.runtime_ms} ms</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {!showConsole ? (
                /* Test Cases Viewer */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {problem.public_test_cases.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveTestCaseIdx(idx)}
                        className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold border transition-all ${
                          activeTestCaseIdx === idx
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {problem.public_test_cases[activeTestCaseIdx] && (
                    <div className="space-y-2 font-mono text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-slate-500 block mb-1">Input Arguments:</span>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 overflow-x-auto">
                          {JSON.stringify(problem.public_test_cases[activeTestCaseIdx].input)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Expected Return Value:</span>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 overflow-x-auto">
                          {JSON.stringify(problem.public_test_cases[activeTestCaseIdx].expected)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Execution Console Results */
                <div className="space-y-3">
                  {executionResult ? (
                    <div>
                      {/* Overall Status Banner */}
                      <div
                        className={`p-3 rounded-2xl border flex items-center justify-between mb-3 ${
                          executionResult.status === "ACCEPTED"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          {executionResult.status === "ACCEPTED" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span>{executionResult.status}</span>
                          <span className="text-slate-400 font-normal">
                            — {executionResult.message}
                          </span>
                        </div>
                        <span className="font-mono text-xs">
                          {executionResult.runtime_ms} ms
                        </span>
                      </div>

                      {/* Per-case details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs">
                        {executionResult.results.map((r, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border ${
                              r.passed
                                ? "bg-slate-950 border-emerald-500/30"
                                : "bg-slate-950 border-rose-500/40"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold">Test Case {r.case_index}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  r.passed
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {r.passed ? "PASSED" : "FAILED"}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              Expected: <span className="text-emerald-400">{JSON.stringify(r.expected)}</span>
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              Actual: <span className={r.passed ? "text-emerald-400" : "text-rose-400"}>{JSON.stringify(r.actual)}</span>
                            </div>
                            {r.error && (
                              <div className="text-rose-400 text-[10px] mt-1 font-sans bg-rose-950/40 p-1.5 rounded">
                                {r.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-xs gap-2">
                      <Terminal className="w-6 h-6 text-slate-600" />
                      <span>Click "Run" or "Submit" to test your solution.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
