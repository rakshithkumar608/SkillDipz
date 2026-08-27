"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface MediaRecorderHookResult {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  formattedDuration: string;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  mimeType: string;
  error: string | null;
  startRecording: (stream: MediaStream) => boolean;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  resetRecording: () => void;
  hasRecorded: boolean;
}

export function useMediaRecorder(): MediaRecorderHookResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("video/webm");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback((stream: MediaStream): boolean => {
    setError(null);
    if (typeof window === "undefined" || !window.MediaRecorder) {
      setError("MediaRecorder is not supported in this browser.");
      return false;
    }

    if (!stream || !stream.active) {
      setError("Cannot record: MediaStream is inactive or empty.");
      return false;
    }

    try {
      chunksRef.current = [];
      const supportedMimes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const selectedMime =
        supportedMimes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (evt: any) => {
        console.error("MediaRecorder runtime error:", evt);
        setError("Recording interrupted due to media error.");
      };

      recorder.start(1000); // chunk every 1000ms
      mediaRecorderRef.current = recorder;
      setMimeType(recorder.mimeType || "video/webm");
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      setRecordedBlob(null);

      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(null);
      }

      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (err: any) {
      console.error("Failed to start MediaRecorder:", err);
      setError(err?.message || "Failed to start MediaRecorder");
      return false;
    }
  }, [recordedUrl]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
      clearTimer();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      clearTimer();
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        setIsPaused(false);
        resolve(recordedBlob);
        return;
      }

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (e) {
        console.error("Error stopping recorder:", e);
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
      }
    });
  }, [recordedBlob]);

  const resetRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    setError(null);
  }, [recordedUrl]);

  // Clean up timer and recorder on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  return {
    isRecording,
    isPaused,
    recordingDuration,
    formattedDuration: formatDuration(recordingDuration),
    recordedBlob,
    recordedUrl,
    mimeType,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    hasRecorded: recordedBlob !== null,
  };
}
