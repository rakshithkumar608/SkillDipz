"use client";

import { ProjectCard } from "@/lib/projectsApi";
import { motion } from "framer-motion";
import { CheckCircle2, Download, Send, X } from "lucide-react";
import GroupPanel from "./GroupPanel";

interface DetailModalProps {
  project: ProjectCard;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ProjectDetailModal({
  project,
  onClose,
  onSubmit,
}: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl space-y-5 scrollbar-thin"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-sky-400 font-medium">
              {project.company_name}
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {project.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Description
            </h4>
            <p className="leading-relaxed bg-white/2 p-3 rounded-xl border border-white/5">
              {project.description}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Delivarables
            </h4>
            <div className="space-y-1.5">
              <div className="space-y-1.5">
                {project.deliverables.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Required Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.required_skills.map((skill) => (
                  <span
                    className="px-2.5 py-1 text-xs bg-white/5 border border-white/8 text-slate-200 rounded-lg"
                    key={skill}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {project.resources.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Starter Resources & Documentation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {project.resources.map((res, i) => (
                    <a
                      key={i}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/3 border border-white/6 text-xs text-sky-400 hover:bg-sky-500/10 transition-all"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span className="truncate">{res.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Group formation */}
            {project.status === "available" && (
              <GroupPanel projectId={project.project_id} />
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/8">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white"
            >
              Close
            </button>
            {project.status === "available" && (
              <button
                onClick={() => {
                  onClose();
                  onSubmit();
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold hover:bg-sky-500/30"
              >
                <Send className="w-4 h-4" /> Submit Solution
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
