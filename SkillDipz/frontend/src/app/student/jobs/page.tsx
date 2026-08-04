"use client";

import { useState } from "react";
import { useJobs } from "@/hooks/useJobs";
import { useJobsStore } from "@/store/jobsStore";
import JobFilterBar from "@/components/jobs/JobFilterBar";
import JobCard from "@/components/jobs/JobCard";
import JobDetailModal from "@/components/jobs/JobDetailModal";
import {
  Briefcase,
  Loader2,
  RefreshCw,
  SearchX,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function JobsPage() {
  const { data, isLoading, error, apply, refresh } = useJobs();
  const { filters, setFilter } = useJobsStore();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  const handleViewDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsDetailOpen(true);
  };

  const handleApply = async (jobId: string) => {
    setApplyingJobId(jobId);
    try {
      const result = await apply(jobId);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to apply");
    } finally {
      setApplyingJobId(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <span className="ml-3 text-slate-400">
          Finding jobs matched to your profile...
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 rounded-lg text-white hover:bg-sky-700"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const {
    jobs = [],
    total = 0,
    student_score = 0,
    student_role = "",
  } = data || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/10">
              <Briefcase className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Jobs Hub</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Open positions from verified companies, matched to your profile
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Score badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span className="text-sm text-slate-400">Score:</span>
            <span className="text-sm font-semibold text-sky-400">
              {student_score}
            </span>
          </div>
          {student_role && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-slate-400">Role:</span>
              <span className="text-sm font-semibold text-indigo-400 capitalize">
                {student_role}
              </span>
            </div>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/[0.06] text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <JobFilterBar studentRole={student_role} />

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {total > 0 ? (
            <>
              Showing{" "}
              <span className="text-slate-300 font-medium">
                {(filters.page - 1) * filters.page_size + 1}–
                {Math.min(filters.page * filters.page_size, total)}
              </span>{" "}
              of <span className="text-slate-300 font-medium">{total}</span>{" "}
              jobs
            </>
          ) : (
            "No jobs found"
          )}
        </p>
        {isLoading && data && (
          <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
        )}
      </div>

      {/* Job Cards Grid */}
      {jobs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <SearchX className="w-12 h-12 text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-slate-400">
              No matching jobs found
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Try adjusting your filters or check back later for new postings
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job, index) => (
            <motion.div
              key={job.job_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <JobCard
                job={job}
                onViewDetails={() => handleViewDetails(job.job_id)}
                onApply={() => handleApply(job.job_id)}
                isApplying={applyingJobId === job.job_id}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setFilter("page", filters.page - 1)}
            disabled={filters.page <= 1}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800/60 border border-white/[0.06] text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (filters.page <= 3) {
                pageNum = i + 1;
              } else if (filters.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = filters.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setFilter("page", pageNum)}
                  className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                    filters.page === pageNum
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "bg-slate-800/40 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setFilter("page", filters.page + 1)}
            disabled={filters.page >= totalPages}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800/60 border border-white/[0.06] text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <JobDetailModal
        isOpen={isDetailOpen}
        jobId={selectedJobId}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedJobId(null);
        }}
        onApplied={refresh}
      />
    </div>
  );
}