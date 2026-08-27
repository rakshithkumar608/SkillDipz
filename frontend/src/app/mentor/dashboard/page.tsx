"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";
import {
  fetchMyMentorProfile,
  saveMentorProfile,
  createAvailabilitySlot,
  updateAvailabilitySlot,
  toggleAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchMentorBookings,
  submitMentorFeedback,
  MentorProfile,
  MentorSlot,
  MentorshipBooking,
  DetailedRubric,
} from "@/lib/interviewApi";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Video,
  Award,
  Plus,
  Trash2,
  Edit3,
  Power,
  Loader2,
  LogOut,
  Building2,
  Sparkles,
  BookOpen,
  GraduationCap,
  Languages,
  Shield,
  Briefcase,
  Star,
  Users,
  Eye,
  ArrowRight,
  TrendingUp,
  Layers,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function MentorDashboardPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [slots, setSlots] = useState<MentorSlot[]>([]);
  const [bookings, setBookings] = useState<MentorshipBooking[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"profile" | "availability" | "sessions">("profile");
  const [sessionSubFilter, setSessionSubFilter] = useState<"all" | "upcoming" | "pending" | "completed" | "students">("upcoming");

  // Profile Form State (Starts completely blank — mentor adds all data themselves)
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    profile_photo: "",
    headline: "",
    current_role: "",
    company: "",
    experience_years: 0,
    education: "",
    languages: "",
    expertise: "",
    skills: "",
    mentoring_topics: "",
    bio: "",
    profile_status: "INCOMPLETE" as "INCOMPLETE" | "ACTIVE" | "INACTIVE",
  });

  // Slot creation state
  const [slotDate, setSlotDate] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotDuration, setSlotDuration] = useState<number>(45);
  const [creatingSlot, setCreatingSlot] = useState(false);

  // Slot editing state
  const [editingSlot, setEditingSlot] = useState<MentorSlot | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editDuration, setEditDuration] = useState<number>(45);
  const [savingEditSlot, setSavingEditSlot] = useState(false);

  // Feedback Modal State
  const [selectedBooking, setSelectedBooking] = useState<MentorshipBooking | null>(null);
  const [feedbackScore, setFeedbackScore] = useState<number>(0);
  const [feedbackNotes, setFeedbackNotes] = useState<string>("");
  const [rubricScores, setRubricScores] = useState({
    dsa: 0,
    sys_arch: 0,
    behavioral: 0,
    code_quality: 0,
    communication: 0,
  });
  const [strengthsInput, setStrengthsInput] = useState<string>("");
  const [improvementInput, setImprovementInput] = useState<string>("");
  const [recommendationsInput, setRecommendationsInput] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Calculate Profile Completion Percentage
  const completionStats = useMemo(() => {
    let score = 0;
    const checks = [
      { label: "Full Name", done: Boolean(profileForm.full_name.trim()) },
      { label: "Current Role", done: Boolean(profileForm.current_role.trim()) },
      { label: "Company", done: Boolean(profileForm.company.trim()) },
      { label: "Years of Exp", done: profileForm.experience_years > 0 },
      { label: "Expertise Areas", done: Boolean(profileForm.expertise.trim()) },
      { label: "About Bio", done: profileForm.bio.trim().length >= 20 },
      { label: "Available Slots", done: slots.length > 0 },
    ];
    checks.forEach((c) => {
      if (c.done) score += Math.round(100 / checks.length);
    });
    return { percent: Math.min(100, score), checks };
  }, [profileForm, slots]);

  // Load Real Database Profile, Slots & Bookings
  const loadMentorData = async () => {
    try {
      setLoading(true);
      const [profRes, bookRes] = await Promise.all([
        fetchMyMentorProfile(),
        fetchMentorBookings(),
      ]);

      setProfile(profRes.profile);
      setSlots(profRes.slots || []);
      setBookings(bookRes.bookings || []);

      if (profRes.profile) {
        setProfileForm({
          full_name: profRes.profile.full_name || user?.full_name || "",
          profile_photo: profRes.profile.profile_photo || "",
          headline: profRes.profile.headline || "",
          current_role: profRes.profile.current_role || "",
          company: profRes.profile.company || "",
          experience_years: profRes.profile.experience_years ?? 0,
          education: profRes.profile.education || "",
          languages: (profRes.profile.languages || []).join(", "),
          expertise: (profRes.profile.expertise || []).join(", "),
          skills: (profRes.profile.skills || []).join(", "),
          mentoring_topics: (profRes.profile.mentoring_topics || []).join(", "),
          bio: profRes.profile.bio || "",
          profile_status: profRes.profile.profile_status || "INCOMPLETE",
        });

        if (profRes.profile.profile_status === "ACTIVE" && (profRes.slots || []).length > 0) {
          setActiveTab("availability");
        }
      }
    } catch (err) {
      console.error("Failed to load mentor data:", err);
      toast.error("Failed to load profile data from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorData();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully.");
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      window.location.href = "/mentor/login";
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await saveMentorProfile({
        full_name: profileForm.full_name.trim(),
        profile_photo: profileForm.profile_photo.trim() || undefined,
        headline: profileForm.headline.trim(),
        current_role: profileForm.current_role.trim(),
        company: profileForm.company.trim(),
        experience_years: Number(profileForm.experience_years),
        education: profileForm.education.trim(),
        languages: profileForm.languages.split(",").map((s) => s.trim()).filter(Boolean),
        expertise: profileForm.expertise.split(",").map((s) => s.trim()).filter(Boolean),
        skills: profileForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
        mentoring_topics: profileForm.mentoring_topics.split(",").map((s) => s.trim()).filter(Boolean),
        bio: profileForm.bio.trim(),
        profile_status: profileForm.profile_status,
      });

      setProfile(res.profile);
      toast.success("Profile saved to database successfully!");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to save profile";
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotDate || !slotStartTime) {
      toast.error("Please specify both date and start time.");
      return;
    }

    try {
      setCreatingSlot(true);
      const isoString = new Date(`${slotDate}T${slotStartTime}:00Z`).toISOString();
      const res = await createAvailabilitySlot({
        available_day: slotDate,
        start_time: isoString,
        duration_mins: slotDuration,
        is_enabled: true,
      });

      setSlots((prev) => [...prev, res.slot]);
      setSlotDate("");
      setSlotStartTime("");
      toast.success("Availability slot added to database!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create slot");
    } finally {
      setCreatingSlot(false);
    }
  };

  const handleOpenEditSlot = (slot: MentorSlot) => {
    setEditingSlot(slot);
    const d = new Date(slot.start_time);
    setEditDate(slot.available_day || d.toISOString().split("T")[0]);
    setEditStartTime(d.toISOString().split("T")[1].substring(0, 5));
    setEditDuration(slot.duration_mins || 45);
  };

  const handleSaveEditSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editDate || !editStartTime) return;

    try {
      setSavingEditSlot(true);
      const isoString = new Date(`${editDate}T${editStartTime}:00Z`).toISOString();
      const res = await updateAvailabilitySlot(editingSlot.slot_id, {
        available_day: editDate,
        start_time: isoString,
        duration_mins: editDuration,
      });

      setSlots((prev) =>
        prev.map((s) => (s.slot_id === editingSlot.slot_id ? res.slot : s))
      );
      setEditingSlot(null);
      toast.success("Slot updated successfully!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update slot");
    } finally {
      setSavingEditSlot(false);
    }
  };

  const handleToggleSlot = async (slotId: string) => {
    try {
      const res = await toggleAvailabilitySlot(slotId);
      setSlots((prev) =>
        prev.map((s) => (s.slot_id === slotId ? { ...s, is_enabled: res.is_enabled } : s))
      );
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to toggle slot");
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this availability slot?")) return;
    try {
      await deleteAvailabilitySlot(slotId);
      setSlots((prev) => prev.filter((s) => s.slot_id !== slotId));
      toast.success("Slot deleted from database.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete slot");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedBooking) return;
    try {
      setSubmittingFeedback(true);
      const detailedRubric: DetailedRubric = {
        dsa_problem_solving: rubricScores.dsa,
        system_architecture: rubricScores.sys_arch,
        behavioral_culture_fit: rubricScores.behavioral,
        code_quality: rubricScores.code_quality,
        communication_clarity: rubricScores.communication,
        key_strengths: strengthsInput.split(",").map((s) => s.trim()).filter(Boolean),
        improvement_areas: improvementInput.split(",").map((s) => s.trim()).filter(Boolean),
        actionable_recommendations: recommendationsInput.split(",").map((s) => s.trim()).filter(Boolean),
      };

      await submitMentorFeedback(selectedBooking.booking_id, {
        overall_score: feedbackScore,
        mentor_feedback: feedbackNotes,
        rubric: detailedRubric,
      });

      toast.success("Evaluation submitted! Student level and XP updated.");
      setSelectedBooking(null);
      loadMentorData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 animate-pulse flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-400">Loading Mentor Studio...</p>
      </div>
    );
  }

  const isProfileComplete = profile?.profile_status === "ACTIVE";

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 relative overflow-x-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#070913]/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/skilldepz.png"
                alt="SkillDipz"
                width={130}
                height={34}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Mentor Studio</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            {isProfileComplete ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live in Directory</span>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Draft Profile</span>
              </div>
            )}

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-black">
                {profileForm.full_name ? profileForm.full_name.charAt(0).toUpperCase() : "M"}
              </div>
              <span className="text-xs font-bold text-slate-200 hidden sm:inline max-w-[120px] truncate">
                {profileForm.full_name || "Mentor"}
              </span>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 relative z-10">
        {/* Hero Banner & KPI Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Welcome Card */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-950 border border-indigo-500/20 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between shadow-2xl">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Shield className="w-3 h-3 text-indigo-400" /> Verified Mentor Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome, {profileForm.full_name || user?.full_name || "Mentor"} 👋
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
                {profileForm.current_role ? (
                  <span>
                    <strong className="text-slate-200">{profileForm.current_role}</strong>
                    {profileForm.company && <span> at <strong className="text-indigo-300">{profileForm.company}</strong></span>}
                  </span>
                ) : (
                  "Complete your profile below to start conducting 1-on-1 technical mock rounds."
                )}
              </p>
            </div>

            {/* Profile Completion Checklist Bar */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Profile Readiness
                </span>
                <span className="font-black text-indigo-400">{completionStats.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${completionStats.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stat Cards */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Published Slots</span>
                <Calendar className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">{slots.length}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {slots.filter((s) => !s.is_booked && s.is_enabled).length} Open for booking
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Student Rounds</span>
                <Video className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">{bookings.length}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {bookings.filter((b) => b.status === "completed").length} Evaluated
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Mentor Rating</span>
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-amber-300">{profile?.rating ? profile.rating.toFixed(1) : "5.0"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Based on {profile?.total_reviews || 0} reviews
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Directory State</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className={`text-base font-black ${isProfileComplete ? "text-emerald-400" : "text-amber-400"}`}>
                  {isProfileComplete ? "Active" : "Incomplete"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {isProfileComplete ? "Discoverable by students" : "Action required"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 w-full sm:w-fit overflow-x-auto shadow-lg">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" /> 1. Profile Studio & Live Preview
          </button>
          <button
            onClick={() => setActiveTab("availability")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "availability"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" /> 2. Availability Schedule ({slots.length})
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "sessions"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Video className="w-4 h-4" /> 3. Booked Rounds ({bookings.length})
          </button>
        </div>

        {/* TAB 1: PROFILE STUDIO WITH LIVE PREVIEW */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Editor (7 Cols) */}
            <form onSubmit={handleSaveProfile} className="lg:col-span-7 space-y-6">
              {/* Section 1: Basic Identity */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Basic Information</h3>
                    <p className="text-[11px] text-slate-400">Your public identity visible to students</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      placeholder="e.g. Dr. Jane Smith"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Profile Photo URL</label>
                    <input
                      type="url"
                      value={profileForm.profile_photo}
                      onChange={(e) => setProfileForm({ ...profileForm, profile_photo: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Professional Tagline / Headline</label>
                  <input
                    type="text"
                    value={profileForm.headline}
                    onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
                    placeholder="e.g. Staff Distributed Systems Architect | Ex-Amazon, Google"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Section 2: Career & Experience */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Experience & Education</h3>
                    <p className="text-[11px] text-slate-400">Your engineering background and credentials</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Current Role / Job Title *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.current_role}
                      onChange={(e) => setProfileForm({ ...profileForm, current_role: e.target.value })}
                      placeholder="e.g. Senior Staff Engineer"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Company / Organization *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.company}
                      onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                      placeholder="e.g. Google, Razorpay, Uber"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Years of Industry Experience *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={60}
                      value={profileForm.experience_years || ""}
                      onChange={(e) => setProfileForm({ ...profileForm, experience_years: Number(e.target.value) })}
                      placeholder="e.g. 7"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Education / Alma Mater</label>
                    <input
                      type="text"
                      value={profileForm.education}
                      onChange={(e) => setProfileForm({ ...profileForm, education: e.target.value })}
                      placeholder="e.g. B.Tech Computer Science, IIT Bombay"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Languages (comma-separated)</label>
                  <input
                    type="text"
                    value={profileForm.languages}
                    onChange={(e) => setProfileForm({ ...profileForm, languages: e.target.value })}
                    placeholder="English, Hindi, Kannada, Telugu"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Section 3: Technical Mastery & Mentoring Topics */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Expertise & Mentoring Focus</h3>
                    <p className="text-[11px] text-slate-400">Topics and technical areas you evaluate</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">
                      Expertise Domains (comma-separated) *
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.expertise}
                      onChange={(e) => setProfileForm({ ...profileForm, expertise: e.target.value })}
                      placeholder="System Design, Distributed Systems, Cloud Architecture, DSA"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">
                      Technical Skills & Tech Stack (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={profileForm.skills}
                      onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                      placeholder="Python, Go, Kubernetes, Kafka, Redis, PostgreSQL, AWS"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">
                      Mentoring Topics Offered (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={profileForm.mentoring_topics}
                      onChange={(e) => setProfileForm({ ...profileForm, mentoring_topics: e.target.value })}
                      placeholder="System Design Mock Round, DSA Coding Evaluation, Resume Review"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">
                      Bio & Mentorship Philosophy *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder="Describe your engineering journey, the standards you evaluate candidates on, and tips for students..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Visibility Status */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-4 shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white">Profile Visibility Status</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Control whether students can find you</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, profile_status: "ACTIVE" })}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      profileForm.profile_status === "ACTIVE"
                        ? "bg-emerald-500/10 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Active</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-[10px] text-slate-400">Live in student directory</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, profile_status: "INACTIVE" })}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      profileForm.profile_status === "INACTIVE"
                        ? "bg-amber-500/10 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Paused</span>
                      <Power className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-[10px] text-slate-400">Temporarily hidden</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, profile_status: "INCOMPLETE" })}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      profileForm.profile_status === "INCOMPLETE"
                        ? "bg-violet-500/10 border-violet-500/60 text-violet-300 ring-1 ring-violet-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Draft</span>
                      <Edit3 className="w-4 h-4 text-violet-400" />
                    </div>
                    <p className="text-[10px] text-slate-400">Incomplete profile</p>
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to MongoDB...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save & Publish Mentor Profile</span>
                  </>
                )}
              </button>
            </form>

            {/* Live Student Directory Preview Card (5 Cols Sticky) */}
            <div className="lg:col-span-5 sticky top-24 space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" /> Live Student Directory Card
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  Real-time Preview
                </span>
              </div>

              {/* Preview Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-[#0c101d] border border-slate-800 shadow-2xl space-y-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    {profileForm.profile_photo ? (
                      <img
                        src={profileForm.profile_photo}
                        alt="Avatar"
                        className="w-14 h-14 rounded-2xl object-cover border border-indigo-500/30 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-xl border border-indigo-400/30 shadow-md">
                        {profileForm.full_name ? profileForm.full_name.charAt(0).toUpperCase() : "M"}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-base font-bold text-white truncate">
                      {profileForm.full_name || "Your Name Here"}
                    </h4>
                    <p className="text-xs text-indigo-300 font-semibold truncate">
                      {profileForm.current_role || "Current Role"}
                    </p>
                    {profileForm.company && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" /> {profileForm.company}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tagline / Headline */}
                {profileForm.headline && (
                  <p className="text-xs text-slate-300 italic border-l-2 border-indigo-500/40 pl-3 leading-relaxed">
                    "{profileForm.headline}"
                  </p>
                )}

                {/* Experience & Rating Pill */}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>5.0</span>
                    <span className="text-[10px] text-slate-500 font-normal">({profile?.total_reviews || 0})</span>
                  </div>
                  <span className="text-slate-700">·</span>
                  <span>{profileForm.experience_years || 0} yrs experience</span>
                </div>

                {/* Expertise Chips */}
                {profileForm.expertise && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Expertise</span>
                    <div className="flex flex-wrap gap-1.5">
                      {profileForm.expertise
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 4)
                        .map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Bio Snippet */}
                {profileForm.bio && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">About</span>
                    <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                      {profileForm.bio}
                    </p>
                  </div>
                )}

                {/* Preview CTA Button */}
                <div className="pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                  >
                    <span>Book 1-on-1 Mock Round</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5">
                    {slots.length} available slots published
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AVAILABILITY CALENDAR & SLOTS */}
        {activeTab === "availability" && (
          <div className="space-y-8 max-w-5xl">
            {/* Create Slot Card */}
            <form
              onSubmit={handleCreateSlot}
              className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-indigo-500/20 backdrop-blur-xl shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-400" /> Add Available Time Slot
                  </h3>
                  <p className="text-xs text-slate-400">
                    Publish your open hours for student technical evaluations
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Start Time (UTC) *</label>
                  <input
                    type="time"
                    required
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Session Duration</label>
                  <select
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes (Standard)</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={creatingSlot}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
                  >
                    {creatingSlot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Publish Slot
                  </button>
                </div>
              </div>
            </form>

            {/* Published Slots Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Published Slots ({slots.length})
                </h3>
              </div>

              {slots.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-white">No availability slots published yet</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Add your available dates and times above so students can discover and book 1-on-1 mock sessions with you.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slots.map((s) => (
                    <div
                      key={s.slot_id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                        s.is_booked
                          ? "bg-amber-950/20 border-amber-500/30 ring-1 ring-amber-500/20"
                          : !s.is_enabled
                          ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                          : "bg-slate-900/70 border-slate-800 hover:border-indigo-500/40 shadow-lg"
                      }`}
                    >
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">
                            {new Date(s.start_time).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {s.is_booked ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Booked
                            </span>
                          ) : s.is_enabled ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Open
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                              Disabled
                            </span>
                          )}
                        </div>

                        <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-[11px] text-slate-500">{s.duration_mins} Minutes Session</p>
                      </div>

                      {!s.is_booked && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                          <button
                            onClick={() => handleToggleSlot(s.slot_id)}
                            className={`text-[11px] font-semibold flex items-center gap-1 transition ${
                              s.is_enabled ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            {s.is_enabled ? "Disable" : "Enable"}
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditSlot(s)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="Edit Slot"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(s.slot_id)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                              title="Delete Slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BOOKED SESSIONS */}
        {activeTab === "sessions" && (
          <div className="space-y-6 max-w-5xl">
            {/* Header & Sub-filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  Mentoring Sessions & Candidate Evaluations
                </h3>
                <p className="text-xs text-slate-400">
                  Real bookings scheduled by authenticated candidates.
                </p>
              </div>

              {/* Sub-filter tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "upcoming", label: "Upcoming", count: bookings.filter(b => b.status === "confirmed" || b.status === "in_progress").length },
                  { id: "pending", label: "Pending Requests", count: bookings.filter(b => b.status === "pending").length },
                  { id: "completed", label: "Completed", count: bookings.filter(b => b.status === "completed").length },
                  { id: "students", label: "Students", count: Array.from(new Set(bookings.map(b => b.student_id))).length },
                  { id: "all", label: "All Sessions", count: bookings.length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSessionSubFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                      sessionSubFilter === tab.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white">You don&apos;t have any mentoring sessions yet.</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  As soon as candidates book one of your available calendar slots, their session details, target company goals, and meeting room links will appear here.
                </p>
              </div>
            ) : sessionSubFilter === "students" ? (
              /* Unique Students View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from(new Set(bookings.map((b) => b.student_id))).map((stId) => {
                  const studentBookings = bookings.filter((b) => b.student_id === stId);
                  const firstB = studentBookings[0];
                  return (
                    <div
                      key={stId}
                      className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl space-y-3 shadow-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {firstB.student_name ? firstB.student_name.charAt(0).toUpperCase() : "S"}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{firstB.student_name}</h4>
                          <p className="text-[11px] text-slate-400 truncate">{firstB.student_email}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Sessions Booked:</span>
                        <strong className="text-white font-black">{studentBookings.length}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Bookings Cards List */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bookings
                  .filter((b) => {
                    if (sessionSubFilter === "upcoming") return b.status === "confirmed" || b.status === "in_progress";
                    if (sessionSubFilter === "pending") return b.status === "pending";
                    if (sessionSubFilter === "completed") return b.status === "completed";
                    return true;
                  })
                  .map((b) => (
                    <div
                      key={b.booking_id}
                      className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl space-y-4 hover:border-indigo-500/30 transition shadow-xl"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              b.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {b.status}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1.5">{b.student_name}</h3>
                          <p className="text-xs text-slate-400">{b.student_email}</p>
                        </div>
                        {b.overall_score && (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">Graded Score</span>
                            <span className="text-xl font-black text-emerald-400">{b.overall_score}%</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                        <p className="text-indigo-300 font-bold">{b.topic}</p>
                        <p className="text-slate-400">Target Role: <strong className="text-slate-200">{b.target_role || "Software Engineer"}</strong></p>
                        <p className="text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          {new Date(b.scheduled_at).toLocaleString()} ({b.duration_mins} mins)
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition"
                        >
                          <Award className="w-3.5 h-3.5" /> Grade & Rubric
                        </button>
                        {b.meeting_url && (
                          <a
                            href={b.meeting_url}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition"
                          >
                            <Video className="w-3.5 h-3.5 text-indigo-400" /> Join Room
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* EDIT AVAILABILITY SLOT MODAL */}
      <AnimatePresence>
        {editingSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleSaveEditSlot}
              className="bg-[#0b0f1a] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Edit Availability Slot</h3>
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Start Time (UTC)</label>
                  <input
                    type="time"
                    required
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Duration</label>
                  <select
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditSlot}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition"
                >
                  {savingEditSlot ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* FEEDBACK & RUBRIC SUBMISSION MODAL */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0f1a] border border-slate-800 rounded-3xl w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Grade Candidate: {selectedBooking.student_name}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedBooking.topic}</p>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Overall Score */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Overall Performance Score (0 - 100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={feedbackScore}
                    onChange={(e) => setFeedbackScore(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold text-sm"
                  />
                </div>

                {/* 5 Rubric Factors */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="font-bold text-slate-200">Competency Rubric Matrix</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block mb-1">DSA & Problem Solving</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rubricScores.dsa}
                        onChange={(e) => setRubricScores({ ...rubricScores, dsa: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">System Architecture</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rubricScores.sys_arch}
                        onChange={(e) => setRubricScores({ ...rubricScores, sys_arch: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Behavioral & Fit</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rubricScores.behavioral}
                        onChange={(e) => setRubricScores({ ...rubricScores, behavioral: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Communication Clarity</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rubricScores.communication}
                        onChange={(e) => setRubricScores({ ...rubricScores, communication: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Key Strengths */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Key Strengths (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={strengthsInput}
                    onChange={(e) => setStrengthsInput(e.target.value)}
                    placeholder="e.g. Clean modular code, great explanation of database trade-offs"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                {/* Improvement Areas */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Areas to Elevate (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={improvementInput}
                    onChange={(e) => setImprovementInput(e.target.value)}
                    placeholder="e.g. Time complexity calculations, error boundary design"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                {/* Actionable Recommendations */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Actionable Recommendations (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={recommendationsInput}
                    onChange={(e) => setRecommendationsInput(e.target.value)}
                    placeholder="e.g. Practice distributed locking patterns, review database indexing"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                {/* Written Evaluation */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Detailed Written Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Candidate gave strong answers on system scalability..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={submittingFeedback}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Submit Evaluation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
