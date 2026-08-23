"use client";

import {
  CompanyProject,
  CompanySubmission,
  CreateProjectPayload,
  createCompanyProject,
  fetchCompanyProjects,
  fetchProjectSubmissions,
  uploadProjectSpec,
} from "@/lib/CompanyApi";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileDown,
  FileText,
  FolderOpen,
  Globe,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaGithub } from "react-icons/fa";
import { toast } from "sonner";

// ─── Helpers: Smart Tag Sanitizer ──────────────────────────────────────────

/**
 * Intelligently breaks down raw blocks of text or comma/colon-separated skills
 * into crisp, beautiful individual tags (e.g. "React.js", "Node.js", "MongoDB").
 */
function sanitizeTags(rawList: string[]): string[] {
  const result: string[] = [];
  for (const item of rawList || []) {
    if (!item) continue;
    // Split by commas, newlines, semicolons, or prefix labels like "Frontend:", "Backend:"
    const tokens = item
      .replace(/Frontend:|Backend:|Database:|Authentication:|API:|Deployment:/gi, ",")
      .replace(/[•\t\r]+/g, " ")
      .split(/[,;\n+]+/);

    for (const t of tokens) {
      const clean = t.trim().replace(/^[-•*]\s*/, "");
      if (clean.length > 1 && clean.length < 35 && !result.includes(clean)) {
        result.push(clean);
      }
    }
  }
  return result.length > 0 ? result : rawList;
}

function formatDownloadUrl(url: string): string {
  if (!url) return "#";
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";
  const origin = base.replace(/\/v1\/?$/, "");
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

// ─── Difficulty badge ────────────────────────────────────────────────────────

function DifficultyBadge({ diff }: { diff: string }) {
  const map: Record<string, string> = {
    Beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Advanced: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
        map[diff] ?? "bg-slate-800 text-slate-400 border-slate-700"
      }`}
    >
      {diff}
    </span>
  );
}

// ─── Evaluation status badge ─────────────────────────────────────────────────

function EvalBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    evaluated: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        map[status] ?? "bg-slate-700 text-slate-300"
      }`}
    >
      {status}
    </span>
  );
}

// ─── Company Project Detail Modal ─────────────────────────────────────────────

