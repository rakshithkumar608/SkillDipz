"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Code2,
  Edit3,
  ExternalLink,
  Eye,
  GraduationCap,
  Phone,
  RefreshCw,
  Shield,
  Trophy,
  Upload,
  UserCircle,
  Zap,
} from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { toast } from "sonner";
import { fetchProfile, ProfileData } from "@/lib/profile";
import { useAuthStore } from "@/store/authStore";

import { Badge, Card, SectionHeader, Skeleton } from "@/components/profile/ProfileUI";
import { useProfileSocket } from "@/components/profile/useProfileSocket";
import { PhotoUpload } from "@/components/profile/PhotoUpload";
import { CompletenessPanel } from "@/components/profile/CompletenessPanel";
import { ScoreBreakdownPanel } from "@/components/profile/ScoreBreakdownPanel";
import { ResumeUploader } from "@/components/profile/ResumeUploader";
import { CertificateCard } from "@/components/profile/CertificateCard";
import { CourseRow } from "@/components/profile/CourseRow";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

export default function ProfilePage() {
  const { user, accessToken } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch {
      toast.error("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleWsEvent = useCallback((event: {
    type: string;
    payload: Record<string, unknown>;
  }) => {
    switch (event.type) {
      case "profile_updated": {
        const { completeness_pct, avatar_url } = event.payload as {
          completeness_pct: number;
          avatar_url?: string;
        };
        setProfile((p) =>
          p
            ? {
                ...p,
                completeness_pct,
                completeness_score: Math.round(completeness_pct / 10),
                ...(avatar_url ? { avatar_url } : {}),
              }
            : p
        );
        break;
      }
      case "resume_analyzed": {
        const { skills_extracted, completeness_pct, parse_summary } =
          event.payload as {
            skills_extracted: string[];
            completeness_pct: number;
            parse_summary: string;
          };
        setProfile((p) =>
          p
            ? {
                ...p,
                skills: Array.from(new Set([...p.skills, ...skills_extracted])),
                completeness_pct,
                completeness_score: Math.round(completeness_pct / 10),
                resume_parse_summary: parse_summary,
                resume_uploaded: true,
              }
            : p
        );
        break;
      }
      case "score_update": {
        loadProfile();
        break;
      }
    }
  }, []);

  useProfileSocket(user?.id, accessToken, handleWsEvent);

  const initials =
    user?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "S";

  const VIS_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    public:         { label: "Public",         icon: Eye,    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
    companies_only: { label: "Companies Only", icon: Shield, cls: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
    private:        { label: "Private",        icon: Shield, cls: "bg-slate-600/15 text-slate-400 border-slate-600/25" },
  };
  const visMeta = VIS_META[profile?.visibility_setting ?? "public"] ?? VIS_META.public;
  const VisIcon = visMeta.icon;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto space-y-6 text-slate-200">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800/60">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                My Profile
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">
                Manage your resume, skills, visibility, and achievements.
              </p>
            </div>
          </div>
          <button
            onClick={loadProfile}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 border border-slate-700/60 rounded-xl hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Row 1: Profile Info + Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-20 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>
          ) : profile ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <PhotoUpload
                  avatarUrl={profile.avatar_url}
                  initials={initials}
                  onUploaded={(url, pct) =>
                    setProfile((p) =>
                      p ? { ...p, avatar_url: url, completeness_pct: pct, completeness_score: Math.round(pct / 10) } : p
                    )
                  }
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-white truncate">{profile.name}</h2>
                      <p className="text-sm text-slate-400 mt-0.5">{profile.email}</p>
                    </div>
                    <button
                      onClick={() => setShowEdit(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-400 border border-sky-500/30 rounded-xl hover:bg-sky-500/10 transition-all flex-shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    {profile.target_role && <Badge color="sky">{profile.target_role}</Badge>}
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${visMeta.cls}`}>
                      <VisIcon className="w-3 h-3" />
                      {visMeta.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {profile.college && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <GraduationCap className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span className="truncate">
                      {profile.college}{profile.branch ? ` · ${profile.branch}` : ""}
                    </span>
                  </div>
                )}
                {profile.grad_year && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Trophy className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span>Class of {profile.grad_year}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.target_company && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Trophy className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span>Target: {profile.target_company}</span>
                  </div>
                )}
              </div>

              {/* Social links */}
              <div className="flex flex-wrap gap-2">
                {profile.github ? (
                  <a href={profile.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800/80 border border-slate-700/60 text-slate-300 rounded-xl hover:text-white hover:border-slate-600 transition-all">
                    <FaGithub className="h-5 w-5" />
                    GitHub
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                ) : (
                  <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-dashed border-slate-700/40 text-slate-600 rounded-xl hover:text-slate-400 hover:border-slate-600 transition-all">
                    <FaGithub className="h-5 w-5" />
                    Add GitHub (+2 pts)
                  </button>
                )}

                {profile.linkedin ? (
                  <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600/15 border border-blue-500/25 text-blue-300 rounded-xl hover:bg-blue-600/25 transition-all">
                    <FaLinkedin className="h-5 w-5" />
                    LinkedIn
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                ) : (
                  <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-dashed border-blue-500/20 text-blue-600/70 rounded-xl hover:text-blue-400 hover:border-blue-500/40 transition-all">
                    <FaLinkedin className="h-5 w-5" />
                    Add LinkedIn (+2 pts)
                  </button>
                )}

                {profile.cf_handle ? (
                  <a href={`https://codeforces.com/profile/${profile.cf_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-500/10 border border-orange-500/25 text-orange-300 rounded-xl hover:bg-orange-500/20 transition-all">
                    <Code2 className="w-3.5 h-3.5" />
                    CF: {profile.cf_handle}
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                ) : (
                  <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-dashed border-orange-500/20 text-orange-600/70 rounded-xl hover:text-orange-400 hover:border-orange-500/40 transition-all">
                    <Code2 className="w-3.5 h-3.5" />
                    Link Codeforces
                  </button>
                )}
              </div>

              {profile.skills.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Skills ({profile.skills.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((sk) => (
                      <Badge key={sk} color="sky">{sk}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Card>

        <Card className="lg:col-span-5 p-5">
          <SectionHeader icon={CheckCircle2} title="Profile Completeness" accent="emerald" />
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="w-20 h-20 rounded-full" />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : profile ? (
            <CompletenessPanel profile={profile} />
          ) : null}
        </Card>
      </div>

      {/* Row 2: Resume + Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-5">
          <SectionHeader icon={Upload} title="Resume" accent="sky" />
          {loading ? (
            <Skeleton className="h-36 w-full rounded-2xl" />
          ) : profile ? (
            <ResumeUploader
              profile={profile}
              onUploaded={(result) => {
                setProfile((p) =>
                  p
                    ? {
                        ...p,
                        resume_uploaded: true,
                        resume_url: "/students/me/resume/download",
                        resume_parse_summary: result.parse_summary,
                        skills: Array.from(new Set([...p.skills, ...result.skills_extracted])),
                        completeness_pct: result.completeness_pct,
                        completeness_score: Math.round(result.completeness_pct / 10),
                      }
                    : p
                );
              }}
            />
          ) : null}
        </Card>

        <Card className="lg:col-span-5 p-5">
          <SectionHeader icon={Zap} title="Score Breakdown" accent="violet" />
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : profile ? (
            <ScoreBreakdownPanel breakdown={profile.score_breakdown} />
          ) : null}
        </Card>
      </div>

      {/* Row 3: Certificates + Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeader icon={Award} title="Certificates" accent="amber" />
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : profile?.certificates.length ? (
            <div className="space-y-2.5">
              {profile.certificates.map((c) => (
                <CertificateCard key={c.cert_id} cert={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-400/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400">No certificates yet</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Complete skill tests and assessments to earn certificates
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader icon={BookOpen} title="Enrolled Courses" accent="indigo" />
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : profile?.enrolled_courses.length ? (
            <div className="space-y-2.5">
              {profile.enrolled_courses.map((c) => (
                <CourseRow key={c.course_id} course={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-indigo-400/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400">No courses enrolled yet</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Enroll from your Learning Roadmap
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showEdit && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => {
            setProfile(updated);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}