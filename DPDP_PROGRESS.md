# DPDP Act, 2023 Compliance — Progress Log

Branch: `compliance/dpdp` (not pushed). Repo: SkillDipz
(FastAPI + Beanie/MongoDB backend, Next.js 16 frontend).

This is engineering scaffolding, not a compliance certification. Nothing
here has been reviewed by a lawyer. Treat every "DONE" below as "built and
wired up," not "legally sufficient."

---

## 1. Audit — personal data collection points

**User account** (`backend/app/models/user.py`): email, password hash,
full name, avatar URL, Google ID, college, phone (students); company
name, industry (companies).

**StudentProfile** (`backend/app/models/student_profile.py`): name,
email, phone, college, branch, grad year, avatar file, **resume file**,
GitHub/LinkedIn/Codeforces handles, target roles/company, skills list,
resume parse summary.

**Sessions** (`backend/app/core/redis_client.py`): IP address and
user-agent are captured on every login (`create_session(...)`) and were,
before this pass, undisclosed anywhere. Now covered generically in the
draft Privacy Notice.

**Activity/behavioral data**: `ActivityLog`, `AssessmentResult`,
`InterviewSession`, `JobApplication`, arena/quiz play data — all tied to
`student_id`.

**Uploaded files on disk**: `backend/uploads/{photos,resumes,project_specs}`
— not in the database at all, served via a static-ish download route.

## 2. Audit — third parties / processors

| Service | What it touches |
|---|---|
| Google OAuth (`@react-oauth/google`) | Login — email, name, Google ID |
| Groq (LLM API) | Role/skill benchmark generation — only role names sent, confirmed no PII/resume text in the prompt as of this audit; re-check if this feature changes |
| Gmail SMTP | OTP/verification emails — email address, name, OTP code |
| MongoDB | Primary datastore (host TBD from `.env`, not committed) |
| Redis (comment references Upstash) | Sessions, OTPs, rate-limit counters |
| Vercel | Frontend hosting (`allow_origin_regex` in CORS targets `*.vercel.app`) |

**No analytics/ad/tracking scripts found anywhere in the frontend** —
grepped for GA, gtag, Meta Pixel, Hotjar, Mixpanel, Amplitude, Segment,
PostHog, Clarity: zero hits. No cookies beyond the essential session
cookies and the `sd_role` routing cookie. This means the consent banner
built below currently has nothing real to gate — see item 4.

## 3. What was built

### Backend
- `app/models/consent.py` — `ConsentRecord` (append-only, one row per
  purpose per decision — never overwritten, so `GET /v1/consent/me`
  is a full history, not just current state)
- `app/models/data_rights_request.py` — `DataRightsRequest` intake queue
  (access / correct / erase / withdraw_consent)
- `app/api/routes/consent.py` — `POST /v1/consent`, `GET /v1/consent/me`,
  `POST /v1/consent/withdraw`
- `app/api/routes/data_rights.py` — `POST /v1/data-rights/request`,
  `GET /v1/data-rights/me`
- Both registered in `database.py` (Beanie `document_models`) and
  `main.py` (routers)
- `POST /auth/register` now rejects registration if
  `consent_data_processing` is not `true`, and logs three consent rows
  per signup (account_essential / profile_data_processing /
  marketing_communications)

### Frontend
- `/legal/privacy` — draft Privacy Notice, sections on what/why/
  retention/sharing/rights/grievance officer — every placeholder is
  marked `[LEGAL: ...]` inline
- `/legal/terms` — new file (no Terms existed before this pass); only
  section 9 "Data Protection" has real content, sections 1-8 are
  explicitly marked unwritten
- `/legal/data-rights` — self-service form hitting the new
  `/data-rights/request` endpoint (requires login — see open items)
- `components/common/Footer.tsx` — grievance contact + links to all
  three legal pages, added to root layout (site-wide)
- `components/common/ConsentCheckbox.tsx` — reusable, always unticked
  by default, one purpose per checkbox
- Register form (`(auth)/register/page.tsx`): two checkboxes
  (data-processing = required, marketing = optional), submit button
  disabled until required box is checked, payload now includes both
  flags
- `ResumeUploader.tsx`: added a required, unticked consent checkbox
  specific to resume storage/parsing before the drop-zone is enabled;
  logs a `resume_parsing` consent row on successful upload (best-effort,
  won't block upload if the log call fails)
- `lib/trackerConsent.ts` + `components/common/TrackerConsentBanner.tsx`
  — banner + localStorage-backed consent flag, added site-wide. Since
  there's nothing to gate yet (see audit above), this is an enforcement
  point for the next tracker someone adds, not a fix for anything
  currently broken.

### Docs
- `BREACH_RUNBOOK.md` — containment steps, Board notice template (72h
  target), user notice email template, post-incident steps, and a
  section listing this codebase's actual current gaps (no intrusion
  detection, no bulk export/delete job, `COOKIE_SECURE` default).

