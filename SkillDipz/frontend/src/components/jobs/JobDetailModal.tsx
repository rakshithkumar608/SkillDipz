"use client";

import { useEffect, useState } from "react";
import { getJobDetail, applyToJob } from "@/lib/jobsApi";
import type { JobDetail } from "@/types/jobs";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  MapPin,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CalendarDays,
  Users,
  ArrowRight,
  Loader2,
  Sparkles,
  Building2,
  Globe,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  jobId: string | null;
  onClose: () => void;
  onApplied: () => void;
}

function getMatchColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-sky-400";
  if (pct >= 40) return "text-amber-400";
  return "text-red-400";
}

export default function JobDetailModal({
  isOpen,
  jobId,
  onClose,
  onApplied,
}: Props) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!isOpen || !jobId) {
      setJob(null);
      return;
    }
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const data = await getJobDetail(jobId);
        setJob(data);
      } catch {
        toast.error("Failed to load job details");
        onClose();
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [isOpen, jobId, onClose]);

  const handleApply = async () => {
    if (!jobId) return;
    setIsApplying(true);
    try {
      const result = await applyToJob(jobId);
      toast.success(result.message);
      onApplied();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-full sm:max-h-[85vh] bg-slate-900/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoading || !job ? (
              <div className="flex items-center justify-center flex-1 py-20">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                <span className="ml-3 text-slate-400">Loading job details...</span>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-6">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700/80 to-slate-800/80 border border-white/[0.08] flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                    {job.company_logo_emoji || "🏢"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-white">{job.title}</h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {job.company_name}
                      {job.company_industry && (
                        <span className="text-slate-600"> · {job.company_industry}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className={`text-3xl font-bold ${getMatchColor(job.profile_match_pct)}`}>
                      {Math.round(job.profile_match_pct)}%
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">match</span>
                  </div>
                </div>

                {/* Meta Pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 text-sm text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {job.location}
                    </span>
                  )}
                  {job.work_mode && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 text-sm text-sky-400">
                      {job.work_mode}
                    </span>
                  )}
                  {job.ctc_range && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-sm text-emerald-400">
                      💰 {job.ctc_range}
                    </span>
                  )}
                  {job.experience && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 text-sm text-slate-300">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      {job.experience}
                    </span>
                  )}
                  {job.openings_count > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 text-sm text-slate-300">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {job.openings_count} opening{job.openings_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  {job.deadline && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-sm text-amber-400">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Deadline: {new Date(job.deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Score Eligibility */}
                {job.min_score > 0 && (
                  <div
                    className={`rounded-xl p-4 mb-6 border ${
                      job.eligible
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-red-500/5 border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${job.eligible ? "text-emerald-400" : "text-red-400"}`} />
                      <span className={`text-sm font-medium ${job.eligible ? "text-emerald-400" : "text-red-400"}`}>
                        {job.eligible
                          ? "You meet the minimum score requirement"
                          : `You need ${job.score_gap} more points to be eligible`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Minimum score: {job.min_score}
                    </p>
                  </div>
                )}

                {/* Description */}
                {job.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Job Description</h3>
                    <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                      {job.description}
                    </p>
                  </div>
                )}

                {/* Required Skills */}
                {job.required_skills.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.required_skills.map((skill) => {
                        const isMatched = job.matched_skills
                          .map((s) => s.toLowerCase())
                          .includes(skill.toLowerCase());
                        return (
                          <span
                            key={skill}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                              isMatched
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                          >
                            {isMatched ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Nice to Have */}
                {job.nice_to_have.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Nice to Have</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.nice_to_have.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        >
                          <Sparkles className="w-3 h-3" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Company Info */}
                {(job.company_description || job.company_headquarters || job.company_website) && (
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 mb-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      About {job.company_name}
                    </h3>
                    {job.company_description && (
                      <p className="text-sm text-slate-400 leading-relaxed mb-3">
                        {job.company_description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {job.company_headquarters && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.company_headquarters}
                        </span>
                      )}
                      {job.company_website && (
                        <a
                          href={job.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                        >
                          <Globe className="w-3 h-3" /> Website
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Actions */}
            {job && !isLoading && (
              <div className="px-6 py-4 border-t border-white/[0.06] bg-slate-900/80">
                {job.already_applied ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Already Applied
                  </button>
                ) : job.eligible ? (
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isApplying ? (
                      <>
                        <Clock className="w-5 h-5 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        Apply Now
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center">
                    <button
                      disabled
                      className="w-full py-3 rounded-xl text-sm font-medium text-amber-400/80 bg-amber-500/10 border border-amber-500/15 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Sparkles className="w-5 h-5" />
                      Improve score by {job.score_gap} pts to apply
                    </button>
                    <a
                      href="/student/roadmap"
                      className="inline-block mt-2 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      View your learning roadmap →
                    </a>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
