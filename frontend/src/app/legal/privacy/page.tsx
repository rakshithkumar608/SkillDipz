import Link from "next/link";

export const metadata = { title: "Privacy Notice | SkillDipz" };

/**
 * ⚠️ LEGAL REVIEW REQUIRED — DRAFT COPY, DO NOT TREAT AS FINAL.
 * This page is a compliance scaffold, not signed-off legal language.
 * Before shipping to production a qualified lawyer must confirm:
 *   - the retention periods below match actual backend TTLs (none are
 *     currently enforced in code — see DPDP_PROGRESS.md)
 *   - the grievance officer name/contact is a real, designated person
 *     (DPDP Act requires a named Grievance Officer, not just an inbox)
 *   - whether any processing here counts as "significant data fiduciary"
 *     activity, which carries extra obligations
 *   - cross-border transfer language, once hosting/DB region is finalized
 */
export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            DRAFT — pending legal review
          </div>
          <h1 className="text-3xl font-bold">Privacy Notice</h1>
          <p className="text-neutral-500 text-sm mt-2">Last updated: [DATE — set on legal sign-off]</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Who we are</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">
            SkillDipz ("we", "us") operates this platform for students and
            recruiting companies. [LEGAL: insert registered entity name,
            address, and CIN/registration number here.]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. What personal data we collect</h2>
          <ul className="list-disc pl-5 text-neutral-300 text-sm space-y-1.5">
            <li>Account details: name, email, phone number, password (stored as a hash, never in plain text)</li>
            <li>Student profile: college, branch, graduation year, target roles/companies, skills</li>
            <li>Files you upload: resume, profile photo</li>
            <li>Linked accounts: GitHub, LinkedIn, Codeforces handles, Google account (if you sign in with Google)</li>
            <li>Company profile: company name, industry, verification details</li>
            <li>Activity data: assessment/quiz results, project submissions, interview sessions, login sessions (including IP address and browser/device information)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Why we process it (purpose)</h2>
          <ul className="list-disc pl-5 text-neutral-300 text-sm space-y-1.5">
            <li>To create and secure your account, and prevent fraud</li>
            <li>To compute your employability score and generate learning roadmaps</li>
            <li>To show your profile to recruiting companies (students) or to let you search/shortlist candidates (companies), where you've enabled visibility</li>
            <li>To send account, verification, and (if you opted in) marketing emails</li>
            <li>To generate AI-assisted skill benchmarks and roadmaps — role/skill queries are sent to our AI provider (Groq); we do not currently send your resume text or personal identifiers to this provider. [LEGAL: confirm this stays true as features change.]</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Retention</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">
            [LEGAL/ENGINEERING: retention periods are not yet finalized or
            enforced in the database. Placeholder policy below — must be
            confirmed and implemented before this notice is final.]
          </p>
          <ul className="list-disc pl-5 text-neutral-300 text-sm space-y-1.5">
            <li>Account &amp; profile data: retained while your account is active, plus [X] days after deletion for fraud/legal purposes</li>
            <li>Resume &amp; uploaded files: retained until you delete them or close your account</li>
            <li>Session/login logs (IP, device): [X] days</li>
            <li>Consent &amp; data-rights request records: retained as a compliance audit trail</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Who we share it with</h2>
          <ul className="list-disc pl-5 text-neutral-300 text-sm space-y-1.5">
            <li>Recruiting companies on the platform — only the profile fields you've made visible</li>
            <li>Service providers acting on our behalf: Google (sign-in), Gmail/SMTP (transactional email), Groq (AI roadmap generation), our cloud database and hosting providers</li>
            <li>Law enforcement or regulators, where legally required</li>
          </ul>
          <p className="text-neutral-500 text-xs">We do not sell personal data.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Your rights</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">
            Under the Digital Personal Data Protection Act, 2023, you can:
          </p>
          <ul className="list-disc pl-5 text-neutral-300 text-sm space-y-1.5">
            <li><strong>Access</strong> a summary of the personal data we hold about you</li>
            <li><strong>Correct</strong> inaccurate or incomplete data</li>
            <li><strong>Erase</strong> data that is no longer needed for the purpose it was collected for</li>
            <li><strong>Withdraw consent</strong> at any time, as easily as you gave it</li>
          </ul>
          <p className="text-neutral-300 text-sm leading-relaxed">
            Submit a request through our{" "}
            <Link href="/legal/data-rights" className="text-violet-400 hover:underline">
              Data Rights Request form
            </Link>
            . [LEGAL: confirm the response-time commitment to publish here — requests are currently handled manually.]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Grievance Officer</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">
            [LEGAL/COMPLIANCE: the DPDP Act requires a named Grievance
            Officer. Placeholder contact below must be replaced with a real
            name and monitored inbox before launch.]
          </p>
          <p className="text-neutral-300 text-sm">
            Email: <a href="mailto:privacy@skilldipz.com" className="text-violet-400 hover:underline">privacy@skilldipz.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Changes to this notice</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">
            We'll update the date at the top of this page when this notice
            changes, and where the change is material, we'll notify you
            directly before it takes effect.
          </p>
        </section>
      </div>
    </main>
  );
}
