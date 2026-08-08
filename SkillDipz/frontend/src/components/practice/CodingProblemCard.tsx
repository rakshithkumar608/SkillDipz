"use client";

import { addBookmark, CFProblem, removeBookmark } from "@/lib/practiceApi";
import { Bookmark, BookmarkCheck, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props { 
  problem: CFProblem;
  onSelect: () => void;
  onRefresh: () => void;
}

const DIFF_STYLE: Record<string, string> = {
  Easy:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Hard:   "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function CodingProblemCard({problem, onSelect, onRefresh}: Props) {
  const [toggling, setToggling] = useState(false);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      if (problem.is_bookmarked) {
        await removeBookmark(problem.cf_problem_id);
        toast.success("Bookmark removed.");
      } else {
        await addBookmark(problem);
        toast.success("Bookmarked!");
      }
      onRefresh();
    } catch {
      toast.error("Failed.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div 
    onClick={onSelect}
    className="bg-slate-900/60 border border-white/6 rounded-xl p-4 flex items-center gap-4 hover:border-white/12 hover:bg-slate-900/80 transition-all cursor-pointer group">
      {/* Solved check */}
      <div className="shrink-0 w-5">
        {problem.is_solved ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400"/>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-slate-700 group-hover:border-slate-500 transtion-colors" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFF_STYLE[problem.difficulty]}`}>
            {problem.difficulty}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">
            CF {problem.rating ?? "?"} · {problem.contest_id}{problem.index}
          </span>
        </div>
        <p className="text-sm font-medium text-white truncate">{problem.name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
          <span>{problem.solved_count.toLocaleString()} solved</span>
          {problem.tags.slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-white/4 rounded text-[9px]">{t}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleBookmark}
          disabled={toggling}
          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
        >
          {problem.is_bookmarked
            ? <BookmarkCheck className="w-4 h-4 text-amber-400" />
            : <Bookmark className="w-4 h-4" />}
        </button>
        <a
          href={problem.cf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}