"use client";

import { completeInterview, ViolationResponse } from "@/lib/interviewApi";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ProctoringEngine from "./ProctoringEngine";
import { AnimatePresence } from "framer-motion";
import ViolationWarning from "./ViolationWarning";
import { Building2, PhoneOff, Send, Shield, User } from "lucide-react";

interface CompanyInterviewRoomProps {
  sessionId: string;
  companyName: string;
  interviewerName: string;
  videoCallUrl?: string | null;
  durationMins: number;
  onLeave: () => void;
  onTerminated: (reason: string) => void;
}

export default function CompanyInterviewRoom({
  sessionId,
  companyName,
  interviewerName,
  videoCallUrl,
  durationMins,
  onLeave,
  onTerminated,
}: CompanyInterviewRoomProps) {
  const [webcamOn, setWebcamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [violationMessage, setViolationMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { sender: string; text: string }[]
  >([]);
  const [inputText, setInputText] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() =>
        toast.error("Camera access required for live company interview mode."),
      );

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleViolation = useCallback((data: ViolationResponse) => {
    setTabSwitchCount(data.tab_switch_count);
    setFullscreenExitCount(data.fullscreen_exit_count);
    if (data.tab_switch_count > 0) {
      setViolationMessage(
        `Tab switch violation detected (${data.tab_switch_count}/3).`,
      );
    }
  }, []);

  const handleSendChat = () => {
    if (!inputText.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: "You", text: inputText.trim() },
    ]);
    setInputText("");
  };

  const handleEndInterview = async () => {
    await completeInterview(sessionId);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onLeave();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
         <ProctoringEngine
        sessionId={sessionId}
        isAI={false}
        onTerminated={(reason) => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          onTerminated(reason);
        }}
        onViolation={handleViolation}
        enabled={true}
      />

      <AnimatePresence>
        {violationMessage && (
          <ViolationWarning
            message={violationMessage}
            tabSwitchCount={tabSwitchCount}
            tabSwitchLimit={3}
            fullscreenExitCount={fullscreenExitCount}
            fullscreenExitLimit={2}
            onDismiss={() => setViolationMessage(null)}
          />
        )}
      </AnimatePresence>

      <div className="px-6 py-3 bg-slate-900 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-sky-400"/>
        <div>
             <p className="text-sm font-bold text-white">{companyName} — Live Interview</p>
            <p className="text-xs text-slate-400">Interviewer: {interviewerName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-xs font-bold text-red-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> PROCTORED EXAM MODE
          </div>
          <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
            <PhoneOff className="w-4 h-4" /> Leave Call
          </button>
      </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-black p-4 flex flex-col items-center justify-center relative">
          {videoCallUrl ? (
            <iframe src={videoCallUrl} className="w-full h-full rounded-2xl border border-white/10" allow="camera; microphone; display-capture" />
          ) : (
            <div className="w-full h-full rounded-2xl border border-white/10 bg-slate-900 flex flex-col items-center justify-center gap-4">
              <User className="w-16 h-16 text-slate-600" />
              <p className="text-sm text-slate-400">Connected with {interviewerName}</p>
            </div>
          )}

          <div className="absolute bottom-6 right-6 w-56 aspect-video rounded-xl bg-slate-950 border border-white/20 overflow-hidden shadow-2xl">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          </div>
        </div>

        <div className="w-80 border-l border-white/10 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-white/10 font-bold text-xs text-slate-300">In-Call Live Chat</div>
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="font-bold text-sky-400">{msg.sender}: </span>
                <span className="text-slate-200">{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Message interviewer..."
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
            <button onClick={handleSendChat} className="p-2 bg-sky-500 rounded-xl text-white">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
