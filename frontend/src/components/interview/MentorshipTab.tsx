"use client";

import { useEffect, useState } from "react";
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
    const matchesCompany = selectedCompany === "All" || m.company.toLowerCase() === selectedCompany.toLowerCase();
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.expertise_tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
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
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No verified mentors available right now.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Mentors will appear here as soon as they register, complete their engineering profile, and publish availability slots.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMentors.map((mentor) => (
                <motion.div
                  key={mentor.mentor_id}
                  whileHover={{ y: -3 }}
                  className="bg-[#0b0f19]/90 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between gap-5 relative overflow-hidden group"
                >
                  <div className="space-y-4">
                    {/* Avatar & Title Row */}
                    <div className="flex items-start gap-3.5">
                      <img
                        src={mentor.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                        alt={mentor.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/20 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-bold text-white text-sm truncate">{mentor.name}</h3>
                          <div className="flex items-center gap-1 text-amber-400 text-xs font-bold shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{mentor.rating.toFixed(2)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-indigo-400 font-semibold mt-0.5">{mentor.company}</p>
                        <p className="text-[11px] text-slate-400 truncate">{mentor.title}</p>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {mentor.bio}
                    </p>

                    {/* Expertise Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {mentor.expertise_tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer / Booking CTA */}
                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400">
                      <span className="text-emerald-400 font-semibold">{mentor.available_slots_count || 0} slots</span> open
                    </div>

                    <button
                      onClick={() => handleOpenBooking(mentor)}
                      disabled={(mentor.available_slots_count || 0) === 0}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Book Session
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* My Mentorship Bookings */
        <div className="space-y-4">
          {myBookings.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No mentorship sessions booked yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select an expert mentor above to schedule your 1-on-1 mock interview with live rubric evaluation.
              </p>
              <button
                onClick={() => setActiveSubTab("directory")}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                Browse Mentors <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myBookings.map((booking) => {
                const isCompleted = booking.status === "completed";
                const isConfirmed = booking.status === "confirmed" || booking.status === "in_progress";
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
                    className="p-5 rounded-2xl bg-[#0b0f19]/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
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