## 4. Security gaps flagged (not fixed — flagging only, per scope)

- **`COOKIE_SECURE = False`** is the hardcoded default for both the
  student (`session_id`) and company (`sdz.company.sid`) cookies in
  `backend/app/core/config.py`. Comment says "set True in production via
  .env" — nothing in the repo enforces that it actually is. If the
  deployed `.env` doesn't override this, session cookies can be sent over
  plain HTTP.
- **No CAPTCHA anywhere** — register, login, and OTP-resend endpoints
  have no bot/abuse protection. Combined with the OTP flow, this is a
  credential-stuffing / OTP-spam surface.
- **`check_password_strength()` exists but is never called.** The
  `/auth/register` route only enforces an inline `len(password) < 8`
  check; the real strength function (10-char minimum + common-password
  blocklist) in `app/core/security.py` is dead code.
- **Redis fails open on rate limiting and token blacklisting.**
  `connect_redis()` catches connection errors, logs a warning, and sets
  the client to `None` — the comment says outright "Rate limiting & token
  blacklisting disabled." A Redis outage silently removes those defenses
  instead of blocking traffic or failing loudly.
- **No HTTPS redirect / HSTS middleware** in `main.py`. TLS termination
  may happen at a reverse proxy/hosting layer outside this repo, but
  nothing here verifies or enforces it — this needs the actual deployment
  config to confirm.
- **IP address + user-agent are stored** on every session
  (`create_session` in `redis_client.py`) without ever being disclosed —
  now covered by the draft Privacy Notice, but confirm retention/deletion
  once Redis TTL policy for sessions is finalized.

None of the above were fixed in this pass — task scope was audit +
compliance scaffolding, not a security hardening pass. Recommend a
follow-up ticket.

## 5. Needs lawyer review before anything here goes live

- Every `[LEGAL: ...]` marker in `/legal/privacy` and `/legal/terms`
  (retention periods, entity name/registration number, cross-border
  transfer language, whether SkillDipz is a "significant data fiduciary"
  under DPDP)
- The Grievance Officer must be a real, named person — `privacy@skilldipz.com`
  is a placeholder inbox, not a named officer, and DPDP requires the latter
- Response-time SLA for data-rights requests (currently unstated — the
  intake form just says "allow time")
- `BREACH_RUNBOOK.md` notice templates — structural drafts only
- Whether the `account_essential` "consent" purpose is actually consent
  at all under DPDP, or should instead be framed as necessary contractual
  processing that doesn't require consent — affects how the Privacy
  Notice and consent UI describe it

## 6. Open items / not done

- **No fulfilment automation for data-rights requests.** `/data-rights/request`
  only creates a queue row. There is no export job for "access" and no
  cascading-delete job for "erase" — someone has to manually query
  `users`, `student_profiles`, `activity_logs`, `consent_records`, and
  every other collection keyed by `student_id`/`user_id`, plus delete
  files under `backend/uploads/`.
- **Consent withdrawal doesn't actually stop processing.**
  `POST /v1/consent/withdraw` logs the withdrawal but doesn't, for
  example, pull a resume file or remove a profile from recruiter search.
  Wiring withdrawal to real enforcement per purpose is unbuilt.
- **`/legal/data-rights` has no logged-out state handling.** It calls the
  authenticated API directly; an unauthenticated visitor will just get a
  failed request with a generic toast, not a "please log in" redirect.
- **Footer was added globally**, including on dashboard/app-shell pages
  (`student/*`, `company/*`) that have their own layouts — it may clash
  visually with those; worth a design pass rather than assuming it fits.
- **Consent checkboxes were added at two entry points** (registration,
  resume upload) as representative examples per the task, not at every
  possible data-entry surface (e.g. profile edit form for GitHub/LinkedIn/
  target company, company registration's GSTIN/CIN fields). Confirm
  which additional fields need their own purpose-specific consent.
- **Company registration flow** reuses the same `consent_data_processing`
  checkbox/copy as student registration — the label text branches on tab
  but the underlying purpose list doesn't distinguish company-specific
  processing (e.g. GSTIN/CIN verification). Worth a dedicated purpose if
  legal wants that distinction.
- Nothing in this pass touches data localization/cross-border transfer —
  unresolved because the DB/hosting region isn't visible from the repo.
