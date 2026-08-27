"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Briefcase,
  Award,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  Building2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { MentorProfile, MentorSlot, bookMentorSlot } from "@/lib/interviewApi";

interface MentorBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mentor: MentorProfile | null;
  onBookingSuccess: (bookingId: string) => void;
}

export default function MentorBookingModal({
  isOpen,
  onClose,
  mentor,
  onBookingSuccess,
}: MentorBookingModalProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [topic, setTopic] = useState("1-on-1 Technical Mock Interview & Architecture Review");
  const [targetRole, setTargetRole] = useState("Software Development Engineer");
  const [studentNotes, setStudentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !mentor) return null;

  const slots = mentor.slots || [];

  const handleBook = async () => {
    if (!selectedSlotId) {
      toast.error("Please select an available time slot.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await bookMentorSlot({
        mentor_id: mentor.mentor_id,
        slot_id: selectedSlotId,
        topic,
        target_role: targetRole,
        target_company: mentor.company,
        student_notes: studentNotes,
      });

      toast.success(`Mentorship session booked with ${mentor.full_name || mentor.name}!`, {
        description: `Scheduled for ${new Date(res.scheduled_at).toLocaleString()}`,
      });

      onBookingSuccess(res.booking_id);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to book mentorship slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSlotTime = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <img
              src={mentor.profile_photo || mentor.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
              alt={mentor.full_name || mentor.name}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/30"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{mentor.full_name || mentor.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {mentor.company}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{mentor.current_role || mentor.headline || mentor.title || "Senior Mentor"}</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Slot Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Select Available Time Slot (45 Mins)</span>
              <span className="text-indigo-400 lowercase font-normal">{slots.length} available</span>
            </label>

            {slots.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center text-slate-400 text-sm">
                No open slots currently available for this mentor. Check back shortly!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {slots.map((slot) => {
                  const { date, time } = formatSlotTime(slot.start_time);
                  const isSelected = selectedSlotId === slot.slot_id;
                  return (
                    <button
                      key={slot.slot_id}
                      type="button"
                      onClick={() => setSelectedSlotId(slot.slot_id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400">{date}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-sm font-semibold mt-0.5">{time}</p>
                      <span className="text-[10px] text-slate-400">45 Mins Live Video</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Session Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Focus & Topic
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="1-on-1 Technical Mock Interview & Architecture Review">
                1-on-1 Technical Mock Interview & Architecture Review
              </option>
              <option value="System Design & Low-Level Design Deep-Dive">
                System Design & Low-Level Design Deep-Dive
              </option>
              <option value="Data Structures & Algorithms Problem Solving">
                Data Structures & Algorithms Problem Solving
              </option>
              <option value="FAANG Behavioral STAR & Resume Audit">
                FAANG Behavioral STAR & Resume Audit
              </option>
            </select>
          </div>

          {/* Target Role */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Your Target Role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. SDE-1, Fullstack Engineer, Backend Lead"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Notes for Mentor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Notes for Mentor (Optional)
            </label>
            <textarea
              rows={3}
              value={studentNotes}
              onChange={(e) => setStudentNotes(e.target.value)}
              placeholder="Share specific topics, upcoming interview targets, or weak areas you want to test..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Video className="w-4 h-4 text-emerald-400" />
            Includes live recording & structured rubric
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleBook}
              disabled={isSubmitting || !selectedSlotId}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Booking...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Confirm 1-on-1 Session
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
