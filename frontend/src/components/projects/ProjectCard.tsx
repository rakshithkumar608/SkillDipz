"use client";

import { ProjectCard as ProjectCardType, acceptProject } from "@/lib/projectsApi";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProjectCardProps {
  project: ProjectCardType;
  onViewDetails: () => void;
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

export default function ProjectCard({
  project,
  onViewDetails,
  onSubmit,
  onAccepted,
}: ProjectCardProps) {
  const [accepting, setAccepting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(
    Boolean(project.is_accepted || project.status !== "available")
  );
  const [acceptanceCount, setAcceptanceCount] = useState(
    project.acceptance_count || 0
  );

  const skills = sanitizeTags(project.required_skills);

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAccepted || accepting) return;
    setAccepting(true);
    try {
      await acceptProject(project.project_id);
      setIsAccepted(true);
      setAcceptanceCount((c) => c + 1);
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

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "Beginner":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
      case "Intermediate":
        return "bg-amber-500/10 text-amber-400 border-amber-500/25";
      case "Advanced":
        return "bg-rose-500/10 text-rose-400 border-rose-500/25";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div
      className={`group relative bg-gradient-to-b from-slate-900/90 to-slate-950 border rounded-2xl p-5 flex flex-col gap-4 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] ${
        isAccepted
          ? "border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-950/20"
          : "border-white/8 hover:border-white/20 hover:bg-slate-900/95"
      }`}
    >
      {/* Top row: Company info + Difficulty */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg p-1 rounded-lg bg-white/5 border border-white/5 shrink-0">
              {project.company_logo_emoji ?? "🏢"}
            </span>
            <span className="text-xs font-semibold text-slate-300 truncate">
              {project.company_name}
            </span>
            {isAccepted && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Accepted
              </span>
            )}
          </div>
          <h3 className="font-bold text-white text-base leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
            {project.title}
          </h3>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getDifficultyColor(
            project.difficulty
          )}`}
        >
          {project.difficulty}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
        {project.description}
      </p>

      {/* Stats bar */}
      <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/3 border border-white/5 text-xs text-slate-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{project.deadline_days}d window</span>
        </div>
        <div className="w-px h-3.5 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <span>
            <strong className="text-sky-300 font-semibold">
              {acceptanceCount}
            </strong>{" "}
            working
          </span>
        </div>
        {project.spec_document_url && (
          <>
            <div className="w-px h-3.5 bg-white/10" />
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-[11px]">Spec Included</span>
            </div>
          </>
        )}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map((s) => (
            <span
              key={s}
              className="text-[10px] font-medium text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-white/6"
            >
              {s}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-800/40 px-1.5 py-0.5 rounded-md">
              +{skills.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Score badge if evaluated */}
      {project.status === "evaluated" &&
        project.my_submission?.nlp_score != null && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin-slow" />
              <span>AI Evaluation Score</span>
            </div>
            <span className="text-sm font-bold text-emerald-300">
              {Math.round(project.my_submission.nlp_score * 100)}%
            </span>
          </div>
        )}

      {/* Action CTA Buttons */}
      <div className="flex gap-2 pt-2 mt-auto">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/8 hover:text-white transition-all"
        >
          <Eye className="w-3.5 h-3.5 text-slate-400" /> Details
        </button>

        {/* Dynamic Status / Actions */}
        {project.status === "evaluated" || project.status === "submitted" ? (
          <div className="flex-1 py-2.5 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {project.status === "evaluated" ? "Evaluated" : "Submitted"}
          </div>
        ) : isAccepted ? (
          <button
            onClick={onSubmit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:from-emerald-500/30 hover:to-teal-500/30 transition-all shadow-lg shadow-emerald-950/40"
          >
            <Send className="w-3.5 h-3.5" /> Submit Work
          </button>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-950/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            {accepting ? "Accepting..." : "Accept Project"}
          </button>
        )}
      </div>
    </div>
  );
}
