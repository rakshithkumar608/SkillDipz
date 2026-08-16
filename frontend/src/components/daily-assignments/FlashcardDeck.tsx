"use client";

import { Flashcard } from "@/lib/dailyAssignmentsApi";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useState } from "react";

interface FlashcardDeckProps {
  cards: Flashcard[];
  onAllDone: () => void;
}

export function FlashcardDeck({ cards, onAllDone }: FlashcardDeckProps) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const current = cards[idx];

  const next = () => {
    setFlipped(false);
    setTimeout(() => {
      if (idx + 1 >= cards.length) {
        setDone(true);
        onAllDone();
      } else {
        setIdx(idx + 1);
      }
    }, 150);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center py-10 gap-3">
        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        <p className="text-emerald-400 font-semibold text-lg">
          All cards reviewed!
        </p>
        <p className="text-slate-400 text-sm">
          Great job recalling these concepts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      {/* Progress Dots */}
      <div className="flex gap-1.5">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i < idx
                ? "bg-teal-400"
                : i === idx
                  ? "bg-teal-300 scale-125"
                  : "bg-slate-700"
            }`}
          />
        ))}
      </div>

      {/* Flip Card */}
      <div
        className="w-full max-w-lg cursor-pointer select-none"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped(!flipped)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "180px",
          }}
        >
          {/* Front Side */}
          <div
            className="absolute inset-0 bg-slate-800/80 border border-slate-700/60 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs text-teal-400 font-medium uppercase tracking-widest mb-3">
              Question
            </p>
            <p className="text-white font-semibold text-lg leading-relaxed">
              {current.front}
            </p>
            <p className="text-slate-500 text-xs mt-4">Tap to reveal answer</p>
          </div>

          {/* Back Side */}
          <div
            className="absolute inset-0 bg-teal-950/40 border border-teal-500/30 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-xs text-teal-400 font-medium uppercase tracking-widest mb-3">
              Answer
            </p>
            <p className="text-slate-100 text-base leading-relaxed">
              {current.back}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {flipped ? (
          <button
            onClick={next}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
          >
            {idx + 1 < cards.length ? "Next Card" : "Complete"}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-all duration-200"
          >
            Reveal Answer
          </button>
        )}
      </div>
      <p className="text-slate-500 text-xs">
        {idx + 1} / {cards.length} cards
      </p>
    </div>
  );
}
