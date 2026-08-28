"use client";

/**
 * DPDP Act + good practice: no non-essential tracker (analytics, ads,
 * heatmaps, etc.) should load before the user has explicitly opted in.
 *
 * AUDIT NOTE: as of this compliance pass, grep across the frontend found
 * NO third-party analytics/tracking scripts (no GA, no Meta Pixel, no
 * Hotjar/Mixpanel/PostHog/Clarity, etc.) and no cookies beyond the
 * essential session cookies (`session_id`, `sdz.company.sid`) and the
 * `sd_role` cookie used for route protection — all of which are strictly
 * necessary and don't need consent under DPDP.
 *
 * So there is currently nothing for this banner to gate. It's shipped
 * anyway so that the FIRST non-essential script anyone adds has an
 * enforcement point to plug into, instead of quietly shipping without one.
 * Before adding any analytics/marketing script, wrap its load with
 * `hasTrackerConsent()` — do not just drop a <script> tag in layout.tsx.
 */

const STORAGE_KEY = "sdz_tracker_consent";

export type TrackerConsentValue = "granted" | "denied" | null;

export function getTrackerConsent(): TrackerConsentValue {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "granted" || v === "denied" ? v : null;
}

export function setTrackerConsent(value: "granted" | "denied") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

export function hasTrackerConsent(): boolean {
  return getTrackerConsent() === "granted";
}
