

"use client";

import { useEffect, useState } from "react";
import { getComments, addComment, Comment } from "@/lib/projectsApi";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface CommentSectionProps {
  submissionId: string;
}

export default function CommentSection({ submissionId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    try {
      const data = await getComments(submissionId);
      setComments(data);
    } catch {
      toast.error("Could not load comments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [submissionId]);

  const handlePost = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await addComment(submissionId, text.trim());
      setText("");
      await fetchAll();
      toast.success("Suggestion submitted!");
    } catch {
      toast.error("Failed to submit suggestion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-3 border-t border-white/6 space-y-3">
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-sky-500 mx-auto" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-1">No suggestions yet. Share your feedback!</p>
      ) : (
        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.comment_id} className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[9px] font-bold">
                {c.author_name[0]}
              </div>
              <div className="flex-1 text-xs">
                <span className="font-semibold text-slate-300">{c.author_name}</span>{" "}
                <span className="text-[10px] text-slate-600">· {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                <p className="text-slate-400 mt-0.5">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
          placeholder="Write suggestion / code feedback..."
          className="flex-1 px-3 py-1.5 bg-white/5 border border-white/8 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
        />
        <button
          onClick={handlePost}
          disabled={submitting || !text.trim()}
          className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-400 hover:bg-sky-500/25 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
