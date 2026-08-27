"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Play,
  Pause,
  Square,
  RotateCcw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Camera,
  Film,
  Volume2,
  Sparkles,
} from "lucide-react";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { uploadInterviewRecording } from "@/lib/interviewApi";
import { toast } from "sonner";

interface InterviewVideoRecorderProps {
  sessionId: string;
  autoStart?: boolean;
  onRecordingSaved?: (data: {
    recordingUrl: string;
    duration: number;
    fileSize: number;
    recordedAt: string;
  }) => void;
  className?: string;
}

type PermissionStatus = "checking" | "prompt" | "granted" | "denied" | "unavailable";

export default function InterviewVideoRecorder({
  sessionId,
  autoStart = false,
  onRecordingSaved,
  className = "",
}: InterviewVideoRecorderProps) {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const {
    isRecording,
    isPaused,
    recordingDuration,
    formattedDuration,
    recordedBlob,
    recordedUrl,
    mimeType,
    error: recorderError,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    hasRecorded,
  } = useMediaRecorder();

  // Helper: Stop all MediaStream tracks and clean up audio context
  const cleanupMedia = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping track:", e);
        }
      });
      setStream(null);
    }
  }, [stream]);

  // Audio level visualizer monitor
  const startAudioMonitor = (activeStream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(activeStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn("Audio meter initialization skipped:", e);
    }
  };

  // Request Camera & Microphone via getUserMedia
  const initMediaStream = useCallback(async () => {
    setErrorMessage(null);
    setPermissionStatus("checking");

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionStatus("unavailable");
      setErrorMessage("Your browser does not support video & audio recording (getUserMedia API missing).");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setStream(mediaStream);
      setPermissionStatus("granted");

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = mediaStream;
      }

      startAudioMonitor(mediaStream);

      if (autoStart) {
        startRecording(mediaStream);
      }
    } catch (err: any) {
      console.error("getUserMedia error:", err);
      const name = err.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermissionStatus("denied");
        setErrorMessage("Camera & microphone permissions were denied. Please allow camera and mic in your browser address bar.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setPermissionStatus("unavailable");
        setErrorMessage("No camera or microphone hardware was detected on this device.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setPermissionStatus("unavailable");
        setErrorMessage("Camera or microphone is already in use by another application.");
      } else {
        setPermissionStatus("unavailable");
        setErrorMessage(err.message || "Unable to access camera and microphone.");
      }
    }
  }, [autoStart, startRecording]);

  // Initial load
  useEffect(() => {
    initMediaStream();
    return () => {
      cleanupMedia();
    };
  }, []);

  // Update video element when stream is ready
  useEffect(() => {
    if (stream && previewVideoRef.current && !hasRecorded) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream, hasRecorded]);

  // Toggle Track states
  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !micActive;
      });
      setMicActive(!micActive);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = !cameraActive;
      });
      setCameraActive(!cameraActive);
    }
  };

  // Start Recording Handler
  const handleStart = () => {
    if (!stream || !stream.active) {
      initMediaStream().then(() => {
        if (stream) startRecording(stream);
      });
      return;
    }
    const success = startRecording(stream);
    if (!success) {
      toast.error("Failed to start recording.");
    }
  };

  // Stop Recording Handler
  const handleStop = async () => {
    const blob = await stopRecording();
    if (blob) {
      toast.success("Recording captured! Preview below and submit when ready.");
    }
  };

  // Re-record Handler
  const handleReRecord = () => {
    resetRecording();
    setUploadSuccess(false);
    setSavedUrl(null);
    initMediaStream();
  };

  // Upload Real Recorded Blob to Backend
  const handleUpload = async () => {
    if (!recordedBlob) {
      toast.error("No recorded video found to upload.");
      return;
    }

    try {
      setIsUploading(true);
      const res = await uploadInterviewRecording(sessionId, recordedBlob, recordingDuration);
      setUploadSuccess(true);
      setSavedUrl(res.recording_url);
      toast.success("Recording saved and attached to interview session!");

      if (onRecordingSaved) {
        onRecordingSaved({
          recordingUrl: res.recording_url,
          duration: recordingDuration,
          fileSize: recordedBlob.size,
          recordedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("Upload recording failed:", err);
      toast.error(err?.response?.data?.detail || "Failed to upload recording to server.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Video Container Viewport */}
      <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
        {/* State 1: Permission Prompt / Checking / Denied */}
        {permissionStatus !== "granted" && !hasRecorded && (
          <div className="p-6 text-center space-y-4 max-w-md">
            {permissionStatus === "checking" ? (
              <>
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-300">Requesting Camera & Microphone access...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Media Permission Required</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {errorMessage || "Please enable camera & microphone permissions in your browser settings to record your mock interview."}
                  </p>
                </div>
                <button
                  onClick={initMediaStream}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Permissions
                </button>
              </>
            )}
          </div>
        )}

        {/* State 2: Live Camera Preview (when not yet stopped/hasRecorded) */}
        {permissionStatus === "granted" && !hasRecorded && (
          <>
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                !cameraActive ? "hidden" : "block"
              }`}
            />

            {!cameraActive && (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <VideoOff className="w-10 h-10" />
                <p className="text-xs">Camera feed is paused</p>
              </div>
            )}

            {/* Top Overlay: Recording Badges + Timer + Audio meter */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2">
                {isRecording && !isPaused && (
                  <div className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>REC {formattedDuration}</span>
                  </div>
                )}

                {isPaused && (
                  <div className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/40">
                    <Pause className="w-3 h-3 fill-current" />
                    <span>PAUSED {formattedDuration}</span>
                  </div>
                )}

                {!isRecording && !isPaused && (
                  <div className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-300 text-[10px] font-semibold border border-slate-700 flex items-center gap-1.5">
                    <Camera className="w-3 h-3 text-indigo-400" />
                    <span>Camera Ready</span>
                  </div>
                )}
              </div>

              {/* Audio Volume Visualizer Meter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700">
                <Volume2 className={`w-3 h-3 ${audioLevel > 5 ? "text-emerald-400" : "text-slate-500"}`} />
                <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* State 3: Recorded Video Playback Preview */}
        {hasRecorded && recordedUrl && (
          <div className="w-full h-full relative group">
            <video
              ref={playbackVideoRef}
              src={recordedUrl}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
            {uploadSuccess && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Recording Saved ({formattedDuration})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Bar & Action Buttons */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl">
        {/* Left: Device Hardware Controls (Mic / Camera Toggle) */}
        {!hasRecorded && permissionStatus === "granted" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                micActive
                  ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
              title={micActive ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micActive ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{micActive ? "Mic On" : "Muted"}</span>
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                cameraActive
                  ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
              title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
            >
              {cameraActive ? <Video className="w-3.5 h-3.5 text-indigo-400" /> : <VideoOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{cameraActive ? "Camera On" : "Camera Off"}</span>
            </button>
          </div>
        )}

        {/* Center/Right: Recording State Actions */}
        {!hasRecorded ? (
          <div className="flex items-center gap-2 ml-auto">
            {!isRecording && !isPaused ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={permissionStatus !== "granted"}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/20 disabled:opacity-40 transition"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span>Start Recording</span>
              </button>
            ) : (
              <>
                {/* Pause / Resume */}
                {isPaused ? (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                {/* Stop */}
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/30 transition"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Recording</span>
                </button>
              </>
            )}
          </div>
        ) : (
          /* Playback & Submit Actions */
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReRecord}
                disabled={isUploading}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-record</span>
              </button>

              <span className="text-[11px] text-slate-400">
                Duration: <strong className="text-slate-200">{formattedDuration}</strong> · Size:{" "}
                <strong className="text-slate-200">
                  {recordedBlob ? `${(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB` : "0 MB"}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!uploadSuccess ? (
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Storage...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Submit Recording</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Recording Stored in Database</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Runtime errors */}
      {recorderError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
          {recorderError}
        </p>
      )}
    </div>
  );
}
