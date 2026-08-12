import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeaderboardResponse } from "@/lib/leaderboardApi";
import { fmt } from "./leaderboardHelpers";
import { LeaderboardRow } from "./LeaderboardRow";

interface Props {
  data: LeaderboardResponse;
  loading: boolean;
  onPageChange: (page: number) => void;
}

const TH = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th
    className={`px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider ${className}`}
  >
    {children}
  </th>
);

export function LeaderboardTable({ data, loading, onPageChange }: Props) {
  const { page, total_pages, per_page, total_students, students } = data;

  // Build visible page numbers (window of 5)
  const pageNumbers: number[] = [];
  const windowSize = Math.min(5, total_pages);
  let start: number;
  if (total_pages <= 5) {
    start = 1;
  } else if (page <= 3) {
    start = 1;
  } else if (page >= total_pages - 2) {
    start = total_pages - 4;
  } else {
    start = page - 2;
  }
  for (let i = 0; i < windowSize; i++) pageNumbers.push(start + i);

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-[#0b0f19]/90 backdrop-blur-xl overflow-hidden shadow-2xl">

      {/* Table header bar */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs sm:text-sm font-semibold text-white">
          All Students · Page {page} of {total_pages}
        </p>
        <p className="text-xs text-slate-500 hidden sm:block">
          Click any row to see score breakdown
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/60">
              <TH className="text-center w-12 sm:w-14">Rank</TH>
              <TH className="text-left">Student</TH>
              <TH className="text-left hidden md:table-cell">Role</TH>
              <TH className="text-center">Score</TH>
              <TH className="text-center hidden lg:table-cell">Tests</TH>
              <TH className="text-center hidden lg:table-cell">Projects</TH>
              <TH className="text-center hidden xl:table-cell">Assignments</TH>
              <TH className="text-center hidden sm:table-cell">Streak</TH>
            </tr>
          </thead>
          <tbody>
            {students.map((entry) => (
              <LeaderboardRow key={entry.student_id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
        <p className="text-[10px] sm:text-xs text-slate-500">
          Showing {(page - 1) * per_page + 1}–
          {Math.min(page * per_page, total_students)} of {fmt(total_students)} students
        </p>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Prev */}
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page pills */}
          {pageNumbers.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-semibold transition-colors ${
                p === page
                  ? "bg-sky-500 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {p}
            </button>
          ))}

          {/* Next */}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === total_pages || loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
