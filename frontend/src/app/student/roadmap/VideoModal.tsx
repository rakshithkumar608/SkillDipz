"use client";

import { YoutubeVideo, markVideoWatched } from "@/lib/roadmap";
import { X, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { FaYoutube } from "react-icons/fa";

interface VideoModalProps {
  video: YoutubeVideo | null;
  skill: string | null;
  onClose: () => void;
  onVideoCompleted?: (youtubeId: string) => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
  interface YTPlayer {
    getCurrentTime: () => number;
    getDuration: () => number;
    destroy: () => void;
  }
}

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "yt-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });
}

export function VideoModal({ video, skill, onClose, onVideoCompleted }: VideoModalProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  const handleCompleted = useCallback(async () => {
    if (markedRef.current || !video || !skill) return;
    markedRef.current = true;
    try {
      await markVideoWatched(skill, video.youtube_id);
      onVideoCompleted?.(video.youtube_id);
    } catch (e) {
      console.error("Failed to mark video watched", e);
    }
  }, [video, skill, onVideoCompleted]);

  useEffect(() => {
    if (!video || !containerRef.current) return;
    markedRef.current = false;

    let destroyed = false;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: video.youtube_id,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            // ENDED (0) → mark complete immediately
            if (e.data === 0) {
              handleCompleted();
              return;
            }
            // Also mark complete if 90%+ watched when player pauses/ends
            if (e.data === 2 || e.data === 0) {
              const dur = e.target.getDuration();
              const cur = e.target.getCurrentTime();
              if (dur > 0 && cur / dur >= 0.9) handleCompleted();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [video, handleCompleted]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div
        className="relative w-full sm:max-w-3xl z-10 rounded-t-2xl sm:rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3 border-b border-white/10">
          <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center">
            <FaYoutube className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug">
              {video.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500">{video.channel}</p>
              {video.duration_label && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-400">
                  {video.duration_label}
                </span>
              )}
              {video.watched && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Watched
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            id="video-modal-close"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player */}
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-white/5 text-center">
          <p className="text-[11px] text-slate-600">
            Watch 90%+ of the video to automatically mark it as complete ✓
          </p>
        </div>
      </div>
    </div>
  );
}
