"use client";

import { CFProblem, verifyCFSubmission } from "@/lib/practiceApi";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";


interface Props {
  problem: CFProblem;
  prefillHandle?: string; 
  onClose: () => void;
  onVerified: () => void;
}

type State = "form" | "verified" | "failed";

export default function VerifySubmissionModal({problem, prefillHandle = "", onClose, onVerified}: Props) {
  const [cfHandle, setCfHandle] = useState(prefillHandle);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<State>("form");
  const [message, setMessage] = useState("");

  const handleVerify = async () => {
    if (!cfHandle.trim()) { toast.error("Enter your CF handle."); return; }
    setLoading(true);
    try {
      const res = await verifyCFSubmission({
        cf_handle: cfHandle.trim(),
        cf_problem_id: problem.cf_problem_id,
        contest_id: problem.contest_id,
        index: problem.index,
      });
      setMessage(res.message);
      if (res.verified) {
        setState("verified");
        onVerified();
        toast.success(res.message);
      } else {
        setState("failed");
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Verification failed.";
      setMessage(detail);
      setState("failed");
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Verify Submission</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[18rem]">{problem.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="p-4 bg-slate-800/60 rounded-xl border border-white/6 space-y-2 text-xs text-slate-400">
        <p className="font-medium text-slate-300">How it works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <a href={problem.cf_url} target="_blank" rel="noopener noreferrer"
                className="text-sky-400 hover:underline inline-flex items-center gap-1">
                Open problem on Codeforces <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Submit your solution and get "Accepted"</li>
            <li>Enter your CF handle below and click Verify</li>
          </ol>
        </div>

        {state === "form" && (
          <>
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Codeforces Handle</label>
              <input
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="e.g. tourist, your_handle"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white">
                Cancel
              </button>
              <button onClick={handleVerify} disabled={loading || !cfHandle.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold hover:bg-sky-500/30 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Verify
              </button>
          </div>
          </>
        )}

        {state === "verified" && (
          <div className="text-center space-y-3 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-semibold">Submission Verified!</p>
            <p className="text-slate-400 text-sm">{message}</p>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
              Done
            </button>
          </div>
        )}

        {state === "failed" && (
          <div className="space-y-3">
            <p className="text-amber-400 text-sm text-center">{message}</p>
            <button onClick={() => setState("form")}
              className="w-full py-2.5 rounded-xl border border-white/8 text-slate-400 text-sm hover:text-white">
              Try Again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}