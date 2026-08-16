"use client";

import { ProjectCard, submitProject } from "@/lib/projectsApi";
import { Globe, Loader2, Send, Users, X } from "lucide-react";
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
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!githubUrl.startsWith("https://github.com/")) {
      toast.error("Please enter a valid GitHub repository URL.");
      return;
    }
    setLoading(true);
    try {
      await submitProject(project.project_id, {
        github_url: githubUrl,
        demo_url: demoUrl || undefined,
        notes: notes || undefined,
        is_public: isPublic,
        group_id: groupId || undefined,
      });
      toast.success("Project submitted! NLP evaluation started.");
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Submit Project</h2>
            <p className="text-xs text-slate-400">{project.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              GitHub Repository URL *
            </label>
            <div className="relative">
              <FaGithub className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repository"
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Deployed Demo URL (Optional)</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <input
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://your-app.railway.app"
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Implementation Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key design patterns, JWT auth, validation, database schema..."
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Group Code (If working as a team)</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={groupId}
                onChange={(e) => setGroupId(e.target.value.toUpperCase())}
                placeholder="8-digit group code"
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-sky-500"
            />
            <span className="text-xs text-slate-400">Share with peer community feed for review & suggestions</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !githubUrl}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold hover:bg-sky-500/30 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
