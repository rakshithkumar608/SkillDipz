"use client";

import { CapstoneItem, RoadmapItem, YoutubeVideo, fetchSkillVideos, isCapstone } from "@/lib/roadmap";
import { Play, BookOpen, ChevronRight, Zap, Target, Clock, Trophy, Lock, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { FaYoutube } from "react-icons/fa";

interface ContentPanelProps {
  item: RoadmapItem | null;
  selectedSkill: string | null;
  capstoneData: CapstoneItem | null;
  onPlayVideo: (video: YoutubeVideo) => void;
  onVideoCompleted?: (youtubeId: string) => void;
}

function CapstonePanel({ data }: { data: CapstoneItem | null }) {
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
        <Trophy className="w-8 h-8 text-emerald-400/50" />
      </div>
      <h2 className="text-lg font-bold text-slate-200 mb-2">{data?.title ?? "Capstone Project"}</h2>
      <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto mb-5">
        {data?.description ?? "Build a complete application integrating all acquired skills."}
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-white/5 text-slate-500 text-sm">
        <Lock className="w-4 h-4" />
        <span>Complete Phase 1 &amp; Phase 2 to unlock</span>
      </div>
    </div>
  );
}

function SkillLevelBar({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-slate-500 whitespace-nowrap">{current}/{required}</span>
    </div>
  );
}

export function ContentPanel({ item, selectedSkill, capstoneData, onPlayVideo, onVideoCompleted }: ContentPanelProps) {
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const loadVideos = useCallback(async (skill: string) => {
    setLoadingVideos(true);
    setVideoError(false);
    try {
      const vids = await fetchSkillVideos(skill);
      setVideos(vids);
    } catch {
      setVideoError(true);
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    if (!item) { setVideos([]); return; }
    if (item.content.youtube.length > 0) {
      setVideos(item.content.youtube);
    } else {
      loadVideos(item.skill);
    }
  }, [item, loadVideos]);

  // Mark video as watched in local state for instant UI feedback
  const handleVideoCompleted = useCallback((youtubeId: string) => {
    setVideos(prev => prev.map(v => v.youtube_id === youtubeId ? { ...v, watched: true } : v));
    onVideoCompleted?.(youtubeId);
  }, [onVideoCompleted]);

  if (selectedSkill === "__capstone__") return <CapstonePanel data={capstoneData} />;

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 text-center px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-slate-400 font-medium">Select a skill</p>
        <p className="text-slate-600 text-sm mt-1">Choose a skill from the timeline to see learning content</p>
      </div>
    );
  }

  const gapColor = item.gap >= 3 ? "text-red-400" : item.gap >= 2 ? "text-amber-400" : "text-emerald-400";
  const gapBg   = item.gap >= 3 ? "bg-red-500/10"  : item.gap >= 2 ? "bg-amber-500/10" : "bg-emerald-500/10";

  return (
    <div className="flex flex-col gap-4">
      {/* Skill header card */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{item.skill}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Est. {item.estimated_weeks} week{item.estimated_weeks !== 1 ? "s" : ""} to complete</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${gapBg} ${gapColor} shrink-0`}>
            Gap: {item.gap}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { icon: Target, color: "text-sky-400",   label: "Current",  value: `${item.current_level}/${item.required_level}` },
            { icon: Zap,    color: gapColor,          label: "Gap",      value: `${item.gap} levels` },
            { icon: Clock,  color: "text-emerald-400",label: "Progress", value: `${item.progress_pct}%` },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium hidden sm:block">{label}</span>
              </div>
              <span className={`text-base sm:text-lg font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
            <span>Skill Level Progress</span>
            <span>{item.current_level} of {item.required_level} required</span>
          </div>
          <SkillLevelBar current={item.current_level} required={item.required_level} />
        </div>
      </div>

      {/* Videos card */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <FaYoutube className="w-3.5 h-3.5 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Free Videos</h3>
          <span className="ml-auto text-[10px] text-slate-600 hidden sm:block">
            YouTube · Full courses for {item.skill}
          </span>
          {videos.filter(v => v.watched).length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {videos.filter(v => v.watched).length}/{videos.length} watched
            </span>
          )}
        </div>

        <div className="p-4">
          {loadingVideos ? (
            <div className="flex items-center justify-center py-10 gap-2.5 text-slate-500">
              <span className="w-5 h-5 rounded-full border-2 border-slate-500 border-t-sky-400 animate-spin" />
              <span className="text-sm">Fetching courses for {item.skill}…</span>
            </div>
          ) : videoError ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Could not load videos right now.</p>
              <button onClick={() => loadVideos(item.skill)} className="mt-2 text-xs text-sky-400 hover:underline">Try again</button>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">No videos found for <strong>{item.skill}</strong>.</p>
              <p className="text-slate-600 text-xs mt-1">YouTube API quota may be exhausted.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {videos.map((video) => (
                <li key={video.youtube_id}>
                  <button
                    id={`play-video-${video.youtube_id}`}
                    onClick={() => onPlayVideo(video)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 group text-left ${
                      video.watched
                        ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                        : "bg-slate-800/50 hover:bg-slate-800 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="relative flex-shrink-0 w-24 sm:w-28 h-14 sm:h-16 rounded-lg overflow-hidden">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                          <FaYoutube className="w-6 h-6 text-slate-500" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-4 h-4 text-slate-900 fill-slate-900 ml-0.5" />
                        </div>
                      </div>
                      {video.watched && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium line-clamp-2 leading-snug ${
                        video.watched ? "text-emerald-300" : "text-slate-200 group-hover:text-white"
                      }`}>
                        {video.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-[11px] text-slate-500 truncate">{video.channel}</p>
                        {video.duration_label && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-400">
                            {video.duration_label}
                          </span>
                        )}
                        {video.watched && (
                          <span className="shrink-0 text-[10px] font-semibold text-emerald-400">✓ Watched</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${
                      video.watched ? "text-emerald-500" : "text-slate-600 group-hover:text-slate-400"
                    }`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
