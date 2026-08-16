"use client";

import { logViolation, ViolationResponse } from "@/lib/interviewApi";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

interface ProctoringEngineProps {
  sessionId: string;
  isAI: boolean;
  onTerminated: (reason: string) => void;
  onViolation: (data: ViolationResponse) => void;
  enabled: boolean;
}

const BLOCKED_KEYS = new Set(["F12", "PrintScreen", "PrtSc"]);
const BLOCKED_COMBOS = [
  { ctrl: true, shift: true, key: "I" },
  { ctrl: true, shift: true, key: "J" },
  { ctrl: true, shift: true, key: "C" },
  { ctrl: true, key: "c" },
  { ctrl: true, key: "v" },
  { ctrl: true, key: "x" },
  { ctrl: true, key: "p" },
  { ctrl: true, key: "Tab" },
  { ctrl: true, key: "u" },
  { ctrl: true, key: "s" },
];

export default function ProctoringEngine({
    sessionId,
    isAI,
    onTerminated,
    onViolation,
    enabled,
}: ProctoringEngineProps) {
    const violationQueueRef = useRef<Array<{ type: string; details?: string }>>([]);
    const flushingRef = useRef(false);
    const terminatedRef = useRef(false);

    const flushViolations = useCallback(async () => {
        if (flushingRef.current || violationQueueRef.current.length === 0) return;
        flushingRef.current = true;
        const next = violationQueueRef.current.shift()!;
        try {
      const resp = await logViolation(sessionId, next.type, next.details, isAI);
      onViolation(resp);
      if (resp.session_terminated && !terminatedRef.current) {
        terminatedRef.current = true;
        onTerminated(resp.termination_reason || "Proctoring limit exceeded.");
      }
    } catch {
      violationQueueRef.current.unshift(next);
    } finally {
      flushingRef.current = false;
      if (violationQueueRef.current.length > 0) {
        setTimeout(flushViolations, 400);
      }
    }
  }, [sessionId, isAI, onViolation, onTerminated]);

  const queueViolation = useCallback(
    (type: string, details?: string) => {
      if (!enabled || terminatedRef.current) return;
      violationQueueRef.current.push({ type, details });
      flushViolations();
    },
    [enabled, flushViolations]
  );

  const requestFullScreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, []);

  // 1. Intercept & Block Screen Recording API
  useEffect(() => {
    if (!enabled) return;
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async (options) => {
        queueViolation("screen_recording_attempt", "Attempted navigator.mediaDevices.getDisplayMedia call");
        toast.error("Screen recording software is strictly disabled during proctored sessions.");
        throw new DOMException("Screen capture disabled for proctored exam", "NotAllowedError");
      };
      return () => {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      };
    }
  }, [enabled, queueViolation]);

  // 2. Tab Switch & Window Focus Loss Detection
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.hidden) queueViolation("tab_switch", "visibilitychange: hidden");
    };
    const handleBlur = () => queueViolation("window_blur", "window blur event fired");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, queueViolation]);

  // 3. Fullscreen Exit Enforcement
  useEffect(() => {
    if (!enabled) return;
    const handleFSChange = () => {
      if (!document.fullscreenElement) {
        queueViolation("fullscreen_exit", "Exited full-screen mode");
        toast.warning("⚠️ Fullscreen required! Return to fullscreen immediately.", { id: "fs-warn" });
        setTimeout(() => {
          if (!document.fullscreenElement) requestFullScreen();
        }, 1500);
      }
    };
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, [enabled, queueViolation, requestFullScreen]);

  // 4. Keyboard Lockdown
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (BLOCKED_KEYS.has(e.key)) {
        e.preventDefault();
        queueViolation("keyboard_shortcut", `Blocked key: ${e.key}`);
        return;
      }
      for (const combo of BLOCKED_COMBOS) {
        const ctrlMatch = combo.ctrl ? e.ctrlKey || e.metaKey : true;
        const shiftMatch = combo.shift ? e.shiftKey : !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase();
        if (ctrlMatch && shiftMatch && keyMatch) {
          e.preventDefault();
          queueViolation("keyboard_shortcut", `Blocked combo: Ctrl+${combo.key}`);
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, queueViolation]);

  // 5. Context Menu & Selection Prevention
  useEffect(() => {
    if (!enabled) return;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      queueViolation("context_menu", "Right-click context menu blocked");
    };
    document.addEventListener("contextmenu", handleContextMenu);

    const style = document.createElement("style");
    style.id = "proctor-css-lockdown";
    style.textContent = `
      body * {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      textarea, input[type="text"] {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.getElementById("proctor-css-lockdown")?.remove();
    };
  }, [enabled, queueViolation]);

  // Auto request full screen on mount
  useEffect(() => {
    if (enabled) requestFullScreen();
  }, [enabled, requestFullScreen]);

  return null;

}