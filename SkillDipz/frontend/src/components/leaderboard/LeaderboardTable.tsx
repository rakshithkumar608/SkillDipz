import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import type { LeaderboardResponse } from "@/lib/leaderboardApi";
import { fmt } from "./leaderboardHelpers";
import { LeaderboardRow } from "./LeaderboardRow";

interface Props {
  data: LeaderboardResponse;
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelectCandidate?: (studentId: string) => void;
}

export function LeaderboardTable({
  data,
  loading,
  onPageChange,
  onSelectCandidate,
}: Props) {
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
    start = Math.max(1, total_pages - 4);
  } else {
    start = page - 2;
  }
  for (let i = 0; i < windowSize; i++) pageNumbers.push(start + i);

  return (
    <div className="space-y-3">
      {/* Candidate Cards List */}
      <div className="space-y-2.5">
        {students.length === 0 ? (
          <div className="text-center py-12 rounded-3xl bg-[#090f1d]/60 border border-slate-800 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-500 opacity-60" />
            <p className="text-sm font-semibold text-white">No candidates found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your specialty filter or search query.
            </p>
          </div>
        ) : (
          students.map((entry) => (
            <LeaderboardRow
              key={entry.student_id}
              entry={entry}
              onSelectCandidate={onSelectCandidate}
            />
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {total_pages > 1 && (
        <div className="px-4 py-3.5 rounded-2xl bg-[#090f1d]/80 border border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-semibold text-white">
              {(page - 1) * per_page + 1}–
              {Math.min(page * per_page, total_students)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-white">
              {fmt(total_students)}
            </span>{" "}
            candidates
          </p>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Prev */}
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-transparent hover:border-slate-700"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page buttons */}
            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-7 h-7 px-2 rounded-xl text-xs font-bold transition-all ${
                  p === page
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/25"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent hover:border-slate-700"
                }`}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === total_pages || loading}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-transparent hover:border-slate-700"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
