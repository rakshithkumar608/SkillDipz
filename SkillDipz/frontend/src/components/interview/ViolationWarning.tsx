"use client";

import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ViolationWarningProps {
    message: string;
    tabSwitchCount: number;
    tabSwitchLimit: number;
    fullscreenExitCount: number;
    fullscreenExitLimit: number;
    onDismiss: () => void;
}

export default function ViolationWarning({
  message,
  tabSwitchCount,
  tabSwitchLimit,
  fullscreenExitCount,
  fullscreenExitLimit,
  onDismiss,
}: ViolationWarningProps) {
   return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-9999 w-full max-w-md"
    >
      <div className="mx-4 bg-red-950/95 border-2 border-red-500/60 rounded-2xl p-4 backdrop-blur-xl shadow-2xl shadow-red-900/50">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-500/20 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-300">⚠️ Proctoring Violation Warning</p>
            <p className="text-xs text-red-400/90 mt-1">{message}</p>
            <div className="flex gap-4 mt-2 font-mono">
              <div className="text-xs">
                <span className="text-red-400/60">Tab Switches: </span>
                <span className={`font-bold ${tabSwitchCount >= tabSwitchLimit - 1 ? "text-red-300" : "text-red-400"}`}>
                  {tabSwitchCount}/{tabSwitchLimit}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-red-400/60">Fullscreen Exits: </span>
                <span className={`font-bold ${fullscreenExitCount >= fullscreenExitLimit - 1 ? "text-red-300" : "text-red-400"}`}>
                  {fullscreenExitCount}/{fullscreenExitLimit}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onDismiss} className="p-1 rounded-lg text-red-400/60 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}