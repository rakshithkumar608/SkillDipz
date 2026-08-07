"use client";

import { StudentProject, joinStudentProject, updateStudentProject } from "@/lib/projectsApi";
import { Check, Copy, ExternalLink, Lock, UserCircle2, Users } from "lucide-react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { toast } from "sonner";

interface Props {
  project: StudentProject;
  onRefresh: () => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Advanced: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function StudentProjectCard({ project, onRefresh }: Props) {
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);

  const copyCode = () => {
    if (project.invite_code) {
      navigator.clipboard.writeText(project.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoin = async () => {
    if (!project.invite_code) return;
    setJoining(true);
    try {
      const res = await joinStudentProject(project.invite_code);
      toast.success(res.message);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to join.");
    } finally {
      setJoining(false);
    }
  };

  const handleToggleOpen = async () => {
    try {
      await updateStudentProject(project.project_id, { is_open: !project.is_open });
      toast.success(project.is_open ? "Project closed to new members." : "Project is now open!");
      onRefresh();
    } catch {
      toast.error("Failed to update project.");
    }
  };

  const isMember = project.invite_code !== null;
  const isFull = project.current_members >= project.max_members;

  return (
    <div className="bg-slate-900/60 border border-white/6 rounded-2xl p-5 flex flex-col gap-4 hover:border-white/10 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <UserCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-xs text-slate-400 truncate">{project.creator_name}</span>
            {project.is_mine && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 font-semibold">
                You
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white text-base leading-snug">{project.title}</h3>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${DIFFICULTY_COLOR[project.difficulty]}`}>
          {project.difficulty}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{project.description}</p>

      {/* Tech Stack */}
      {project.tech_stack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.tech_stack.map((t) => (
            <span key={t} className="text-[10px] text-slate-300 bg-white/4 px-2 py-0.5 rounded-lg border border-white/6">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Looking for */}
      {project.looking_for.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users className="w-3 h-3 text-indigo-400 shrink-0" />
          <span className="text-[10px] text-slate-500">Looking for:</span>
          {project.looking_for.map((r) => (
            <span key={r} className="text-[10px] text-indigo-300 bg-indigo-500/8 px-2 py-0.5 rounded-lg border border-indigo-500/15">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Members + status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Users className="w-3.5 h-3.5" />
          <span>{project.current_members}/{project.max_members} members</span>
        </div>
        {isFull || !project.is_open ? (
          <span className="flex items-center gap-1 text-slate-500">
            <Lock className="w-3 h-3" /> Closed
          </span>
        ) : (
          <span className="text-emerald-400 font-medium">Open</span>
        )}
      </div>

      {/* Invite Code (only if member or mine) */}
      {isMember && (
        <div className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-xl border border-white/6">
          <code className="flex-1 text-sky-400 font-mono text-sm tracking-widest">
            {project.invite_code}
          </code>
          <button
            onClick={copyCode}
            className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Links */}
      {(project.github_url || project.demo_url) && (
        <div className="flex gap-2">
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-all"
            >
              <FaGithub className="w-3.5 h-3.5" /> Repo
            </a>
          )}
          {project.demo_url && (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Demo
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 mt-auto">
        {project.is_mine ? (
          <button
            onClick={handleToggleOpen}
            className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
              project.is_open
                ? "border-white/8 text-slate-400 hover:text-white hover:bg-white/5"
                : "bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25"
            }`}
          >
            {project.is_open ? "Close to Members" : "Reopen Project"}
          </button>
        ) : isMember ? (
          <div className="flex-1 py-2 text-center text-xs text-slate-500 border border-white/6 rounded-xl">
            ✓ Joined
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining || isFull || !project.is_open}
            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-40 transition-all"
          >
            {joining ? "Joining..." : isFull ? "Full" : "Request to Join"}
          </button>
        )}
      </div>
    </div>
  );
}
