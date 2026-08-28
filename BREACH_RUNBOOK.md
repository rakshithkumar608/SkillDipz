# Data Breach Runbook — SkillDipz

**Status: DRAFT. Legal must review the notice templates and confirm the
72-hour trigger interpretation before this is treated as an approved
procedure.** There is currently no automated breach-detection tooling in
this codebase — this runbook assumes a human (engineer, admin, or a
report from a user/researcher) first notices something is wrong.

---

## 0. What counts as a "personal data breach" here

Any of the following involving SkillDipz systems:
- Unauthorized access to the MongoDB database (users, student_profiles,
  resumes, activity_logs, consent_records, etc.)
- Unauthorized access to uploaded files (`backend/uploads/photos`,
  `/resumes`, `/project_specs`)
- Leaked JWT secret / compromised session store (Redis) allowing account
  takeover at scale
- Accidental public exposure (e.g. a misconfigured S3/cloud bucket, a
  debug endpoint left open, an over-broad CORS/API key leak)
- A third-party processor we use (Google, Groq, our email/SMTP provider,
  our DB/hosting provider) notifying us of a breach affecting our data

## 1. Immediate actions (first hour)

1. **Contain.** Rotate the affected credential immediately:
   - `JWT_SECRET_KEY` → invalidates all existing sessions/tokens
   - Database connection string / password
   - Any exposed third-party API key (`GROQ_API_KEY`, `GOOGLE_CLIENT_SECRET`,
     `SMTP_PASSWORD`, `QUIZ_API_KEY`, `YOUTUBE_API_KEY`)
2. **Preserve evidence.** Do not delete logs, do not restart services
   before capturing what's needed to scope the breach (timestamps, IPs,
   affected record IDs).
3. **Assemble the response team.** [PLACEHOLDER: name the people —
   engineering lead, founder/DPO-equivalent, legal counsel.]
4. **Start the incident log** — a running timeline of what was found, when,
   and what was done, from this moment forward. This is what you'll use
   to fill in the notices below.

## 2. Scope the breach (first 24 hours, target)

Answer, in writing, in the incident log:
- What personal data was involved (which fields — e.g. email+phone only,
  or resumes/full profiles)?
- How many Data Principals (users) are affected? Which roles (students,
  companies, or both)?
- Root cause — how did it happen?
- Is the exposure ongoing or has it been contained?
- Is there evidence of actual access/exfiltration, or only potential
  exposure (e.g. a misconfigured endpoint with no confirmed access logs)?

This determines whether individual user notice is required (DPDP Act
requires notifying the affected Data Principal, not only the Board).

## 3. Regulatory notice — Data Protection Board of India

**Target: within 72 hours of becoming aware of the breach**, per DPDP
Act, 2023 obligations on Data Fiduciaries. [LEGAL: confirm the exact
notification mechanism/portal once the Board's rules are in force, and
confirm whether an initial/preliminary notice followed by a detailed
follow-up is acceptable if full scoping isn't done in 72h — this is
common breach-notification practice but must be confirmed against the
final DPDP Rules.]

### 3a. Board Notice Template (draft)

```
To: [Data Protection Board of India — submission channel TBD]
From: [SkillDipz — registered entity name]
Date: [date]
Subject: Personal Data Breach Notification

1. Nature of the breach: [what happened, in plain terms]
2. Date/time breach occurred: [if known]
3. Date/time breach discovered: [timestamp]
4. Categories and approximate number of Data Principals affected:
   [e.g. ~X student accounts — email, phone, resume file]
5. Categories and approximate volume of personal data records affected:
   [record counts / data fields]
6. Likely consequences of the breach: [e.g. risk of phishing, identity
   misuse, unauthorized resume/profile access]
7. Measures taken or proposed to address the breach and mitigate
   possible adverse effects: [containment steps taken, credential
   rotation, patched vulnerability, etc.]
8. Contact point for further information: [Grievance Officer name/email]

[LEGAL: review before this is ever sent — this is a structural draft,
not approved regulatory language.]
```

## 4. User Notice

Notify affected Data Principals **without undue delay** once the breach
is confirmed and scoped enough to say something accurate. [LEGAL: confirm
whether DPDP mandates a specific deadline for user notice, or only "as
may be prescribed" — currently unresolved at draft time.]

### 4a. User Notice Template (draft — email)

```
Subject: Important: A security incident affecting your SkillDipz account

Hi [name],

We're writing to let you know about a security incident that affected
some of your personal data on SkillDipz.

What happened: [plain-language description]
When: [date/window]
What data was involved: [be specific — e.g. "your name, email, and
resume file" — do not minimize or vaguely say "some data"]
What we've done: [containment + fix, e.g. "we rotated the affected
credentials and patched the vulnerability on [date]"]
What we recommend you do: [e.g. "reset your password", "watch for
phishing emails referencing your resume", "review your account
sessions at [link]"]

If you have questions, contact our Grievance Officer at
privacy@skilldipz.com. You can also submit a Data Rights Request at
[link to /legal/data-rights].

— The SkillDipz Team
```

## 5. Post-incident

- File a written post-mortem in this repo (`/docs/incidents/` — folder
  does not exist yet, create on first use) covering root cause, timeline,
  what was notified to whom and when, and remediation follow-ups.
- Update this runbook if any step didn't work as expected.
- Confirm whether affected users' consent/data-rights records need any
  correction as a result of the incident.

## 6. Known gaps in current tooling (as of this compliance pass)

- No automated intrusion/anomaly detection exists in this codebase.
- No pre-built "export all data for user X" or "delete all data for user
  X" job — see `DPDP_PROGRESS.md`. A breach response that requires
  proving exactly what was exposed for a given user will currently
  require manual Mongo queries across many collections
  (`users`, `student_profiles`, `activity_logs`, `consent_records`, etc.).
- `COOKIE_SECURE=False` is the default in `backend/app/core/config.py`
  unless overridden by environment variable in production — verify this
  is actually set `True` in the deployed `.env` as part of any breach
  root-cause review touching session/cookie security.
