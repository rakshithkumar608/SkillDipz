"use client";

import { CommunitySubmission } from "@/lib/projectsApi";
import { Globe, MessageCircle, Star, Users } from "lucide-react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import CommentSection from "./CommentSection";

interface CommunityCardProps {
  submission: CommunitySubmission;
}

export default function CommunityFeedCard({ submission }: CommunityCardProps) {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-white/6 rounded-2xl p-4 space-y-3 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 mb-0.5 truncate">
            {submission.company_name} — {submission.project_title}
          </p>
          <p className="text-sm font-semibold text-white truncate">
            {submission.student_name}
          </p>
          {submission.is_group && submission.group_name && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-400 mt-0.5">
              <Users className="w-3 h-3"/> Team: {submission.group_name}
            </span>
          )}
        </div>
        {submission.nlp_score != null && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Star className="w-3 h-3" />
            <span className="text-xs font-semibold">
              {Math.round(submission.nlp_score * 100)}%
            </span>
          </div>
        )}
      </div>

      {submission.verified_skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {submission.verified_skills.map((skill) => (
            <span key={skill} className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              ✓ {skill}
            </span>
          ))}
        </div>
      )}

      {submission.notes && <p className="text-xs text-slate-400 line-clamp-2">{submission.notes}</p>}

       <div className="flex items-center gap-3 pt-1 text-xs flex-wrap">
        <a href={submission.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-300 hover:text-white">
          <FaGithub className="w-3.5 h-3.5" /> Repository
        </a>
        {submission.demo_url && (
          <a href={submission.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
            <Globe className="w-3.5 h-3.5" /> Live Demo
          </a>
        )}
        <span className="hidden sm:flex-1" />
        <button onClick={() => setShowComments((p) => !p)} className="flex items-center gap-1 text-slate-400 hover:text-sky-400 ml-auto sm:ml-0">
          <MessageCircle className="w-3.5 h-3.5" /> {submission.comment_count > 0 && submission.comment_count} Suggestions
        </button>
      </div>

      {showComments && <CommentSection submissionId={submission.submission_id} />}

    </div>
  )
}