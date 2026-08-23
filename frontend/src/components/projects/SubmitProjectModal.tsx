"use client";

import { ProjectCard, submitProject } from "@/lib/projectsApi";
import { useAuthStore } from "@/store/authStore";
import {
  BookOpen,
  Globe,
  Loader2,
  Send,
  Users,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { toast } from "sonner";

interface SubmitModalProps {
  project: ProjectCard;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SubmitProjectModal({
  project,
  onClose,
  onSubmitted,
}: SubmitModalProps) {
  const { user } = useAuthStore();
  const [githubUrl, setGithubUrl] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [whatILearned, setWhatILearned] = useState("");
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!githubUrl.startsWith("https://github.com/")) {
      toast.error("Please enter a valid GitHub repository URL.");
      return;
    }
    if (!whatILearned.trim()) {
      toast.error("Please share what you learned from this project.");
      return;
    }
    setLoading(true);
    try {
      await submitProject(project.project_id, {
        github_url: githubUrl,
        deployment_url: deploymentUrl || undefined,
        what_i_learned: whatILearned,
        notes: notes || undefined,
        is_public: isPublic,
        group_id: groupId || undefined,
      });
      toast.success("Project submitted! NLP evaluation started. 🎉");
      onSubmitted();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail || "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const difficultyColor: Record<string, string> = {
    Beginner: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    Intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    Advanced: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/6 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              Submit Project Solution
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {project.title}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  difficultyColor[project.difficulty] ?? "text-slate-400"
                }`}
              >
                {project.difficulty}
              </span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-slate-400">
                {project.company_name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {/* Student Info (read-only) */}
          <div className="p-3 rounded-xl bg-white/3 border border-white/6">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-semibold">
              Submitting as
            </p>
            <p className="text-sm font-semibold text-white">
              {user?.full_name || "You"}
            </p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>

          {/* GitHub URL */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              GitHub Repository URL <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <FaGithub className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 focus:bg-white/8 transition-all"
              />
            </div>
          </div>

          {/* Deployment URL */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              Deployment / Live Demo URL{" "}
              <span className="text-slate-600">(Optional)</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={deploymentUrl}
                onChange={(e) => setDeploymentUrl(e.target.value)}
                placeholder="https://your-app.vercel.app or https://your-app.railway.app"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
              />
            </div>
          </div>

          {/* What I Learned */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              What Did You Understand &amp; Learn From This Project?{" "}
              <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={whatILearned}
              onChange={(e) => setWhatILearned(e.target.value)}
              placeholder="Describe your architectural decisions, key libraries used, challenges solved, and what you learned..."
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all resize-none"
            />
            <p className="text-[10px] text-slate-600 mt-1">This is shared with the company. Be specific and honest.</p>
          </div>

          {/* Implementation Notes / Brief */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              Implementation Notes / Brief <span className="text-slate-600">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tech stack choices, architecture decisions, key features you implemented..."
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 focus:bg-white/8 transition-all resize-none"
            />
          </div>

          {/* Group Code */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              Team Group Code <span className="text-slate-600">(Optional — if working as a team)</span>
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={groupId}
                onChange={(e) => setGroupId(e.target.value.toUpperCase())}
                placeholder="8-digit group code"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>
          </div>

          {/* Community toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-sky-500"
            />
            <span className="text-xs text-slate-400">
              Share with peer community feed for review &amp; suggestions
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/6 flex flex-col sm:flex-row gap-2.5 sm:gap-3 bg-slate-900/90">
          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white hover:border-white/20 transition-all order-2 sm:order-1 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !githubUrl || !whatILearned.trim()}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold hover:from-sky-500/30 hover:to-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-950/20 order-1 sm:order-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {loading ? "Submitting..." : "Submit Project"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
