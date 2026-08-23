"use client";

import CommunityFeedCard from "@/components/projects/CommunityFeedCard";
import CreateStudentProjectModal from "@/components/projects/CreateStudentProjectModal";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import StudentProjectCard from "@/components/projects/StudentProjectCard";
import SubmitProjectModal from "@/components/projects/SubmitProjectModal";
import {
  CommunitySubmission,
  getCommunityFeed,
  getMyProjects,
  getStudentProjectFeed,
  ProjectCard as ProjectCardType,
  StudentProject,
} from "@/lib/projectsApi";
import { AnimatePresence } from "framer-motion";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FolderOpen,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "company-briefs" | "my-projects" | "community";
type BriefFilter = "all" | "accepted" | "completed";

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("company-briefs");
  const [briefFilter, setBriefFilter] = useState<BriefFilter>("all");

  const [companyProjects, setCompanyProjects] = useState<ProjectCardType[]>([]);
  const [studentProjects, setStudentProjects] = useState<StudentProject[]>([]);
  const [community, setCommunity] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailProject, setDetailProject] = useState<ProjectCardType | null>(
    null
  );
  const [submitProjectTarget, setSubmitProjectTarget] =
    useState<ProjectCardType | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadCompanyProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProjects();
      setCompanyProjects(data);
    } catch {
      toast.error("Failed to load company project briefs.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudentProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStudentProjectFeed();
      setStudentProjects(data);
    } catch {
      toast.error("Failed to load student projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCommunity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommunityFeed();
      setCommunity(data);
    } catch {
      toast.error("Failed to load community feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (activeTab === "company-briefs") loadCompanyProjects();
    else if (activeTab === "my-projects") loadStudentProjects();
    else loadCommunity();
  }, [activeTab, loadCompanyProjects, loadStudentProjects, loadCommunity]);

  useEffect(() => {
    refresh();
  }, [activeTab, refresh]);

  // Compute metrics for company briefs
  const acceptedProjects = companyProjects.filter(
    (p) => p.is_accepted || p.status !== "available"
  );
  const completedProjects = companyProjects.filter(
    (p) => p.status === "submitted" || p.status === "evaluated"
  );

  const filteredCompanyProjects = companyProjects.filter((p) => {
    if (briefFilter === "accepted")
      return p.is_accepted && p.status === "available";
    if (briefFilter === "completed")
      return p.status === "submitted" || p.status === "evaluated";
    return true;
  });

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    {
      key: "company-briefs",
      label: "Company Briefs",
      icon: Briefcase,
      count: companyProjects.length,
    },
    {
      key: "my-projects",
      label: "Peer Projects",
      icon: Users,
      count: studentProjects.length,
    },
    {
      key: "community",
      label: "Community Feed",
      icon: Globe,
      count: community.length,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-teal-500/20 border border-indigo-500/20 shadow-lg shadow-indigo-950/40">
            <FolderOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Project Hub
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Work on real company briefs, build portfolio projects &amp; get
              evaluated
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Project — only shown on Student Projects tab */}
          {activeTab === "my-projects" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold hover:from-indigo-500/30 hover:to-sky-500/30 transition-all shadow-lg shadow-indigo-950/30"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/6 text-xs text-slate-300 hover:bg-slate-700/60 transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Overview Stat Cards (Shown for Company Briefs) */}
      {activeTab === "company-briefs" && !loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/6 flex items-center gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">
                {companyProjects.length}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Total Briefs
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3.5 shadow-lg shadow-emerald-950/20">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-400">
                {acceptedProjects.length}
              </p>
              <p className="text-[11px] text-emerald-400/80 font-medium">
                Accepted / In Progress
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20 flex items-center gap-3.5 shadow-lg shadow-violet-950/20">
            <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-violet-400">
                {completedProjects.length}
              </p>
              <p className="text-[11px] text-violet-400/80 font-medium">
                Submitted &amp; Scored
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/6 pb-3">
        <div className="flex gap-2 p-1 bg-white/3 rounded-2xl border border-white/6 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-950/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/4"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-white/6 text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-filters for Company Briefs */}
        {activeTab === "company-briefs" && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-white/6 rounded-xl text-xs font-semibold">
            {[
              { key: "all", label: "All Briefs", count: companyProjects.length },
              {
                key: "accepted",
                label: "In Progress",
                count: acceptedProjects.filter((p) => p.status === "available")
                  .length,
              },
              {
                key: "completed",
                label: "Completed",
                count: completedProjects.length,
              },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setBriefFilter(f.key as BriefFilter)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  briefFilter === f.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                {f.label}{" "}
                <span className="text-[10px] opacity-70">({f.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh] gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
          <span className="text-sm text-slate-400">Loading projects...</span>
        </div>
      ) : activeTab === "company-briefs" ? (
        filteredCompanyProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
            <div className="p-5 rounded-2xl bg-white/3 border border-white/5">
              <Briefcase className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-300 font-semibold text-sm">
              {briefFilter === "accepted"
                ? "No active accepted projects yet"
                : briefFilter === "completed"
                ? "No completed submissions yet"
                : "No company briefs found"}
            </p>
            <p className="text-slate-500 text-xs max-w-sm">
              {briefFilter === "accepted"
                ? "Browse available briefs and click 'Accept Project' to start working."
                : "When companies post real projects for your role, they will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCompanyProjects.map((proj) => (
              <ProjectCard
                key={proj.project_id}
                project={proj}
                onViewDetails={() => setDetailProject(proj)}
                onSubmit={() => setSubmitProjectTarget(proj)}
                onAccepted={loadCompanyProjects}
              />
            ))}
          </div>
        )
      ) : activeTab === "my-projects" ? (
        studentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/15">
              <FolderOpen className="w-10 h-10 text-indigo-400/50" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium">
                No student projects yet
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Be the first to create a project and recruit teammates!
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {studentProjects.map((proj) => (
              <StudentProjectCard
                key={proj.project_id}
                project={proj}
                onRefresh={loadStudentProjects}
              />
            ))}
          </div>
        )
      ) : community.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          No public peer submissions yet. Be the first to share!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {community.map((sub) => (
            <CommunityFeedCard key={sub.submission_id} submission={sub} />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {detailProject && (
          <ProjectDetailModal
            project={detailProject}
            onClose={() => setDetailProject(null)}
            onSubmit={() => setSubmitProjectTarget(detailProject)}
            onAccepted={loadCompanyProjects}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitProjectTarget && (
          <SubmitProjectModal
            project={submitProjectTarget}
            onClose={() => setSubmitProjectTarget(null)}
            onSubmitted={loadCompanyProjects}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <CreateStudentProjectModal
            onClose={() => setShowCreateModal(false)}
            onCreated={loadStudentProjects}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