function CompanyProjectDetailModal({
  project,
  onClose,
  onOpenSubmissions,
}: {
  project: CompanyProject;
  onClose: () => void;
  onOpenSubmissions: () => void;
}) {
  const skills = sanitizeTags(project.required_skills);
  const roles = sanitizeTags(project.target_roles);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/8 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <DifficultyBadge diff={project.difficulty} />
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/6 font-medium">
                  {project.deadline_days} Days Window
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {project.visibility === "all_students"
                    ? "All Students"
                    : "Shortlisted Only"}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white leading-snug">
                {project.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live engagement stats bar */}
        <div className="px-6 py-3 border-b border-white/6 bg-white/2 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-xs text-slate-300">
                <strong className="text-sky-400 font-bold">
                  {project.acceptance_count}
                </strong>{" "}
                Students Accepted
              </span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-300">
                <strong className="text-emerald-400 font-bold">
                  {project.submission_count}
                </strong>{" "}
                Submissions Received
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenSubmissions();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            Review Submissions ({project.submission_count})
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Project Concept & Idea */}
          {project.project_idea && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-sky-500/5 border border-indigo-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Complete Project Concept &amp; Business Scope</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {project.project_idea}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Project Summary
            </h4>
            <div className="p-4 rounded-xl bg-white/3 border border-white/6 text-sm text-slate-300 leading-relaxed">
              {project.description}
            </div>
          </div>

          {/* Attached Specification Document */}
          {project.spec_document_url && (
            <div>
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Uploaded Project Specification Document
              </h4>
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
                    <FileDown className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {project.spec_document_name || "Project_Specification.pdf"}
                    </p>
                    <p className="text-xs text-emerald-400/80 mt-0.5">
                      Attached guideline document available for student download
                    </p>
                  </div>
                </div>
                <a
                  href={formatDownloadUrl(project.spec_document_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-950/40 shrink-0 ml-3"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </a>
              </div>
            </div>
          )}

          {/* Architecture Overview */}
          {project.architecture_overview && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                Architecture &amp; Technical Requirements
              </h4>
              <div className="p-4 rounded-xl bg-white/3 border border-white/6 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {project.architecture_overview}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {project.deliverables && project.deliverables.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Expected Deliverables
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.deliverables.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills & Roles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skills.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Required Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <span
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg"
                      key={skill}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {roles.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Target Roles
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => (
                    <span
                      className="px-2.5 py-1 text-xs font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg"
                      key={role}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Starter Resources */}
          {project.resources && project.resources.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Reference Resources &amp; Documentation Links
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.resources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/6 text-xs text-sky-400 hover:bg-sky-500/10 transition-all group"
                  >
                    <span className="font-semibold text-slate-200 truncate group-hover:text-sky-300">
                      {res.name}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/8 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:text-white hover:border-white/20 transition-all"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenSubmissions();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:from-emerald-500/30 hover:to-teal-500/30 transition-all shadow-lg shadow-emerald-950/40"
          >
            <Zap className="w-4 h-4" />
            View Submissions ({project.submission_count})
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Submissions Drawer ───────────────────────────────────────────────────────

function SubmissionsDrawer({
  project,
  onClose,
}: {
  project: CompanyProject;
  onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<CompanySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectSubmissions(project.project_id)
      .then(setSubmissions)
      .catch((err: any) => {
        toast.error(
          err?.response?.data?.detail ?? "Failed to load submissions."
        );
      })
      .finally(() => setLoading(false));
  }, [project.project_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="h-full w-full max-w-2xl bg-slate-900 border-l border-white/10 flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white line-clamp-1">
              {project.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {submissions.length} submission
              {submissions.length !== 1 ? "s" : ""} ·{" "}
              {project.acceptance_count} student
              {project.acceptance_count !== 1 ? "s" : ""} accepted
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stat row */}
        <div className="px-6 py-3 border-b border-white/4 flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs text-slate-300">
              <span className="font-semibold text-sky-400">
                {project.acceptance_count}
              </span>{" "}
              accepted
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-slate-300">
              <span className="font-semibold text-emerald-400">
                {project.submission_count}
              </span>{" "}
              submitted
            </span>
          </div>
          <DifficultyBadge diff={project.difficulty} />
        </div>

        {/* Submissions list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading submissions...</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/5">
                <FolderOpen className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm font-medium">
                No submissions yet
              </p>
              <p className="text-slate-600 text-xs text-center max-w-xs">
                Students who submit will appear here with their GitHub repos,
                learning summaries, and NLP code evaluation.
              </p>
            </div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.submission_id}
                className="rounded-xl bg-slate-800/50 border border-white/6 overflow-hidden"
              >
                {/* Submission header */}
                <button
                  onClick={() =>
                    setExpanded(
                      expanded === sub.submission_id ? null : sub.submission_id
                    )
                  }
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-sky-500 flex items-center justify-center shrink-0 text-xs font-bold text-white">
                      {sub.student_name[0]?.toUpperCase() ?? "S"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {sub.student_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <EvalBadge status={sub.evaluation_status} />
                        {sub.nlp_score !== null && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            NLP: {Math.round(sub.nlp_score * 100)}%
                          </span>
                        )}
                        {sub.is_group && (
                          <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded-full">
                            Team: {sub.group_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                      expanded === sub.submission_id ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded === sub.submission_id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3 mt-0">
                        {/* Links */}
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <a
                            href={sub.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/60 text-xs text-slate-300 hover:text-white hover:bg-slate-700 border border-white/8 transition-all"
                          >
                            <FaGithub className="w-3.5 h-3.5" /> GitHub Repo
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                          {(sub.deployment_url || sub.demo_url) && (
                            <a
                              href={sub.deployment_url ?? sub.demo_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-xs text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                            >
                              <Globe className="w-3.5 h-3.5" /> Live Demo
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          )}
                        </div>

                        {/* What I Learned */}
                        {sub.what_i_learned && (
                          <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">
                                What they learned
                              </p>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {sub.what_i_learned}
                            </p>
                          </div>
                        )}

                        {/* Notes / Brief */}
                        {sub.notes && (
                          <div className="p-3 rounded-lg bg-slate-700/30 border border-white/5">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                              Implementation Notes
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {sub.notes}
                            </p>
                          </div>
                        )}

                        {/* Verified Skills */}
                        {sub.verified_skills &&
                          sub.verified_skills.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Verified Skills
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {sub.verified_skills.map((s) => (
                                  <span
                                    key={s}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Team members */}
                        {sub.is_group &&
                          sub.group_members &&
                          sub.group_members.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Team Members
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {sub.group_members.map((m) => (
                                  <span
                                    key={m.student_id}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                  >
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        <p className="text-[10px] text-slate-600">
                          Submitted{" "}
                          {new Date(sub.submitted_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

const STEP_LABELS = [
  "Project Concept",
  "Specs & File (Mandatory)",
  "Skills & Roles",
  "Resources",
];

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [projectIdea, setProjectIdea] = useState("");
  const [description, setDescription] = useState("");
  const [architectureOverview, setArchitectureOverview] = useState("");
  const [specDocumentUrl, setSpecDocumentUrl] = useState("");
  const [specDocumentName, setSpecDocumentName] = useState("");

  const [difficulty, setDifficulty] = useState<
    "Beginner" | "Intermediate" | "Advanced"
  >("Intermediate");
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [visibility, setVisibility] = useState<
    "all_students" | "shortlisted_only"
  >("all_students");

  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [deliverableInput, setDeliverableInput] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);

  const [resName, setResName] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resources, setResources] = useState<{ name: string; url: string }[]>(
    []
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const res = await uploadProjectSpec(file);
      setSpecDocumentUrl(res.url);
      setSpecDocumentName(res.filename);
      toast.success(
        `Project specification document "${res.filename}" uploaded! 📄`
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to upload file.");
    } finally {
      setUploadingFile(false);
    }
  };

  const addTag = (
    val: string,
    list: string[],
    setter: (v: string[]) => void,
    inputSetter: (v: string) => void
  ) => {
    const cleanTokens = sanitizeTags([val]);
    const nextList = [...list];
    for (const t of cleanTokens) {
      if (!nextList.includes(t)) {
        nextList.push(t);
      }
    }
    setter(nextList);
    inputSetter("");
  };

  const removeTag = (
    idx: number,
    list: string[],
    setter: (v: string[]) => void
  ) => {
    setter(list.filter((_, i) => i !== idx));
  };

  const addResource = () => {
    if (resName.trim() && resUrl.trim()) {
      setResources([
        ...resources,
        { name: resName.trim(), url: resUrl.trim() },
      ]);
      setResName("");
      setResUrl("");
    }
  };

  const canNext = () => {
    if (step === 0)
      return (
        title.trim().length >= 3 &&
        description.trim().length >= 10 &&
        projectIdea.trim().length >= 10
      );
    if (step === 1) {
      // Spec document file upload is mandatory!
      return Boolean(specDocumentUrl && specDocumentName);
    }
    if (step === 2) return skills.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!specDocumentUrl) {
      toast.error("Please upload the project specification document first.");
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      const payload: CreateProjectPayload = {
        title,
        description,
        project_idea: projectIdea,
        architecture_overview: architectureOverview,
        spec_document_url: specDocumentUrl,
        spec_document_name: specDocumentName,
        target_roles: roles,
        required_skills: skills,
        difficulty,
        deliverables,
        deadline_days: deadlineDays,
        visibility,
        resources,
      };
      await createCompanyProject(payload);
      toast.success("Project brief posted! Students will be notified. 🎉");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Post Real Company Project Brief
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step
                    ? "bg-emerald-500 text-white"
                    : i === step
                    ? "bg-emerald-500/20 border border-emerald-500/60 text-emerald-400"
                    : "bg-white/5 border border-white/10 text-slate-600"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block truncate ${
                  i === step
                    ? "text-emerald-400"
                    : i < step
                    ? "text-slate-300"
                    : "text-slate-600"
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`h-px flex-1 ${
                    i < step ? "bg-emerald-500/40" : "bg-white/5"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {/* Step 0 — Basics & Complete Project Idea */}
          {step === 0 && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Project Title <span className="text-rose-400">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build an E-commerce Payment & Order Gateway..."
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Complete Project Concept &amp; Core Idea{" "}
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={projectIdea}
                  onChange={(e) => setProjectIdea(e.target.value)}
                  placeholder="Explain the entire core problem, business logic, why this project is important, and how it will be evaluated..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Brief Summary / Description{" "}
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short 2-3 sentence overview shown on the project card..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(
                        e.target.value as
                          | "Beginner"
                          | "Intermediate"
                          | "Advanced"
                      )
                    }
                    className="w-full px-3 py-2.5 bg-slate-900 border border-white/8 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">
                    Completion Window (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(
                      e.target.value as "all_students" | "shortlisted_only"
                    )
                  }
                  className="w-full px-3 py-2.5 bg-slate-900 border border-white/8 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                >
                  <option value="all_students">
                    All Students (Role-Matched)
                  </option>
                  <option value="shortlisted_only">
                    Shortlisted Candidates Only
                  </option>
                </select>
              </div>
            </>
          )}

          {/* Step 1 — Mandatory Document File Upload & Architecture Overview */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mandatory File Upload Box */}
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1 flex items-center justify-between">
                  <span>
                    Upload Project Specification Document{" "}
                    <span className="text-rose-400">* (Mandatory)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    PDF, DOCX, TXT, MD, ZIP (Max 20MB)
                  </span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md,.zip"
                  className="hidden"
                />

                {specDocumentUrl ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <FileCheck2 className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {specDocumentName}
                        </p>
                        <p className="text-xs text-emerald-400/80">
                          Ready &amp; attached to project brief ✓
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all ml-2 shrink-0"
                    >
                      Replace File
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      uploadingFile
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                    }`}
                  >
                    {uploadingFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                        <p className="text-xs font-semibold text-emerald-400">
                          Uploading specification document...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            Click to upload full project specification document
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Upload complete instructions, test cases, or API
                            specs for students
                          </p>
                        </div>
                        <span className="mt-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400">
                          Browse files from your computer
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Architecture & Tech Requirements */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  Architecture &amp; Technical Requirements (Optional)
                </label>
                <textarea
                  value={architectureOverview}
                  onChange={(e) => setArchitectureOverview(e.target.value)}
                  placeholder="Detail tech stack constraints, database schema guidelines, API protocols (REST / GraphQL), security requirements..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-all resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2 — Skills, Target Roles & Deliverables */}
          {step === 2 && (
            <>
              {/* Required Skills */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Required Skills <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      addTag(skillInput, skills, setSkills, setSkillInput)
                    }
                    placeholder="e.g. React.js, Node.js, Express, MongoDB (press enter or comma)"
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <button
                    onClick={() =>
                      addTag(skillInput, skills, setSkills, setSkillInput)
                    }
                    className="px-3 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-all"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skills.map((s, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      {s}
                      <button
                        onClick={() => removeTag(i, skills, setSkills)}
                        className="hover:text-rose-400 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Target Roles */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Target Job Roles (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      addTag(roleInput, roles, setRoles, setRoleInput)
                    }
                    placeholder="e.g. Backend Developer, Full Stack Engineer..."
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-all"
                  />
                  <button
                    onClick={() =>
                      addTag(roleInput, roles, setRoles, setRoleInput)
                    }
                    className="px-3 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/30 transition-all"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {roles.map((r, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20"
                    >
                      {r}
                      <button
                        onClick={() => removeTag(i, roles, setRoles)}
                        className="hover:text-rose-400 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Expected Deliverables
                </label>
                <div className="flex gap-2">
                  <input
                    value={deliverableInput}
                    onChange={(e) => setDeliverableInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      addTag(
                        deliverableInput,
                        deliverables,
                        setDeliverables,
                        setDeliverableInput
                      )
                    }
                    placeholder="e.g. Working API endpoints, Unit tests, Swagger docs..."
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                  <button
                    onClick={() =>
                      addTag(
                        deliverableInput,
                        deliverables,
                        setDeliverables,
                        setDeliverableInput
                      )
                    }
                    className="px-3 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs font-semibold hover:bg-violet-500/30 transition-all"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {deliverables.map((d, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20"
                    >
                      {d}
                      <button
                        onClick={() =>
                          removeTag(i, deliverables, setDeliverables)
                        }
                        className="hover:text-rose-400 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Starter Resources */}
          {step === 3 && (
            <>
              <p className="text-xs text-slate-400">
                Add optional reference resources — starter repos, API docs,
                tutorials, design mockups, etc.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  placeholder="Resource name (e.g. Swagger API Reference)"
                  className="px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-all"
                />
                <input
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  placeholder="https://..."
                  className="px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-all"
                />
              </div>
              <button
                onClick={addResource}
                disabled={!resName.trim() || !resUrl.trim()}
                className="w-full py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold hover:bg-sky-500/20 disabled:opacity-40 transition-all"
              >
                + Add Resource Link
              </button>
              {resources.length > 0 && (
                <div className="space-y-1.5">
                  {resources.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 border border-white/5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {r.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {r.url}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setResources(resources.filter((_, j) => j !== i))
                        }
                        className="p-1 rounded text-slate-600 hover:text-rose-400 transition-colors ml-2 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/6 flex gap-3 bg-slate-900/90">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white hover:border-white/20 transition-all font-semibold"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 disabled:opacity-40 transition-all"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:from-emerald-500/30 hover:to-teal-500/30 disabled:opacity-40 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? "Posting..." : "Post Project Brief"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onViewDetails,
  onViewSubmissions,
}: {
  project: CompanyProject;
  onViewDetails: () => void;
  onViewSubmissions: () => void;
}) {
  const skills = sanitizeTags(project.required_skills);
  const roles = sanitizeTags(project.target_roles);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-white/8 rounded-2xl p-5 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-950/20 transition-all duration-300 flex flex-col gap-4 shadow-xl"
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <DifficultyBadge diff={project.difficulty} />
            {!project.is_active ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Closed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white line-clamp-1 leading-snug group-hover:text-emerald-300 transition-colors">
            {project.title}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
        {project.description}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <div>
            <p className="text-sm font-bold text-sky-400">
              {project.acceptance_count}
            </p>
            <p className="text-[10px] text-slate-500">Accepted</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-emerald-400">
              {project.submission_count}
            </p>
            <p className="text-[10px] text-slate-500">Submitted</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <div>
            <p className="text-sm font-bold text-amber-400">
              {project.deadline_days}d
            </p>
            <p className="text-[10px] text-slate-500">Deadline</p>
          </div>
        </div>
      </div>

      {/* Spec Document Attached Link */}
      {project.spec_document_url && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-300 text-xs truncate">
              {project.spec_document_name || "Project Spec Document"}
            </span>
          </div>
          <a
            href={formatDownloadUrl(project.spec_document_url)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold shrink-0 ml-2"
          >
            <FileDown className="w-3 h-3" /> View Spec
          </a>
        </div>
      )}

      {/* Skills (Clean Tags) */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 5).map((s) => (
            <span
              key={s}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-white/6"
            >
              {s}
            </span>
          ))}
          {skills.length > 5 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800/40 text-slate-500">
              +{skills.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Target roles (Clean Tags) */}
      {roles.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
          <Briefcase className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">{roles.slice(0, 2).join(", ")}</span>
        </div>
      )}

      {/* Two Action Buttons: View Details & View Submissions */}
      <div className="flex gap-2 pt-2 mt-auto">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/8 hover:text-white transition-all"
        >
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          View Details
        </button>

        <button
          onClick={onViewSubmissions}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all shadow-lg shadow-emerald-950/20"
        >
          <Zap className="w-3.5 h-3.5" />
          Submissions ({project.submission_count})
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyProjectsPage() {
  const [projects, setProjects] = useState<CompanyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailProject, setDetailProject] = useState<CompanyProject | null>(
    null
  );
  const [viewProject, setViewProject] = useState<CompanyProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCompanyProjects();
      setProjects(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalSubmissions = projects.reduce(
    (a, p) => a + (p.submission_count || 0),
    0
  );
  const totalAcceptances = projects.reduce(
    (a, p) => a + (p.acceptance_count || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-sky-500/20 border border-emerald-500/20 shadow-lg shadow-emerald-950/30">
            <FolderOpen className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Project Hub
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Post real company briefs with spec files, track student engagement
              &amp; review submissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/6 text-xs text-slate-300 hover:bg-slate-700/60 transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:from-emerald-500/30 hover:to-teal-500/30 transition-all shadow-lg shadow-emerald-950/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Post New Project
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Projects Posted",
              value: projects.length,
              icon: FolderOpen,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10 border-emerald-500/20",
            },
            {
              label: "Students Accepted",
              value: totalAcceptances,
              icon: Users,
              color: "text-sky-400",
              bg: "bg-sky-500/10 border-sky-500/20",
            },
            {
              label: "Total Submissions",
              value: totalSubmissions,
              icon: CheckCircle2,
              color: "text-violet-400",
              bg: "bg-violet-500/10 border-violet-500/20",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`p-4 rounded-2xl border ${stat.bg} flex items-center gap-3.5 shadow-lg`}
            >
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className={`text-xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh] gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          <span className="text-slate-400 text-sm">Loading projects...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
            <FolderOpen className="w-10 h-10 text-emerald-400/40" />
          </div>
          <div className="text-center">
            <p className="text-slate-300 font-semibold text-base">
              No projects posted yet
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Post a project brief with complete specs, and students will be
              notified instantly.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Post Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <ProjectCard
              key={proj.project_id}
              project={proj}
              onViewDetails={() => setDetailProject(proj)}
              onViewSubmissions={() => setViewProject(proj)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateProjectModal
            onClose={() => setShowCreate(false)}
            onCreated={load}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailProject && (
          <CompanyProjectDetailModal
            project={detailProject}
            onClose={() => setDetailProject(null)}
            onOpenSubmissions={() => setViewProject(detailProject)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewProject && (
          <SubmissionsDrawer
            project={viewProject}
            onClose={() => setViewProject(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
