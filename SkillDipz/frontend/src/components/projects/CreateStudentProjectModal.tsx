"use client";

import { createStudentProject, CreateStudentProjectPayload } from "@/lib/projectsApi";
import { Code2, Globe, Loader2, Plus, Users, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;

export default function CreateStudentProjectModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techInput, setTechInput] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTY_OPTIONS[number]>("Intermediate");
  const [maxMembers, setMaxMembers] = useState(5);
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const addChip = (value: string, list: string[], setList: (v: string[]) => void, setInput: (v: string) => void) => {
    const v = value.trim();
    if (v && !list.includes(v)) setList([...list, v]);
    setInput("");
  };

  const removeChip = (val: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.filter((i) => i !== val));

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    setLoading(true);
    try {
      const payload: CreateStudentProjectPayload = {
        title: title.trim(),
        description: description.trim(),
        tech_stack: techStack,
        difficulty,
        looking_for: lookingFor,
        max_members: maxMembers,
        is_public: isPublic,
        github_url: githubUrl || undefined,
        demo_url: demoUrl || undefined,
      };
      const res = await createStudentProject(payload);
      setCreatedCode(res.invite_code);
      toast.success("Project created! Share your invite code.");
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  if (createdCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">🚀</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Project Created!</h2>
            <p className="text-slate-400 text-sm mt-1">Share this code so teammates can join</p>
          </div>
          <div className="px-6 py-4 bg-slate-800/80 rounded-xl border border-white/8">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Invite Code</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 tracking-widest">{createdCode}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(createdCode); toast.success("Copied!"); }}
            className="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-all"
          >
            Copy Code
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white"
          >
            Done
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Create Project</h2>
            <p className="text-xs text-slate-400 mt-0.5">Start a team project and invite collaborators</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Project Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AI Resume Builder, Real-time Chat App"
              className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you building? What problem does it solve?"
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
            />
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              <Code2 className="inline w-3 h-3 mr-1" />Tech Stack
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {techStack.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs rounded-lg">
                  {t}
                  <button onClick={() => removeChip(t, techStack, setTechStack)} className="text-sky-500/60 hover:text-sky-400">×</button>
                </span>
              ))}
            </div>
            <input
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChip(techInput, techStack, setTechStack, setTechInput); }}}
              placeholder="Type & press Enter — React, FastAPI, MongoDB..."
              className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          {/* Looking For */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">
              <Users className="inline w-3 h-3 mr-1" />Looking For (roles)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {lookingFor.map((r) => (
                <span key={r} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-lg">
                  {r}
                  <button onClick={() => removeChip(r, lookingFor, setLookingFor)} className="text-indigo-500/60 hover:text-indigo-400">×</button>
                </span>
              ))}
            </div>
            <input
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChip(roleInput, lookingFor, setLookingFor, setRoleInput); }}}
              placeholder="Frontend Dev, ML Engineer, UI Designer..."
              className="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Difficulty + Max Members row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Difficulty</label>
              <div className="flex gap-1.5">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-all ${
                      difficulty === d
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                        : "border-white/8 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Max Members</label>
              <div className="flex gap-1.5">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxMembers(n)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      maxMembers === n
                        ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                        : "border-white/8 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">GitHub (optional)</label>
              <div className="relative">
                <FaGithub className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/8 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Demo URL (optional)</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://your-app.vercel.app"
                  className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/8 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
                />
              </div>
            </div>
          </div>

          {/* Public toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-indigo-500"
            />
            <span className="text-xs text-slate-400">Make visible in the community project feed</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-white/6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !description.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Project
          </button>
        </div>
      </motion.div>
    </div>
  );
}
