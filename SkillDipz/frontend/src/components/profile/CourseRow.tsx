import { ProfileData } from "@/lib/profile";
import { Badge } from "./ProfileUI";

const SOURCE_META: Record<string, { label: string; color: string }> = {
  marketplace: { label: "Marketplace", color: "violet" },
  company:     { label: "Company",     color: "sky" },
  youtube:     { label: "YouTube",     color: "rose" },
};

export function CourseRow({
  course,
}: {
  course: ProfileData["enrolled_courses"][0];
}) {
  const meta = SOURCE_META[course.source] ?? { label: course.source, color: "sky" };
  return (
    <div
      className="flex items-center gap-4 p-3.5 bg-slate-900/40 border border-slate-800/40
        rounded-xl hover:border-slate-700/60 transition-all"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200 truncate">
          {course.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge color={meta.color}>{meta.label}</Badge>
          <span className="text-xs text-slate-500">
            {course.progress_pct}% complete
          </span>
        </div>
      </div>
      <div className="w-16 bg-slate-800/60 rounded-full h-1.5 flex-shrink-0">
        <div
          className="h-1.5 rounded-full bg-sky-400 transition-all duration-700"
          style={{ width: `${course.progress_pct}%` }}
        />
      </div>
    </div>
  );
}