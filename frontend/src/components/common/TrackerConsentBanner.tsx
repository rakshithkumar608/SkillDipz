"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTrackerConsent, setTrackerConsent } from "@/lib/trackerConsent";

export default function TrackerConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getTrackerConsent() === null);
  }, []);

  if (!visible) return null;

  const decide = (value: "granted" | "denied") => {
    setTrackerConsent(value);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-zinc-900 border-t border-white/10 px-4 py-4 text-sm text-neutral-300">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="flex-1 text-center sm:text-left">
          We use essential cookies to run your session. We don't currently
          use analytics or advertising cookies — if that changes, we'll ask
          again. See our{" "}
          <Link href="/legal/privacy" className="text-violet-400 hover:underline">
            Privacy Notice
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => decide("denied")}
            className="px-4 py-2 rounded-lg border border-white/15 text-neutral-300 hover:bg-white/5 text-xs font-medium"
          >
            Essential only
          </button>
          <button
            onClick={() => decide("granted")}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
