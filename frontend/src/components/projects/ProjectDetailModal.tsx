"use client";

import { ProjectCard, acceptProject } from "@/lib/projectsApi";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import GroupPanel from "./GroupPanel";

interface DetailModalProps {
  project: ProjectCard;
  onClose: () => void;
  onSubmit: () => void;
  onAccepted?: () => void;
}

function sanitizeTags(rawList: string[]): string[] {
  const result: string[] = [];
  for (const item of rawList || []) {
    if (!item) continue;
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

export default function ProjectDetailModal({
  project,
  onClose,
  onSubmit,
  onAccepted,
}: DetailModalProps) {
  const [isAccepted, setIsAccepted] = useState(
    Boolean(project.is_accepted || project.status !== "available")
  );
  const [accepting, setAccepting] = useState(false);

  const skills = sanitizeTags(project.required_skills);

  const handleAccept = async () => {
    if (isAccepted || accepting) return;
    setAccepting(true);
    try {
      await acceptProject(project.project_id);
      setIsAccepted(true);
      toast.success(
        `Accepted "${project.title}"! It's now active on your board. 🚀`
      );
      if (onAccepted) onAccepted();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to accept project.");
    } finally {
      setAccepting(false);
    }
  };

  const getFullDownloadUrl = (url: string) => {
    if (url.startsWith("http")) return url;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";
    const origin = base.replace(/\/v1\/?$/, "");
    return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/8 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-2xl p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
              {project.company_logo_emoji ?? "🏢"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-sky-400">
                  {project.company_name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                  {project.difficulty}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {project.deadline_days}d Window
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-white leading-snug break-words">
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

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 scrollbar-thin">
          {/* Complete Project Idea / Scope */}
          {project.project_idea ? (
            <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-sky-500/5 border border-indigo-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Complete Project Concept &amp; Core Idea</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {project.project_idea}
              </p>
            </div>
          ) : null}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Project Overview &amp; Background
            </h4>
            <div className="p-3.5 sm:p-4 rounded-xl bg-white/3 border border-white/6 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {project.description}
            </div>
          </div>

          {/* Mandatory Project Specification Document */}
          {project.spec_document_url && (
            <div>
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Official Project Specification Document
              </h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 gap-3 hover:bg-emerald-500/15 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
                    <FileDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                      {project.spec_document_name || "Project_Specification.pdf"}
                    </p>
                    <p className="text-[11px] sm:text-xs text-emerald-400/80 mt-0.5">
                      Provided by {project.company_name} — Download full spec
                    </p>
                  </div>
                </div>
                <a
                  href={getFullDownloadUrl(project.spec_document_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-950/40 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Download Spec
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
              <div className="p-3.5 sm:p-4 rounded-xl bg-white/3 border border-white/6 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
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
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required Skills */}
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

          {/* Starter Resources */}
          {project.resources && project.resources.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Starter Resources &amp; Documentation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.resources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/6 text-xs text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/20 transition-all group"
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

          {/* Team formation panel */}
          {isAccepted && project.status === "available" && (
            <div className="pt-2 border-t border-white/6">
              <GroupPanel projectId={project.project_id} />
            </div>
          )}
        </div>

        {/* Modal Footer actions */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/8 bg-slate-900/90 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:text-white hover:border-white/20 transition-all order-2 sm:order-1"
          >
            Close
          </button>

          {project.status === "evaluated" || project.status === "submitted" ? (
            <div className="w-full sm:flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold flex items-center justify-center gap-2 order-1 sm:order-2">
              <CheckCircle2 className="w-4 h-4" />
              {project.status === "evaluated"
                ? "Evaluated & Scored"
                : "Submitted"}
            </div>
          ) : !isAccepted ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-sky-950/40 transition-all active:scale-[0.98] disabled:opacity-50 order-1 sm:order-2"
            >
              {accepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {accepting ? "Accepting..." : "Accept Project Brief"}
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onSubmit();
              }}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:from-emerald-500/35 hover:to-teal-500/35 transition-all shadow-lg shadow-emerald-950/30 order-1 sm:order-2"
            >
              <Send className="w-4 h-4" /> Submit Solution
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
