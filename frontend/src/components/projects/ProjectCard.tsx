"use client";

import { ProjectCard as ProjectCardType } from "@/lib/projectsApi";
import { Clock, Send, Eye, CheckCircle2, Sparkles } from "lucide-react";

interface ProjectCardProps {
  project: ProjectCardType;
  onViewDetails: () => void;
  onSubmit: () => void;
}

export default function ProjectCard({ project, onViewDetails, onSubmit }: ProjectCardProps) {
  return (
    <div className="bg-slate-900/60 border border-white/6 rounded-2xl p-5 flex flex-col gap-4 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{project.company_logo_emoji ?? "🏢"}</span>
            <span className="text-xs text-slate-400">{project.company_name}</span>
          </div>
          <h3 className="font-semibold text-white text-base">{project.title}</h3>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
          {project.difficulty}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" /> {project.deadline_days} Days Completion Window
      </div>

      <div className="flex flex-wrap gap-1.5">
        {project.required_skills.map((s) => (
          <span key={s} className="text-[10px] text-slate-300 bg-white/4 px-2 py-0.5 rounded-lg border border-white/6">
            {s}
          </span>
        ))}
      </div>

      {project.status === "evaluated" && project.my_submission?.nlp_score != null && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Sparkles className="w-4 h-4" /> Evaluated Score: {Math.round(project.my_submission.nlp_score * 100)}%
        </div>
      )}

      <div className="flex gap-2 pt-2 mt-auto">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/8 text-slate-300 text-xs font-medium hover:bg-white/5"
        >
          <Eye className="w-3.5 h-3.5" /> Details
        </button>
        {project.status === "available" ? (
          <button
            onClick={onSubmit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/30"
          >
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
        ) : (
          <div className="flex-1 py-2 text-center rounded-xl bg-slate-800 text-slate-400 text-xs flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" /> Submitted
          </div>
        )}
      </div>
    </div>
  );
}
