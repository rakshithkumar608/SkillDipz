"use client";

import { fetchSkillGap, SkillGapData } from "@/lib/skillGap";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { CheckCircle2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function getPriorityLabel(gap: number): { text: string; color: string } {
  if (gap >= 3)
    return {
      text: "HIGH PRIORITY",
      color: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    };
  if (gap >= 2)
    return {
      text: "MEDIUM",
      color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    };
  return {
    text: "LOW",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-800/60 rounded-xl animate-pulse $ {className}`} />
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#0b0f19]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-2xl transition-all duration-200 hover:border-slate-700/60 ${className}`}
    >
      {children}
    </div>
  );
}

export default function SkillGapPage() {
  const { user } = useAuthStore();
  const { score } = useDashboardStore();

  const [data, setData] = useState<SkillGapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchSkillGap();
        setData(result);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to load skill gap data";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto space-y-6 text-slate-200">
      <div className="pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Search className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              In-Demand Skill Gaps
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">
              Platform autometically matches your highlights to industry role
              standards.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Acquired Stacks
            </h2>
          </div>
          {isLoading ? (
            <div className="flex flex-wrap gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-28" />
              ))}
            </div>
          ) : data && data.acquired_skills.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {data.acquired_skills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-3">
              {data?.role === "No target role set"
                ? "Set your target role in your profile to see acquired skills."
                : "No acquired skills matched yet. Complete assessments to build your profile."}
            </p>
          )}
        </Card>

        {/* Right : Remaining Gaps */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-sm shadow-rose-400/50" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Remaining Gaps
            </h2>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.skill_gaps.length > 0 ? (
            <div className="space-y-2.5">
              {data.skill_gaps.map((gap) => {
                const priority = getPriorityLabel(gap.gap);
                return (
                  <div
                    key={gap.skill}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/60 transition-all"
                  >
                    <span className="text-sm font-semibold text-slate-200">
                      {gap.skill}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full border ${priority.color}`}
                    >
                      {priority.text}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-3">
              {data?.role === "No target role set"
                ? "Set your target role to see remaining skill gaps."
                : "No skill gaps found — you match all required skills!"}
            </p>
          )}
        </Card>
      </div>

      {/* Bottom: Curriculm Placement Fit */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* score Gauge */}
          <div className="shrink-0">
            {isLoading ? (
              <Skeleton className="w-24 h-24 rounded-full" />
            ) : (
              <div className="relative w-24 h-24">
                <svg className="-rotate-90 w-24 h-24" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="8"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${((data?.overall_match_pct ?? 0) / 100) * 251.3} 251.3`}
                    style={{ transition: "stroke-dasharray 0.8s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-emerald-400">
                    {data?.overall_match_pct ?? 0}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Label text */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Curriculum Placement Fit: {data?.role ?? "Loading..."}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Your overall match rating reflects acquired skills combined with
              the average of completed test checks. Match 75% or higher to
              guarantee standard automated matching to active partners.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
