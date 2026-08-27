"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Star,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  Search,
  Video,
  Award,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  MentorProfile,
  MentorshipBooking,
  fetchMentors,
  fetchMyMentorshipBookings,
} from "@/lib/interviewApi";
import MentorBookingModal from "./MentorBookingModal";

interface MentorshipTabProps {
  onJoinMeeting: (meetingUrl: string, bookingId: string) => void;
  onViewReport: (booking: MentorshipBooking) => void;
}

export default function MentorshipTab({
  onJoinMeeting,
  onViewReport,
}: MentorshipTabProps) {
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [myBookings, setMyBookings] = useState<MentorshipBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("All");
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "bookings">("directory");
  const [bookingSubFilter, setBookingSubFilter] = useState<"all" | "upcoming" | "past" | "cancelled">("upcoming");

  const loadData = async () => {
    setLoading(true);
    try {
      const [mentorsRes, bookingsRes] = await Promise.all([
        fetchMentors(),
        fetchMyMentorshipBookings(),
      ]);
      setMentors(mentorsRes.mentors);
      setMyBookings(bookingsRes.bookings);
    } catch (err) {
      console.error("Failed to load mentorship data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const companies = ["All", "Google", "Amazon", "Razorpay", "Flipkart", "Microsoft"];

  const filteredMentors = mentors.filter((m) => {
    const mentorName = m.full_name || m.name || "";
    const mentorCompany = m.company || "";
    const mentorTitle = m.current_role || m.headline || m.title || "";
    const mentorTags = m.expertise || m.skills || m.expertise_tags || [];

    const matchesCompany = selectedCompany === "All" || mentorCompany.toLowerCase() === selectedCompany.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      mentorName.toLowerCase().includes(query) ||
      mentorCompany.toLowerCase().includes(query) ||
      mentorTitle.toLowerCase().includes(query) ||
      mentorTags.some((t: string) => t.toLowerCase().includes(query));
    return matchesCompany && matchesSearch;
  });

  const handleOpenBooking = (mentor: MentorProfile) => {
    setSelectedMentor(mentor);
    setBookingModalOpen(true);
  };

  const handleBookingSuccess = () => {
    loadData();
    setActiveSubTab("bookings");
  };

  return (
    <div className="space-y-8">
      {/* Subtab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-400" />
            1-to-1 FAANG & Tier-1 Mentorship
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Book private mock interviews, architecture deep-dives, and resume teardowns with staff engineers.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveSubTab("directory")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "directory"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Find Mentors ({mentors.length})
          </button>
          <button
            onClick={() => setActiveSubTab("bookings")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === "bookings"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            My Sessions
            {myBookings.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] flex items-center justify-center">
                {myBookings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading verified mentors & schedule...</p>
        </div>
      ) : activeSubTab === "directory" ? (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by mentor, skill, or title..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Company Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
              {companies.map((comp) => (
                <button
                  key={comp}
                  onClick={() => setSelectedCompany(comp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCompany === comp
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
                  }`}
                >
                  {comp}
                </button>
              ))}
            </div>
          </div>

          {/* Mentors Grid or Empty State */}
          {filteredMentors.length === 0 ? (
            <div className="p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3 max-w-2xl mx-auto shadow-2xl">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No mentors available yet.</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Active mentors will appear here as soon as they register, complete their profile, and publish open interview availability slots.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMentors.map((mentor) => {
                const name = mentor.name || mentor.full_name || "Mentor";
                const photo = mentor.avatar_url || mentor.profile_photo;
                const headline = mentor.headline || "";
                const currentRole = mentor.title || mentor.current_role || "Engineering Mentor";
                const company = mentor.company || "";
                const expYears = mentor.years_experience ?? mentor.experience_years ?? 0;
                const expertiseList: string[] = mentor.expertise_tags || mentor.expertise || [];
                const skillsList: string[] = mentor.skills || [];
                const topicsList: string[] = mentor.mentoring_topics || [];
                const openSlotsCount = mentor.available_slots_count || 0;

                return (
                  <motion.div
                    key={mentor.mentor_id}
                    whileHover={{ y: -4 }}
                    className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between gap-5 transition-all relative overflow-hidden group"
                  >
                    <div className="space-y-4">
                      {/* Header: Photo + Name + Role + Company */}
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          {photo ? (
                            <img
                              src={photo}
                              alt={name}
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/30 shadow-md"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-xl border border-indigo-400/30 shadow-md">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <Link
                              href={`/mentors/${mentor.mentor_id}`}
                              className="font-bold text-white text-base hover:text-indigo-400 transition truncate"
                            >
                              {name}
                            </Link>
                            <div className="flex items-center gap-1 text-amber-400 text-xs font-bold shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{mentor.rating ? mentor.rating.toFixed(1) : "5.0"}</span>
                            </div>
                          </div>

                          <p className="text-xs text-indigo-300 font-semibold truncate">
                            {currentRole}
                          </p>
                          {company && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" /> {company}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Headline */}
                      {headline && (
                        <p className="text-xs text-slate-300 italic border-l-2 border-indigo-500/40 pl-3 leading-relaxed line-clamp-2">
                          "{headline}"
                        </p>
                      )}

                      {/* Experience pill */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                        <span className="font-semibold text-slate-300">{expYears} yrs experience</span>
                        <span className="text-slate-700">·</span>
                        <span>{mentor.sessions_completed || 0} rounds conducted</span>
                      </div>

                      {/* Expertise Domain Chips */}
                      {expertiseList.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Expertise</span>
                          <div className="flex flex-wrap gap-1.5">
                            {expertiseList.slice(0, 3).map((tag, idx) => (
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

                      {/* Skills Stack */}
                      {skillsList.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Skills</span>
                          <div className="flex flex-wrap gap-1.5">
                            {skillsList.slice(0, 4).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-950 border border-slate-800 text-slate-300"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mentoring Topics */}
                      {topicsList.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Topics</span>
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {topicsList.join(" · ")}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions / CTA */}
                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <Link
                        href={`/mentors/${mentor.mentor_id}`}
                        className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        View Profile
                      </Link>

                      <button
                        onClick={() => handleOpenBooking(mentor)}
                        disabled={openSlotsCount === 0}
                        className="px-4 py-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{openSlotsCount > 0 ? `Book (${openSlotsCount})` : "No Open Slots"}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* My Mentorship Bookings */
        <div className="space-y-4">
          {/* Subfilter header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              My 1-to-1 Mentorship Sessions ({myBookings.length})
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "upcoming", label: "Upcoming Sessions", count: myBookings.filter(b => b.status === "confirmed" || b.status === "in_progress").length },
                { id: "past", label: "Past Sessions", count: myBookings.filter(b => b.status === "completed").length },
                { id: "cancelled", label: "Cancelled", count: myBookings.filter(b => b.status === "cancelled").length },
                { id: "all", label: "All Sessions", count: myBookings.length },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setBookingSubFilter(sub.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                    bookingSubFilter === sub.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  <span>{sub.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
                    {sub.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {myBookings.length === 0 ? (
            <div className="p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3 shadow-xl">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">You don&apos;t have any mentoring sessions yet.</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Select an expert mentor in the directory to schedule your 1-on-1 mock interview with live rubric evaluation.
              </p>
              <button
                onClick={() => setActiveSubTab("directory")}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition"
              >
                Find Mentors <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myBookings
                .filter((b) => {
                  if (bookingSubFilter === "upcoming") return b.status === "confirmed" || b.status === "in_progress";
                  if (bookingSubFilter === "past") return b.status === "completed";
                  if (bookingSubFilter === "cancelled") return b.status === "cancelled";
                  return true;
                })
                .map((booking) => {
                  const isCompleted = booking.status === "completed";
                  const isConfirmed = booking.status === "confirmed" || booking.status === "in_progress";
                  const isCancelled = booking.status === "cancelled";
                  const schedDate = new Date(booking.scheduled_at).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={booking.booking_id}
                      className="p-5 rounded-2xl bg-[#0b0f19]/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isCompleted
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : isCancelled
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            }`}
                          >
                            {booking.status}
                          </span>
                          <span className="text-xs text-slate-400">· {booking.duration_mins} Mins</span>
                        </div>
                        <h3 className="text-base font-bold text-white">{booking.topic}</h3>
                        <p className="text-xs text-indigo-400 font-medium">
                          Mentor: {booking.mentor_name} ({booking.mentor_company}) · {schedDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {isConfirmed && booking.meeting_url && (
                          <button
                            onClick={() => onJoinMeeting(booking.meeting_url!, booking.booking_id)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                          >
                            <Video className="w-4 h-4" /> Enter Live Meeting Room
                          </button>
                        )}

                        {isCompleted && (
                          <button
                            onClick={() => onViewReport(booking)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                          >
                            <Award className="w-4 h-4 text-sky-400" /> View Rubric & Feedback ({Math.round(booking.overall_score || 85)}%)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      <MentorBookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        mentor={selectedMentor}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}
