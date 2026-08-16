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
import { FolderOpen, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "company-briefs" | "my-projects" | "community";

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("company-briefs");
  const [companyProjects, setCompanyProjects] = useState<ProjectCardType[]>([]);
  const [studentProjects, setStudentProjects] = useState<StudentProject[]>([]);
  const [community, setCommunity] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailProject, setDetailProject] = useState<ProjectCardType | null>(null);
  const [submitProjectTarget, setSubmitProjectTarget] = useState<ProjectCardType | null>(null);
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
  }, [activeTab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "company-briefs", label: "Company Briefs" },
    { key: "my-projects", label: "Student Projects" },
    { key: "community", label: "Community Feed" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-linear-to-br from-indigo-500/20 border border-indigo-500/10">
            <FolderOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Company briefs, team collaboration & community showcase
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Project — only shown on Student Projects tab */}
          {activeTab === "my-projects" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/6 text-xs text-slate-300 hover:bg-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 bg-white/3 rounded-xl border border-white/6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? tab.key === "company-briefs"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  : tab.key === "my-projects"
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
          <span className="ml-3 text-sm text-slate-400">Loading...</span>
        </div>
      ) : activeTab === "company-briefs" ? (
        companyProjects.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            No company project briefs matched to your role right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {companyProjects.map((proj) => (
              <ProjectCard
                key={proj.project_id}
                project={proj}
                onViewDetails={() => setDetailProject(proj)}
                onSubmit={() => setSubmitProjectTarget(proj)}
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
              <p className="text-slate-300 font-medium">No student projects yet</p>
              <p className="text-slate-500 text-sm mt-1">Be the first to create a project and recruit teammates!</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Your First Project
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {studentProjects.map((proj) => (
                <StudentProjectCard
                  key={proj.project_id}
                  project={proj}
                  onRefresh={loadStudentProjects}
                />
              ))}
            </div>
          </>
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
