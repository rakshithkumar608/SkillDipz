import Link from "next/link";

export const metadata = { title: "Terms of Service | SkillDipz" };

/**
 * ⚠️ LEGAL REVIEW REQUIRED.
 * No Terms of Service existed in this codebase before this compliance pass —
 * this file is a minimal skeleton so section 9 ("Data Protection") has
 * somewhere to live. Sections 1-8 are placeholders only; a lawyer needs to
 * write the actual commercial/liability/IP terms. Do not launch on this copy.
 */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            DRAFT — pending legal review — sections 1-8 not yet written
          </div>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-neutral-500 text-sm mt-2">Last updated: [DATE — set on legal sign-off]</p>
        </div>

        <section className="space-y-2 text-neutral-500 text-sm italic">
          <p>1. Acceptance of terms — [LEGAL: to be drafted]</p>
          <p>2. Eligibility &amp; account registration — [LEGAL: to be drafted]</p>
          <p>3. Acceptable use — [LEGAL: to be drafted]</p>
          <p>4. Company/recruiter obligations — [LEGAL: to be drafted]</p>
          <p>5. Intellectual property — [LEGAL: to be drafted]</p>
          <p>6. Disclaimers &amp; limitation of liability — [LEGAL: to be drafted]</p>
          <p>7. Termination — [LEGAL: to be drafted]</p>
          <p>8. Governing law &amp; dispute resolution — [LEGAL: to be drafted]</p>
        </section>

        <section className="space-y-3 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold">9. Data Protection</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">
            9.1. We process your personal data in accordance with the Digital
            Personal Data Protection Act, 2023 and our{" "}
            <Link href="/legal/privacy" className="text-violet-400 hover:underline">
              Privacy Notice
            </Link>
            , which forms part of these Terms.
          </p>
          <p className="text-neutral-300 text-sm leading-relaxed">
            9.2. Where you provide personal data belonging to someone else
            (for example, a reference's contact details), you confirm you
            are authorised to share it with us for the purposes described in
            the Privacy Notice.
          </p>
          <p className="text-neutral-300 text-sm leading-relaxed">
            9.3. Company/recruiter accounts accessing student data through
            the platform agree to use it only for genuine recruitment
            purposes, not to retain it longer than necessary, and not to
            redistribute it to third parties without the student's consent.
          </p>
          <p className="text-neutral-300 text-sm leading-relaxed">
            9.4. You may exercise your data protection rights (access,
            correction, erasure, withdrawal of consent) at any time via our{" "}
            <Link href="/legal/data-rights" className="text-violet-400 hover:underline">
              Data Rights Request form
            </Link>
            . [LEGAL: this whole clause needs review — placeholder language.]
          </p>
        </section>
      </div>
    </main>
  );
}
