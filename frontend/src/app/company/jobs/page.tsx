"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCompanyAuthStore } from "@/store/companyAuthStore";
import {
  CompanyJob,
  JobApplicant,
  CreateJobPayload,
} from "@/types/companyJobs";
import {
  fetchCompanyJobs,
  createCompanyJob,
  fetchJobTracks,
  fetchJobApplicants,
  updateApplicantStatus,
  closeCompanyJob,
} from "@/lib/companyJobsApi";
import { fetchBrowseCandidateDetail } from "@/lib/CompanyApi";
import { CandidateModal } from "@/components/company/CandidateModal";
import type { CandidateDetail } from "@/store/companyStore";
import { toast } from "sonner";
import { formatTimeAgo, formatExactDateTime } from "@/lib/dateUtils";
import {
  Briefcase,
  Plus,
  FileText,
  MapPin,
  Banknote,
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  Send,
  Trash2,
  UserCheck,
  UserX,
  Calendar,
  Sparkles,
  Award,
  ChevronDown,
  Layers,
  Percent,
} from "lucide-react";

type ActiveTab = "listings" | "post" | "applicants";

export default function CompanyJobsPage() {
  const router = useRouter();
  const { user, _hasHydrated: userHydrated } = useAuthStore();
  const { company, _hasHydrated: companyHydrated } = useCompanyAuthStore();

  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>("listings");
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<CompanyJob | null>(null);
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);

  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(false);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Candidate Snapshot Modal
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateModalLoading, setCandidateModalLoading] = useState(false);

  // Form State for Post a New Vacancy
  const [formData, setFormData] = useState({
    title: "",
    role_id: "Java Backend Specialty",
    custom_role: "",
    ctc_range: "₹12,00,000 - 18,00,000 PA",
    location: "Bengaluru Office / Pune / Remote",
    min_score: 70,
    description: "",
    work_mode: "Full-Time",
    required_skills: "",
    openings_count: 1,
  });



  // Load initial jobs and engineering tracks
  const loadJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const [jobsRes, tracksRes] = await Promise.all([
        fetchCompanyJobs(),
        fetchJobTracks().catch(() => [
          "Java Backend Specialty",
          "Full Stack Developer",
          "Frontend Developer",
          "Python Backend Engineer",
          "DevOps & Cloud Engineer",
          "Data Engineer / ETL",
          "AI / Machine Learning Engineer",
          "Mobile Developer",
        ]),
      ]);
      setJobs(jobsRes.jobs || []);
      setTracks(tracksRes || []);
      if (tracksRes && tracksRes.length > 0 && !formData.role_id) {
        setFormData((prev) => ({ ...prev, role_id: tracksRes[0] }));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load corporate job listings.");
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    const isHydrated = companyHydrated || userHydrated;
    const isAuthed = !!(company || user);
    if (isHydrated && isAuthed) {
      loadJobs();
    }
  }, [companyHydrated, userHydrated, company, user]);

  // Open Applicants View for a specific job
  const handleReviewApplicants = async (job: CompanyJob) => {
    setSelectedJob(job);
    setActiveTab("applicants");
    setIsLoadingApplicants(true);
    try {
      const res = await fetchJobApplicants(job.job_id);
      setApplicants(res.applicants || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load job applicants.");
      setApplicants([]);
    } finally {
      setIsLoadingApplicants(false);
    }
  };

  // Handle Vacancy Submission
  const handlePostVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please enter a valid Employment Vacancy Title.");
      return;
    }
    if (!formData.role_id.trim()) {
      toast.error("Please specify a Target Engineering Track Specialty.");
      return;
    }

    const targetRole = formData.role_id.trim();

    const skillsArray = formData.required_skills
      ? formData.required_skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const payload: CreateJobPayload = {
      title: formData.title.trim(),
      role_id: targetRole,
      description: formData.description.trim() || undefined,
      min_score: Number(formData.min_score) || 0,
      location: formData.location.trim() || undefined,
      work_mode: formData.work_mode,
      ctc_range: formData.ctc_range.trim() || undefined,
      required_skills: skillsArray.length > 0 ? skillsArray : undefined,
      openings_count: Number(formData.openings_count) || 1,
    };

    setIsSubmittingJob(true);
    try {
      const res = await createCompanyJob(payload);
      toast.success(res.message || "Vacancy published successfully!");
      // Reset form
      setFormData({
        title: "",
        role_id: tracks[0] || "Java Backend Specialty",
        custom_role: "",
        ctc_range: "₹12,00,000 - 18,00,000 PA",
        location: "Bengaluru Office / Pune / Remote",
        min_score: 70,
        description: "",
        work_mode: "Full-Time",
        required_skills: "",
        openings_count: 1,
      });
      // Refresh list & switch to listings view
      await loadJobs();
      setActiveTab("listings");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to publish job vacancy.");
    } finally {
      setIsSubmittingJob(false);
    }
  };

  // Handle Application Status Update
  const handleUpdateStatus = async (
    applicant: JobApplicant,
    newStatus: "Applied" | "Shortlisted" | "Interviewed" | "Offered" | "Rejected"
  ) => {
    if (!selectedJob) return;
    setStatusUpdatingId(applicant.application_id);
    try {
      await updateApplicantStatus(selectedJob.job_id, applicant.application_id, newStatus);
      toast.success(`Candidate status updated to ${newStatus}`);
      // Update local state
      setApplicants((prev) =>
        prev.map((a) =>
          a.application_id === applicant.application_id ? { ...a, status: newStatus } : a
        )
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update applicant status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Open Candidate Detail / Resume Modal
  const handleReviewResume = async (applicant: JobApplicant) => {
    setCandidateModalLoading(true);
    try {
      const fullDetail = await fetchBrowseCandidateDetail(applicant.student_id);
      setSelectedCandidate({
        ...fullDetail,
        ai_skill_fit_pct: applicant.profile_match_pct,
        matched_skills: applicant.matched_skills.length > 0 ? applicant.matched_skills : fullDetail.matched_skills,
      });
      setIsCandidateModalOpen(true);
    } catch {
      // Fallback to applicant data directly
      setSelectedCandidate({
        student_id: applicant.student_id,
        name: applicant.name,
        avatar_initials: applicant.avatar_initials,
        email: applicant.email,
        phone: applicant.phone ?? null,
        college: applicant.college ?? null,
        branch: applicant.branch ?? null,
        target_role: applicant.target_role ?? null,
        skills: applicant.skills,
        ai_skill_fit_pct: applicant.profile_match_pct,
        matched_skills: applicant.matched_skills,
        missing_skills: applicant.missing_skills,
        overall_score: applicant.overall_score,
        github: applicant.github ?? null,
        linkedin: applicant.linkedin ?? null,
        tests_completed: applicant.tests_completed,
        projects_completed: applicant.projects_completed,
      });
      setIsCandidateModalOpen(true);
    } finally {
      setCandidateModalLoading(false);
    }
  };

  // Close / Delete Job
  const handleCloseJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to close this job listing?")) return;
    try {
      await closeCompanyJob(jobId);
      toast.success("Job listing closed successfully.");
      loadJobs();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to close job listing.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Shortlisted":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Interviewed":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "Offered":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Rejected":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      default:
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <Briefcase className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
              Corporate Placements & Job Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            Manage active listings, review real-time student applicants, audit submitted candidate resume snapshots and track decisions.
          </p>
        </div>

        {/* Action / View Switcher Tabs */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-900/90 border border-slate-800 p-1 rounded-2xl shadow-xl">
          <button
            onClick={() => {
              setActiveTab("listings");
              setSelectedJob(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === "listings" || activeTab === "applicants"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Active Listings & Applicants</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("post");
              setSelectedJob(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === "post"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Post a New Vacancy</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: ACTIVE LISTINGS (Image 1) */}
      {activeTab === "listings" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Openings:
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-sky-400">
                {jobs.length} Active
              </span>
            </div>
            <button
              onClick={loadJobs}
              disabled={isLoadingJobs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJobs ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {isLoadingJobs ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
              <p className="text-sm text-slate-400 font-medium">
                Fetching real-time corporate listings from database...
              </p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-slate-800/80 p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500">
                <Briefcase className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">No Vacancies Published Yet</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                  Publish your first engineering role or corporate vacancy to start receiving verified student applications in real time.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("post")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Vacancy</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {jobs.map((job) => (
                <div
                  key={job.job_id}
                  className="group relative rounded-2xl bg-[#0D1322] border border-slate-800/90 hover:border-sky-500/40 p-6 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-sky-500/5 hover:-translate-y-0.5"
                >
                  {/* Top Bar: Title & Specialty Track */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold text-white font-serif tracking-tight leading-snug group-hover:text-sky-300 transition-colors">
                        {job.title}
                      </h2>
                      <span className="shrink-0 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                        {job.role_id}
                      </span>
                    </div>

                    {/* Description or Framework Snippet */}
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {job.description || "No specific framework parameters outlined."}
                    </p>

                    {/* Details Badges */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                          Location: <strong className="text-slate-200 font-medium">{job.location || "Remote / Hybrid"}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Banknote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          Compensation:{" "}
                          <strong className="text-emerald-400 font-semibold">{job.ctc_range || "Negotiable"}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span title={job.created_at ? formatExactDateTime(job.created_at) : undefined}>
                          Posted:{" "}
                          <strong className="text-slate-200 font-medium">
                            {job.created_at ? formatTimeAgo(job.created_at) : "Recently"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer: Applications & Review Button */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Applications:</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {job.applications_count} {job.applications_count === 1 ? "candidate" : "candidates"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleCloseJob(job.job_id, e)}
                        title="Close Listing"
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReviewApplicants(job)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/25 transition-all"
                      >
                        <span>Review Applicants</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: REVIEW APPLICANTS TABLE (Image 2) */}
      {activeTab === "applicants" && selectedJob && (
        <div className="space-y-5">
          {/* Header Card for Selected Job */}
          <div className="rounded-2xl bg-[#0D1322] border border-slate-800 p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl">
            <div className="flex items-start sm:items-center gap-4">
              <button
                onClick={() => {
                  setActiveTab("listings");
                  setSelectedJob(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 border border-slate-700/80 transition-all shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Listings</span>
              </button>

              <div className="space-y-0.5">
                <h2 className="text-xl sm:text-2xl font-bold text-white font-serif tracking-tight">
                  {selectedJob.title}
                </h2>
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  SPECIALTY TRACK: <span className="text-sky-400 font-semibold">{selectedJob.role_id}</span>
                  {selectedJob.location && <span> &bull; {selectedJob.location}</span>}
                </p>
              </div>
            </div>

            <div className="self-start md:self-auto">
              <span className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs sm:text-sm font-bold text-blue-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                {applicants.length} Total Applicants
              </span>
            </div>
          </div>

          {/* Applicants Table */}
          <div className="rounded-2xl bg-[#0D1322] border border-slate-800/90 overflow-hidden shadow-2xl">
            {isLoadingApplicants ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                <p className="text-sm text-slate-400 font-medium">
                  Loading verified student applicants from real-time database...
                </p>
              </div>
            ) : applicants.length === 0 ? (
              <div className="py-24 px-6 text-center space-y-2">
                <p className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-slate-500">
                  NO STUDENT APPLICATION REQUESTS HAVE BEEN FILED FOR THIS PLACEMENT YET.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                      <th className="py-4 px-5">Candidate Name & Email</th>
                      <th className="py-4 px-5">Matched Domain Skills</th>
                      <th className="py-4 px-5">Date Applied</th>
                      <th className="py-4 px-5">Platform Score</th>
                      <th className="py-4 px-5">Status</th>
                      <th className="py-4 px-5 text-center">Review Resume</th>
                      <th className="py-4 px-5 text-center">Operational Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {applicants.map((app) => (
                      <tr
                        key={app.application_id}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Candidate Name & Email */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-600 to-sky-500 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-500/20 shrink-0">
                              {app.avatar_initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate hover:text-sky-300 cursor-pointer" onClick={() => handleReviewResume(app)}>
                                {app.name}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{app.email}</p>
                              {app.college && (
                                <p className="text-[10px] text-slate-500 truncate">{app.college}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Matched Domain Skills */}
                        <td className="py-4 px-5">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {app.matched_skills.slice(0, 3).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-300"
                              >
                                {skill}
                              </span>
                            ))}
                            {app.matched_skills.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-800/50 text-[10px] text-slate-500">
                                +{app.matched_skills.length - 3}
                              </span>
                            )}
                            {app.matched_skills.length === 0 && (
                              <span className="text-[11px] text-slate-500 italic">General track match</span>
                            )}
                          </div>
                        </td>

                        {/* Date Applied */}
                        <td className="py-4 px-5 text-slate-400 whitespace-nowrap">
                          <div
                            className="flex items-center gap-1.5 text-xs text-slate-300 cursor-help"
                            title={formatExactDateTime(app.applied_at)}
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              {formatTimeAgo(app.applied_at)}
                            </span>
                          </div>
                        </td>

                        {/* Platform Score */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${
                                app.overall_score >= 80
                                  ? "text-emerald-400"
                                  : app.overall_score >= 60
                                  ? "text-sky-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {app.overall_score}%
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase">
                              ({app.tests_completed} tests, {app.projects_completed} projs)
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block ${getStatusBadge(
                              app.status
                            )}`}
                          >
                            {app.status}
                          </span>
                        </td>

                        {/* Review Resume */}
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => handleReviewResume(app)}
                            disabled={candidateModalLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700/80 transition-all hover:border-sky-500/40 shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5 text-sky-400" />
                            <span>Review Snapshot</span>
                          </button>
                        </td>

                        {/* Operational Actions */}
                        <td className="py-4 px-5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {app.status !== "Shortlisted" && (
                              <button
                                onClick={() => handleUpdateStatus(app, "Shortlisted")}
                                disabled={statusUpdatingId === app.application_id}
                                title="Shortlist Candidate"
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 transition-all"
                              >
                                Shortlist
                              </button>
                            )}

                            {app.status !== "Interviewed" && (
                              <button
                                onClick={() => {
                                  handleReviewResume(app);
                                }}
                                title="Schedule Interview Session"
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[11px] font-semibold border border-indigo-500/20 transition-all"
                              >
                                Interview
                              </button>
                            )}

                            {app.status !== "Offered" && (
                              <button
                                onClick={() => handleUpdateStatus(app, "Offered")}
                                disabled={statusUpdatingId === app.application_id}
                                title="Extend Job Offer"
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold border border-amber-500/20 transition-all"
                              >
                                Offer
                              </button>
                            )}

                            {app.status !== "Rejected" && (
                              <button
                                onClick={() => handleUpdateStatus(app, "Rejected")}
                                disabled={statusUpdatingId === app.application_id}
                                title="Mark as Rejected"
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold border border-rose-500/20 transition-all"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: POST A NEW VACANCY FORM (Image 3) */}
      {activeTab === "post" && (
        <div className="max-w-4xl mx-auto rounded-3xl bg-[#0D1322] border border-slate-800/90 p-6 sm:p-8 lg:p-10 shadow-2xl space-y-6">
          <form onSubmit={handlePostVacancy} className="space-y-6">
            {/* Field 1: Employment Vacancy Title */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                EMPLOYMENT VACANCY TITLE
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Java Backend Engineer - Payments Team"
                className="w-full px-4 py-3.5 rounded-xl bg-[#080D1A] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Field 2 & 3: Target Engineering Track Specialty & Salary Bracket */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    TARGET ENGINEERING TRACK SPECIALTY
                  </label>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Type custom or select
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="engineering-track-options"
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    placeholder="e.g. Java Backend Specialty / AI Engineer / Mobile Lead"
                    className="w-full px-4 py-3.5 rounded-xl bg-[#080D1A] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <datalist id="engineering-track-options">
                    {tracks.map((track) => (
                      <option key={track} value={track} />
                    ))}
                  </datalist>
                </div>

                {/* Quick Selection Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tracks.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, role_id: t })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                        formData.role_id === t
                          ? "bg-blue-600 text-white font-semibold shadow-sm"
                          : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  MONTHLY/ANNUAL SALARY BRACKET
                </label>
                <input
                  type="text"
                  value={formData.ctc_range}
                  onChange={(e) => setFormData({ ...formData, ctc_range: e.target.value })}
                  placeholder="₹12,00,000 - 18,00,000 PA"
                  className="w-full px-4 py-3.5 rounded-xl bg-[#080D1A] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Field 4 & 5: Location Details & Aptitude Filter Threshold */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  JOB LOCATION DETAILS
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Bengaluru Office / Pune / Remote"
                  className="w-full px-4 py-3.5 rounded-xl bg-[#080D1A] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  APTITUDE FILTER INDEX THRESHOLD (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.min_score}
                  onChange={(e) => setFormData({ ...formData, min_score: Number(e.target.value) })}
                  placeholder="70"
                  className="w-full px-4 py-3.5 rounded-xl bg-[#080D1A] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Field 6: Roles, Frameworks & Perks Description */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                OPERATIONAL ROLES, FRAMEWORKS & PERKS DESCRIPTION
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Outline development stacks utilized (Java, Spring, React etc.), standard perks, remote/office hybrid parameters..."
                className="w-full px-4 py-3.5 rounded-xl bg-[#080D1A] border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              />
            </div>

            {/* Additional Optional Specifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  REQUIRED SKILLS (COMMA SEPARATED)
                </label>
                <input
                  type="text"
                  value={formData.required_skills}
                  onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                  placeholder="e.g. Java, Spring Boot, MySQL, Docker"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080D1A] border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  WORK MODE / OPENINGS
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.work_mode}
                    onChange={(e) => setFormData({ ...formData, work_mode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#080D1A] border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Internship">Internship</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={formData.openings_count}
                    onChange={(e) => setFormData({ ...formData, openings_count: Number(e.target.value) })}
                    placeholder="Openings (1)"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#080D1A] border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Submit Button matching Image 3 */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmittingJob}
                className="w-full py-4 px-6 rounded-xl bg-linear-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white text-sm sm:text-base font-bold uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmittingJob ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>DISPATCHING VACANCY NOTIFICATIONS...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>PUBLISH LISTING & DISPATCH CANDIDATE NOTIFICATIONS</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Candidate Resume / Profile Modal Popup */}
      {isCandidateModalOpen && selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => {
            setIsCandidateModalOpen(false);
            setSelectedCandidate(null);
          }}
        />
      )}
    </div>
  );
}
