"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Building2,
  Calendar,
  Clock,
  Briefcase,
  GraduationCap,
  Languages,
  BookOpen,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Video,
} from "lucide-react";
import {
  MentorProfile,
  MentorSlot,
  fetchMentorDetail,
  bookMentorSlot,
} from "@/lib/interviewApi";
import { toast } from "sonner";

export default function MentorProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mentorId = params?.mentorId as string;

  const [mentor, setMentor] = useState<any | null>(null);
  const [slots, setSlots] = useState<MentorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking Form State
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [topic, setTopic] = useState("1-on-1 Technical Mock Interview & Architecture Review");
  const [targetRole, setTargetRole] = useState("Software Development Engineer");
  const [targetCompany, setTargetCompany] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const loadDetail = async () => {
    if (!mentorId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMentorDetail(mentorId);
      setMentor(res.mentor);
      setSlots(res.slots || []);
      if ((res.slots || []).length > 0) {
        setSelectedSlotId(res.slots[0].slot_id);
      }
    } catch (err: any) {
      console.error("Failed to load mentor details:", err);
      setError(
        err?.response?.data?.detail || "Mentor not found or profile is not active."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [mentorId]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      toast.error("Please select an available time slot.");
      return;
    }

    try {
      setBookingLoading(true);
      const res = await bookMentorSlot({
        mentor_id: mentorId,
        slot_id: selectedSlotId,
        topic,
        target_role: targetRole,
        target_company: targetCompany || mentor?.company,
        student_notes: studentNotes,
      });

      toast.success(res.message || "Session booked successfully!");
      router.push("/student/mock-interview");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to book session.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading mentor profile from database...</p>
      </div>
    );
  }

  if (error || !mentor) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-md space-y-3">
          <h2 className="text-lg font-bold text-red-400">Mentor Profile Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || "This mentor is either not active or does not exist."}
          </p>
          <Link
            href="/mentors"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Mentors Directory
          </Link>
        </div>
      </div>
    );
  }

  const name = mentor.full_name || mentor.name || "Mentor";
  const photo = mentor.profile_photo || mentor.avatar_url;
  const currentRole = mentor.current_role || mentor.title || "Engineering Mentor";
  const expYears = mentor.experience_years ?? mentor.years_experience ?? 0;
  const expertiseList: string[] = mentor.expertise || mentor.expertise_tags || [];
  const skillsList: string[] = mentor.skills || [];
  const topicsList: string[] = mentor.mentoring_topics || [];
  const languagesList: string[] = mentor.languages || [];

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#070913]/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <Link
            href="/mentors"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Directory
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/skilldepz.png"
              alt="SkillDipz"
              width={120}
              height={30}
              className="h-6 w-auto object-contain"
              priority
            />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8 relative z-10">
        {/* Mentor Overview Header Card */}
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/70 to-slate-950 border border-indigo-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-6">
              <div className="relative shrink-0">
                {photo ? (
                  <img
                    src={photo}
                    alt={name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-indigo-500/40 shadow-xl"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-3xl border border-indigo-400/40 shadow-xl">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white">{name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" /> Verified Mentor
                  </span>
                </div>

                <p className="text-sm font-semibold text-indigo-300">{currentRole}</p>
                {mentor.company && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" /> {mentor.company}
                  </p>
                )}

                {mentor.headline && (
                  <p className="text-xs text-slate-300 italic pt-1 max-w-xl">
                    "{mentor.headline}"
                  </p>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shrink-0">
              <div className="text-center px-3 border-r border-slate-800">
                <div className="flex items-center justify-center gap-1 text-amber-400 font-black text-base">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{mentor.rating ? mentor.rating.toFixed(1) : "5.0"}</span>
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Rating</span>
              </div>

              <div className="text-center px-3 border-r border-slate-800">
                <p className="text-base font-black text-white">{expYears} yrs</p>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Experience</span>
              </div>

              <div className="text-center px-3">
                <p className="text-base font-black text-emerald-400">{slots.length}</p>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Open Slots</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Split: Detailed Info (Left) + Booking Scheduler (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Biography & Technical Details (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bio */}
            {mentor.bio && (
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" /> About & Mentorship Approach
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {mentor.bio}
                </p>
              </div>
            )}

            {/* Expertise & Skills Matrix */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Domain Competencies & Tech Stack
              </h3>

              {expertiseList.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Core Domains</span>
                  <div className="flex flex-wrap gap-1.5">
                    {expertiseList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {skillsList.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Technical Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {skillsList.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mentoring Topics & Languages */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
              {topicsList.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-violet-400" /> Mock Interview Topics Offered
                  </h3>
                  <div className="space-y-1.5 pt-1">
                    {topicsList.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {languagesList.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-indigo-400" /> Languages
                  </span>
                  <p className="text-xs text-slate-300">{languagesList.join(", ")}</p>
                </div>
              )}

              {mentor.education && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> Education
                  </span>
                  <p className="text-xs text-slate-300">{mentor.education}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Slot Booking (5 Cols Sticky) */}
          <div className="lg:col-span-5 sticky top-24">
            <form
              onSubmit={handleBook}
              className="p-6 sm:p-7 rounded-3xl bg-slate-900/90 border border-indigo-500/20 backdrop-blur-xl shadow-2xl space-y-5"
            >
              <div className="space-y-1 pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" /> Schedule Mock Round
                </h3>
                <p className="text-xs text-slate-400">
                  Select an available calendar slot from this mentor
                </p>
              </div>

              {/* Slot Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Available Slots ({slots.length})
                </label>

                {slots.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
                    <Clock className="w-5 h-5 text-slate-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">No open time slots right now.</p>
                    <p className="text-[11px] text-slate-500">Please check back soon or browse other mentors.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {slots.map((s) => {
                      const isSelected = selectedSlotId === s.slot_id;
                      const dateFormatted = new Date(s.start_time).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                      const timeFormatted = `${new Date(s.start_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} - ${new Date(s.end_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`;

                      return (
                        <button
                          key={s.slot_id}
                          type="button"
                          onClick={() => setSelectedSlotId(s.slot_id)}
                          className={`p-3 rounded-xl border text-left transition flex items-center justify-between text-xs ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/40"
                              : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold block">{dateFormatted}</span>
                            <span className="text-[11px] text-slate-400">{timeFormatted}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-indigo-400">{s.duration_mins}m</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Interview Topic *</label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. System Design Mock Interview"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Target Role</label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Software Engineer II"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Target Company</label>
                  <input
                    type="text"
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    placeholder={mentor.company || "e.g. Google"}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Notes for Mentor (Optional)</label>
                  <textarea
                    rows={2}
                    value={studentNotes}
                    onChange={(e) => setStudentNotes(e.target.value)}
                    placeholder="Focus areas, specific topics you want evaluated..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white leading-relaxed"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={slots.length === 0 || bookingLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bookingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Booking...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    <span>Confirm & Book 1:1 Session</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
