"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
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
  ArrowRight,
  Briefcase,
  GraduationCap,
  Languages,
  BookOpen,
} from "lucide-react";
import {
  MentorProfile,
  fetchMentors,
} from "@/lib/interviewApi";
import MentorBookingModal from "@/components/interview/MentorBookingModal";

export default function MentorDirectoryPage() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("All");
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  const loadMentors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMentors();
      setMentors(res.mentors || []);
    } catch (err: any) {
      console.error("Failed to load mentors:", err);
      setError(
        err?.response?.data?.detail || "Failed to load active mentors from server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentors();
  }, []);

  const companies = ["All", "Google", "Amazon", "Razorpay", "Flipkart", "Microsoft", "Uber"];

  const filteredMentors = mentors.filter((m) => {
    const compName = m.company || "";
    const name = m.name || m.full_name || "";
    const title = m.title || m.current_role || m.headline || "";
    const headline = m.headline || "";
    const expList: string[] = m.expertise_tags || m.expertise || [];
    const skillList: string[] = m.skills || [];
    const topicList: string[] = m.mentoring_topics || [];

    const matchesCompany =
      selectedCompany === "All" ||
      compName.toLowerCase().includes(selectedCompany.toLowerCase());

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCompany;

    const matchesSearch =
      name.toLowerCase().includes(q) ||
      compName.toLowerCase().includes(q) ||
      title.toLowerCase().includes(q) ||
      headline.toLowerCase().includes(q) ||
      expList.some((t) => t.toLowerCase().includes(q)) ||
      skillList.some((s) => s.toLowerCase().includes(q)) ||
      topicList.some((top) => top.toLowerCase().includes(q));

    return matchesCompany && matchesSearch;
  });

  const handleOpenBooking = (mentor: any) => {
    setSelectedMentor(mentor);
    setBookingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

      {/* Top Header */}
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
              <span>1-to-1 Mentorship Directory</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/student/mock-interview"
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Video className="w-3.5 h-3.5 text-indigo-400" /> Mock Interview Hub
            </Link>
            <Link
              href="/mentor/register"
              className="px-4 py-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition hidden sm:inline-flex items-center gap-1.5"
            >
              Become a Mentor →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8 relative z-10">
        {/* Hero Banner */}
        <div className="p-8 sm:p-10 rounded-3xl bg-linear-to-br from-indigo-950/40 via-slate-900/60 to-slate-950 border border-indigo-500/20 backdrop-blur-xl relative overflow-hidden shadow-2xl space-y-4">
          <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Users className="w-3.5 h-3.5 text-indigo-400" /> Real Verified Mentors
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            1-to-1 Technical Mentorship & Mock Interviews
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Schedule private mock rounds, system architecture reviews, and resume teardowns with active software engineers from top tech companies.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-xl">
          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by mentor name, role, skill (e.g. Python, System Design)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Company Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
            {companies.map((comp) => (
              <button
                key={comp}
                onClick={() => setSelectedCompany(comp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCompany === comp
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-md shadow-indigo-500/10"
                    : "bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
        </div>

        {/* Directory State Handling */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Fetching active mentors from MongoDB...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/20 text-center space-y-3">
            <p className="text-sm font-bold text-red-400">{error}</p>
            <button
              onClick={loadMentors}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition"
            >
              Try Again
            </button>
          </div>
        ) : filteredMentors.length === 0 ? (
          /* Empty State */
          <div className="p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3 max-w-2xl mx-auto shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No mentors available yet.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Active mentors will appear here as soon as they complete their profile and publish open interview availability slots.
            </p>
          </div>
        ) : (
          /* Real Mentors Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMentors.map((m) => {
              const name = m.name || m.full_name || "Mentor";
              const photo = m.avatar_url || m.profile_photo;
              const headline = m.headline || "";
              const currentRole = m.title || m.current_role || "Engineering Mentor";
              const company = m.company || "";
              const expYears = m.years_experience ?? m.experience_years ?? 0;
              const expertiseList: string[] = m.expertise_tags || m.expertise || [];
              const skillsList: string[] = m.skills || [];
              const topicsList: string[] = m.mentoring_topics || [];
              const openSlotsCount = m.available_slots_count || 0;

              return (
                <motion.div
                  key={m.mentor_id}
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
                            href={`/mentors/${m.mentor_id}`}
                            className="font-bold text-white text-base hover:text-indigo-400 transition truncate"
                          >
                            {name}
                          </Link>
                          <div className="flex items-center gap-1 text-amber-400 text-xs font-bold shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{m.rating ? m.rating.toFixed(1) : "5.0"}</span>
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
                      <span>{m.sessions_completed || 0} rounds conducted</span>
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
                      href={`/mentors/${m.mentor_id}`}
                      className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition"
                    >
                      View Profile
                    </Link>

                    <button
                      onClick={() => handleOpenBooking(m)}
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
      </main>

      {/* Booking Modal */}
      <MentorBookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        mentor={selectedMentor}
        onBookingSuccess={() => {
          loadMentors();
        }}
      />
    </div>
  );
}
