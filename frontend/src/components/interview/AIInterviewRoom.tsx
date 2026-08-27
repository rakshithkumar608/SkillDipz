"use client";

import { submitAIAnswer, ViolationResponse, uploadInterviewRecording, DetailedRubric } from "@/lib/interviewApi";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ProctoringEngine from "./ProctoringEngine";
import { AnimatePresence, motion } from "framer-motion";
import ViolationWarning from "./ViolationWarning";
import { Bot, Clock, Loader2, Mic, Send, Shield, User, Video } from "lucide-react";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";

const TAB_SWITCH_LIMIT = 3;
const FULLSCREEN_EXIT_LIMIT = 2;

interface AIInterviewRoomProps {
  sessionId: string;
  firstQuestion: string;
  questionNumber: number;
  durationMins: number;
  companyName: string;
  interviewType: string;
  onComplete: (result: {
    overall_score: number;
    feedback: string;
    transcript: string;
    rubric?: DetailedRubric;
    recordingUrl?: string;
    recordedBlob?: Blob;
  }) => void;
  onTerminated: (reason: string) => void;
}

export default function AIInterviewRoom({
  sessionId,
  firstQuestion,
  questionNumber: initialQNum,
  durationMins,
  companyName,
  interviewType,
  onComplete,
  onTerminated,
}: AIInterviewRoomProps) {
  const [messages, setMessages] = useState<
    { role: "ai" | "user"; content: string }[]
  >([{ role: "ai", content: firstQuestion }]);

  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [questionNum, setQuestionNum] = useState(initialQNum);
  const [secondsLeft, setSecondsLeft] = useState(durationMins * 60);
  const [webcamOn, setWebcamOn] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [violationMessage, setViolationMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const {
    isRecording,
    recordingDuration,
    formattedDuration: recDuration,
    startRecording,
    stopRecording,
  } = useMediaRecorder();

  // Speech-to-Text Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeechToText = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Webcam & Audio Init + Start Recording
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        // Auto-start recording
        startRecording(stream);
      })
      .catch(() => {
        toast.error("Webcam and microphone access required for proctored mode.");
        setWebcamOn(false);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startRecording]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleViolation = useCallback((data: ViolationResponse) => {
    setTabSwitchCount(data.tab_switch_count);
    setFullscreenExitCount(data.fullscreen_exit_count);
    let msg = "";
    if (data.tab_switch_count > 0) {
      msg = `Tab switch detected! Violation ${data.tab_switch_count}/${TAB_SWITCH_LIMIT}.`;
    } else if (data.fullscreen_exit_count > 0) {
      msg = `Fullscreen exit detected! Violation ${data.fullscreen_exit_count}/${FULLSCREEN_EXIT_LIMIT}.`;
    }
    if (msg) setViolationMessage(msg);
  }, []);

  const handleSubmit = useCallback(
    async (isTimeout = false) => {
      const text = isTimeout ? "(Time expired)" : answer.trim();
      if (!text && !isTimeout) return;
      setSending(true);
      setAnswer("");
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      setMessages((prev) => [...prev, { role: "user", content: text }]);

      try {
        const resp = await submitAIAnswer(sessionId, text);
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: resp.ai_message },
        ]);
        setQuestionNum(resp.question_number);

        if (resp.interview_complete) {
          // Stop recording & camera tracks
          const blob = await stopRecording();
          streamRef.current?.getTracks().forEach((t) => t.stop());

          let uploadedUrl = "";
          if (blob) {
            try {
              const recRes = await uploadInterviewRecording(sessionId, blob, recordingDuration);
              uploadedUrl = recRes.recording_url;
              toast.success("Interview session recording securely uploaded and saved.");
            } catch (recErr) {
              console.warn("Could not upload recording:", recErr);
              toast.error("Failed to upload session recording to storage.");
            }
          }

          onComplete({
            overall_score: resp.overall_score ?? 76,
            feedback: resp.feedback ?? "Completed practice session.",
            transcript: resp.transcript ?? "",
            rubric: resp.rubric,
            recordingUrl: uploadedUrl,
            recordedBlob: blob || undefined,
          });
        }
      } catch {
        toast.error("Failed to transmit response.");
      } finally {
        setSending(false);
      }
    },
    [answer, sessionId, isListening, onComplete, stopRecording],
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      <ProctoringEngine
        sessionId={sessionId}
        isAI={true}
        onTerminated={(reason) => {
          stopRecording();
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
            tabSwitchLimit={TAB_SWITCH_LIMIT}
            fullscreenExitCount={fullscreenExitCount}
            fullscreenExitLimit={FULLSCREEN_EXIT_LIMIT}
            onDismiss={() => setViolationMessage(null)}
          />
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/90 border-b border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {companyName} AI Mock Interview
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {interviewType} • Question {questionNum}/7
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Recording Badge */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>REC {recDuration}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">
              PROCTORED
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-emerald-400">
            <Clock className="w-4 h-4" />
            {formatTime(secondsLeft)}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat / Turn-Taking Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "ai" ? "bg-violet-500/20 text-violet-400" : "bg-sky-500/20 text-sky-400"}`}
                >
                  {m.role === "ai" ? (
                    <Bot className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === "ai" ? "bg-slate-900 border border-white/10 text-slate-200" : "bg-sky-600/20 border border-sky-500/30 text-sky-100"}`}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> AI evaluating your response…
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-white/10 bg-slate-900/60 backdrop-blur-xl">
            <div className="flex gap-3 items-center">
              <button
                onClick={toggleSpeechToText}
                className={`p-3 rounded-xl border transition-all ${isListening ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" : "bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700"}`}
                title="Speech to Text"
              >
                <Mic className="w-5 h-5" />
              </button>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type or speak your answer..."
                rows={2}
                className="flex-1 bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-sky-500/50 resize-none"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={sending || !answer.trim()}
                className="p-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-40"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar — Camera & Proctoring Limits */}
        <div className="w-72 border-l border-white/10 bg-slate-900/80 p-4 flex flex-col items-center gap-4">
          <div className="w-full aspect-video rounded-xl bg-slate-950 border border-white/10 overflow-hidden relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
              LIVE CAMERA
            </div>
          </div>

          <div className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Proctoring Status
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Tab Switch Count</span>
              <span className="font-bold text-amber-400">
                {tabSwitchCount}/{TAB_SWITCH_LIMIT}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Fullscreen Exit</span>
              <span className="font-bold text-red-400">
                {fullscreenExitCount}/{FULLSCREEN_EXIT_LIMIT}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
