"use client";

import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

const REQUEST_TYPES = [
  { value: "access", label: "Access — send me a copy of my data" },
  { value: "correct", label: "Correct — fix inaccurate/incomplete data" },
  { value: "erase", label: "Erase — delete my data" },
  { value: "withdraw_consent", label: "Withdraw consent for a specific purpose" },
] as const;

export default function DataRightsRequestPage() {
  const [requestType, setRequestType] = useState<typeof REQUEST_TYPES[number]["value"]>("access");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/data-rights/request", { request_type: requestType, details });
      setSubmitted(true);
      toast.success("Request submitted. Our grievance team will follow up by email.");
    } catch {
      toast.error("Couldn't submit your request. Please try again or email privacy@skilldipz.com directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Data Rights Request</h1>
        <p className="text-neutral-400 text-sm mb-8">
          Use this form to access, correct, or erase your personal data, or to
          withdraw consent you previously gave. You must be logged in — we
          verify requests against your account to prevent someone else from
          requesting your data.
        </p>

        {submitted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4 text-emerald-400 text-sm">
            Request received. This is handled manually by our team right now,
            so please allow time for a response — we'll email you at your
            account address.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">What would you like to do?</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as typeof requestType)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-violet-500"
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-zinc-900">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Details (optional — e.g. which field to correct, or which consent to withdraw)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                placeholder="Optional context for our team"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-all disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>

            <p className="text-neutral-500 text-xs">
              Prefer email? Write to{" "}
              <a href="mailto:privacy@skilldipz.com" className="text-violet-400 hover:underline">
                privacy@skilldipz.com
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
