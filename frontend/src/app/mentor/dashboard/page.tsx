"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  fetchMyMentorProfile,
  saveMentorProfile,
  createMentorSlot,
  deleteMentorSlot,
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
  Loader2,
  ExternalLink,
  ShieldCheck,
  Building2,
  Sparkles,
  BookOpen,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MentorDashboardPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [slots, setSlots] = useState<MentorSlot[]>([]);
  const [bookings, setBookings] = useState<MentorshipBooking[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"sessions" | "slots" | "profile">("sessions");

  // Profile Form State
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    years_experience: 5,
    expertise_tags: "System Design, DSA, Backend",
    bio: "",
    linkedin_url: "",
    is_active: true,
  });

  // Slot creation state
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("14:00");
  const [creatingSlot, setCreatingSlot] = useState(false);

  // Feedback Modal State
  const [selectedBooking, setSelectedBooking] = useState<MentorshipBooking | null>(null);
  const [feedbackScore, setFeedbackScore] = useState<number>(85);
  const [feedbackNotes, setFeedbackNotes] = useState<string>("");
  const [rubricScores, setRubricScores] = useState({
    dsa: 80,
    sys_arch: 85,
    behavioral: 88,
    code_quality: 82,
    communication: 90,
  });
  const [strengthsInput, setStrengthsInput] = useState<string>(
    "Clear architectural decomposition, great explanation of database trade-offs"
  );
  const [improvementInput, setImprovementInput] = useState<string>(
    "Provide Big-O complexity calculations upfront before coding"
  );
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load Real Database Profile & Bookings
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
        setFormData({
          title: profRes.profile.title || "",
          company: profRes.profile.company || "",
          years_experience: profRes.profile.years_experience || 0,
          expertise_tags: (profRes.profile.expertise_tags || []).join(", "),
          bio: profRes.profile.bio || "",
          linkedin_url: profRes.profile.linkedin_url || "",
          is_active: profRes.profile.is_active ?? false,
        });
      }
    } catch (err) {
      console.error("Failed to load mentor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const tags = formData.expertise_tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await saveMentorProfile({
        title: formData.title,
        company: formData.company,
        years_experience: Number(formData.years_experience),
        expertise_tags: tags,
        bio: formData.bio,
        linkedin_url: formData.linkedin_url,
        is_active: formData.is_active,
      });

      setProfile(res.profile);
      alert("Mentor profile updated successfully!");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotDate || !slotTime) return;

    try {
      setCreatingSlot(true);
      const isoString = new Date(`${slotDate}T${slotTime}:00Z`).toISOString();
      const res = await createMentorSlot({ start_time: isoString, duration_mins: 45 });
      setSlots((prev) => [...prev, res.slot]);
      setSlotDate("");
      alert("Availability slot added to database!");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to create slot");
    } finally {
      setCreatingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this open slot?")) return;
    try {
      await deleteMentorSlot(slotId);
      setSlots((prev) => prev.filter((s) => s.slot_id !== slotId));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete slot");
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
        actionable_recommendations: [
          "Practice timed whiteboarding questions on medium/hard DSA patterns",
          "Deep dive on distributed cache invalidation strategies",
        ],
      };

      await submitMentorFeedback(selectedBooking.booking_id, {
        overall_score: feedbackScore,
        mentor_feedback: feedbackNotes || "Strong performance and clear architectural articulation.",
        rubric: detailedRubric,
      });

      alert("Evaluation and Rubric submitted! Student level and XP updated.");
      setSelectedBooking(null);
      loadMentorData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-xs text-slate-400">Loading Mentor Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <span>🎯</span> Mentor & Interviewer Portal
            </span>
            {profile?.is_active ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live & Visible to Students
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Profile Incomplete / Inactive
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Welcome back, {user?.full_name || "Mentor"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {profile?.title || "Industry Mentor"} · {profile?.company || "Tech Org"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab("sessions")}
          className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "sessions"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Video className="w-4 h-4" /> Booked Sessions ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab("slots")}
          className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "slots"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" /> Availability Slots ({slots.length})
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "profile"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Mentor Profile & Bio
        </button>
      </div>

      {/* TAB 1: BOOKED SESSIONS */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {bookings.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/80 text-center space-y-3">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No student sessions booked yet.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Once students book your available calendar slots, their mock interviews will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookings.map((b) => (
                <div
                  key={b.booking_id}
                  className="p-5 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/80 space-y-4 hover:border-indigo-500/30 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                        {b.status}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1.5">{b.student_name}</h3>
                      <p className="text-xs text-slate-400">{b.student_email}</p>
                    </div>
                    {b.overall_score && (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Graded Score</span>
                        <span className="text-lg font-black text-emerald-400">{b.overall_score}%</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs space-y-1">
                    <p className="text-indigo-300 font-semibold">{b.topic}</p>
                    <p className="text-slate-400">Target Role: {b.target_role || "Software Engineer"}</p>
                    <p className="text-slate-400 flex items-center gap-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      {new Date(b.scheduled_at).toLocaleString()} (45 mins)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => setSelectedBooking(b)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition"
                    >
                      <Award className="w-3.5 h-3.5" /> Grade & Rubric
                    </button>
                    {b.meeting_url && (
                      <a
                        href={b.meeting_url}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition"
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

      {/* TAB 2: AVAILABILITY SLOTS */}
      {activeTab === "slots" && (
        <div className="space-y-6">
          {/* Create Slot Card */}
          <form
            onSubmit={handleCreateSlot}
            className="p-5 sm:p-6 rounded-2xl bg-[#0b0f19]/90 border border-indigo-500/20 space-y-4 shadow-xl"
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" /> Add New 45-Min Availability Slot
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Start Time (UTC)</label>
                <input
                  type="time"
                  required
                  value={slotTime}
                  onChange={(e) => setSlotTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creatingSlot}
                  className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition"
                >
                  {creatingSlot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Publish Slot to Students
                </button>
              </div>
            </div>
          </form>

          {/* Slots List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Active Slots</h3>
            {slots.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                <p className="text-xs text-slate-400">No active slots. Add your first time slot above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {slots.map((s) => (
                  <div
                    key={s.slot_id}
                    className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {new Date(s.start_time).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-slate-400">
                        {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (45m)
                      </p>
                      {s.is_booked ? (
                        <span className="inline-block mt-1 text-[10px] text-amber-400 font-bold">● Booked</span>
                      ) : (
                        <span className="inline-block mt-1 text-[10px] text-emerald-400 font-bold">● Open</span>
                      )}
                    </div>

                    {!s.is_booked && (
                      <button
                        onClick={() => handleDeleteSlot(s.slot_id)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MENTOR PROFILE */}
      {activeTab === "profile" && (
        <form
          onSubmit={handleSaveProfile}
          className="p-6 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/80 space-y-5 max-w-2xl"
        >
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Mentor Profile & Expertise</h3>
            <p className="text-xs text-slate-400">
              This information is displayed to students on the 1-to-1 Mentorship directory.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Current Job Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Senior Staff Backend Engineer"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Company / Organization</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Google, Amazon, Razorpay"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Years of Industry Experience</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={50}
                  value={formData.years_experience}
                  onChange={(e) => setFormData({ ...formData, years_experience: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Expertise Tags (comma-separated)</label>
              <input
                type="text"
                required
                value={formData.expertise_tags}
                onChange={(e) => setFormData({ ...formData, expertise_tags: e.target.value })}
                placeholder="System Design, DSA, Concurrency, Distributed Systems"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Bio & Mentorship Approach</label>
              <textarea
                required
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Share your background, what you cover during sessions, and how you help students crack top tier technical rounds."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="is_active_toggle"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
              />
              <label htmlFor="is_active_toggle" className="text-slate-300 font-semibold cursor-pointer">
                Publish profile and make visible on Student Mentor Directory
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save & Publish Profile
          </button>
        </form>
      )}

      {/* FEEDBACK & RUBRIC SUBMISSION MODAL */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c101c] border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
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
