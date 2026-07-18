# SkillDipz — Updated Feature & Flow Spec
## Sidebar Navigation · Real-Time Flows · No Mock Data

**Document Version:** 3.0 (Replaces/Extends v2.0)  
**Date:** July 17, 2026  
**Changes in this version:**
- Code Practice + Skill Tests → **MERGED** (Codeforces API + open sets)
- Projects → **Company-assigned** model (companies upload, students submit)
- Video/Learning → **3-source model** (YouTube API + Company Upload + Creator Marketplace)
- All sidebar items fully specced with real data flows

---

## Sidebar Navigation — Full Map

```
Student Sidebar (logged in, role = STUDENT)
│
├── Overview              ← Dashboard / score gauge / summary
├── Skill Gap             ← Gap analysis vs target role
├── Learning Roadmap      ← Week-by-week plan + video content
├── Target Company        ← Company profile + interview rounds
├── My Activity           ← Recent actions, streak, history
├── Jobs Hub              ← Active job listings from companies
├── Notifications         ← All alerts, shortlists, messages
├── Projects              ← Company-assigned projects (submit here)
├── Skill Tests           ← MCQ assessments (merged with Code Practice)
│   └── Code Practice     ← Codeforces / open problem sets (same tab)
├── Mock Interview        ← Webcam AI interview sessions
├── Daily Assignments     ← Platform-assigned daily tasks
├── Leaderboard           ← Peer ranking by score/role
└── My Profile            ← Resume, skills, visibility, certificates
```

---

## 1. Overview (Dashboard)

**Real-Time Data Sources:**

```
GET /students/me/score           → AI Scoring Service → MongoDB (no cache miss allowed)
GET /students/me/roadmap-summary → LMS Service → MongoDB
GET /students/me/notifications   → Notification Service → MongoDB (unread count)
GET /students/me/activity?limit=5 → Activity Service → MongoDB

WebSocket CONNECT /ws/student/{userId}
  → Subscribes to: score_updates, submission_verdicts, notifications
  → All score changes pushed in real-time (no polling)
```

---

## 2. Skill Gap

**Real-Time Data Sources:**

```
GET /students/me/skill-gap?role={primaryRoleId}

→ Profile Service reads:
    StudentSkillLevel (current levels per skill, from assessments + resume parse)
    RoleSkillBenchmark (required levels per skill for role)
    
→ Computes gap on-the-fly:
    gap_per_skill = required_level - current_level
    sorted by largest gap first

→ Each gap item links to:
    - Relevant YouTube video (see Learning Roadmap § Video Source 1)
    - Relevant Codeforces problem set (if skill is coding-related)
    - Relevant course in Creator Marketplace (if available)

Response:
{
  role: "Java Backend Developer",
  required_skills: ["Java","Spring Boot","REST APIs","Git","Docker",...],
  skill_gaps: [
    { skill: "Microservices", current: 1, required: 4, gap: 3, priority: 1 },
    { skill: "Docker", current: 0, required: 3, gap: 3, priority: 2 },
    { skill: "REST APIs", current: 2, required: 4, gap: 2, priority: 3 }
  ]
}
```

---

## 3. Learning Roadmap (DYNAMIC — Resume-Gap-Driven)

**URL:** `/roadmap`

### ⚠️ Key Change: Roadmap is NOT a Fixed Week Plan

```
╔══════════════════════════════════════════════════════════════════╗
║            ROADMAP IS DYNAMICALLY GENERATED                      ║
║                                                                  ║
║  Based on student's resume → NLP extracts skills → compared     ║
║  against target role benchmark → GAPS determine the roadmap     ║
║  order, priority, and content shown.                             ║
║                                                                  ║
║  No two students see the same roadmap.                           ║
╚══════════════════════════════════════════════════════════════════╝
```

### Roadmap Generation Flow

```
TRIGGER: student.role_selected OR resume.parsed event

[LMS Service] consumes event
    │
    ├── READ from [PostgreSQL]:
    │     StudentSkillLevel (current levels — from resume parse + self-assessment)
    │     RoleSkillBenchmark (required levels per skill for target role)
    │
    ├── COMPUTE skill gaps:
    │     For each required skill:
    │       gap = required_level - current_level
    │     Sort by: gap DESC, skill weight DESC
    │
    ├── GENERATE ordered learning plan:
    │     Phase 1 (Priority Skills — largest gaps):
    │       ├── Skill with gap=3: "Microservices" → weeks 1–3
    │       ├── Skill with gap=3: "Docker" → weeks 4–5
    │       └── Skill with gap=2: "REST APIs" → weeks 6–7
    │     Phase 2 (Strengthen Skills — smaller gaps):
    │       ├── Skill with gap=1: "JUnit" → week 8
    │       └── Skill with gap=1: "Maven" → week 9
    │     Phase 3 (Advanced / Project):
    │       └── Capstone project using all skills → weeks 10–12
    │
    ├── For EACH roadmap item, auto-attach learning content:
    │     ├── YouTube videos (Source 1 — fetched from YouTube API for that skill)
    │     ├── Company courses (Source 2 — if any company uploaded for that skill)
    │     └── Marketplace courses (Source 3 — paid courses for that skill)
    │
    └── [PostgreSQL] INSERT/REPLACE StudentRoadmap { studentId, roleId, phases: JSONB }

ROADMAP UPDATES DYNAMICALLY:
  ├── When student completes a module → roadmap recalculates progress
  ├── When student takes an assessment → skill level may change → roadmap reorders
  ├── When student re-uploads resume → new skills detected → roadmap regenerates
  └── When admin updates RoleSkillBenchmark → affected students' roadmaps regenerate

GET /students/me/roadmap
  Response: {
    role: "backend",
    generated_from: "resume_gap_analysis",
    last_regenerated: "2026-07-17T10:00:00Z",
    progress_pct: 35,
    phases: [
      {
        phase: 1, label: "Priority Skills (Largest Gaps)",
        items: [
          {
            skill: "Microservices",
            gap: 3, current_level: 1, required_level: 4,
            estimated_weeks: 3,
            status: "in_progress", progress_pct: 40,
            content: {
              youtube: [{ youtube_id, title, channel, duration }],
              company_courses: [{ course_id, company_name, title }],
              marketplace: [{ course_id, title, price_inr, rating }]
            }
          },
          { skill: "Docker", gap: 3, ... status: "locked" },
          { skill: "REST APIs", gap: 2, ... status: "locked" }
        ]
      },
      {
        phase: 2, label: "Strengthen Skills",
        items: [
          { skill: "JUnit", gap: 1, ... status: "locked" },
          { skill: "Maven", gap: 1, ... status: "locked" }
        ]
      },
      {
        phase: 3, label: "Capstone Project",
        items: [
          { type: "project", title: "Full-stack app using all acquired skills", status: "locked" }
        ]
      }
    ]
  }
```

### Video Content — 3 Source Types

```
╔══════════════════════════════════════════════════════════════════╗
║               VIDEO / LEARNING CONTENT SOURCES                   ║
╚══════════════════════════════════════════════════════════════════╝

SOURCE 1 — YouTube API (Free, Auto-fetched per skill gap)
─────────────────────────────────────────────────────────────────

  When a student opens a roadmap skill item (e.g., "Microservices"):
  
  [LMS Service]
      └──→ [YouTube Data API v3]
              GET https://www.googleapis.com/youtube/v3/search
              Params:
                q = "Microservices tutorial Java Spring Boot"  ← built from GAP SKILL + role
                type = video
                videoDuration = medium | long
                videoCaption = closedCaption
                relevanceLanguage = en
                maxResults = 5
                key = YOUTUBE_API_KEY
              
              ← Response: [{videoId, title, thumbnail, channelName, duration}]
  
  → Stored in Redis cache (key: yt_results:{skill}:{role}, TTL: 6 hours)
  → Student sees embedded YouTube players (iframe) in the roadmap item
  → NO video storage on our end — YouTube serves it
  → Free tier: 10,000 units/day (YouTube API quota)
  
  Fallback: if quota exhausted → serve cached results from MongoDB
  
  Content fetched is SPECIFIC to the student's gap skill, not generic.


SOURCE 2 — Company-Uploaded Courses (Free to Students)
─────────────────────────────────────────────────────────────────

  WHO CAN UPLOAD: Verified companies (HR/L&D teams)
  PURPOSE: Onboarding content, role-specific training, company culture
  VISIBILITY: All students OR only shortlisted/hired students (company chooses)
  COST TO STUDENT: Free
  COST TO COMPANY: Free (included in company plan)
  
  Company Upload Flow:
  [Company Portal → Courses tab]
      │
      ├── POST /companies/me/courses
      │     Body: {
      │       title: "Razorpay Payment APIs for Developers",
      │       description: "...",
      │       target_roles: ["backend", "fullstack"],
      │       skills_covered: ["REST APIs", "Payment Systems"],
      │       visibility: "all_students" | "shortlisted_only",
      │       modules: []
      │     }
      │
      ├── For each module:
      │     POST /companies/me/courses/:courseId/modules
      │           Body (multipart):
      │             type: "video" | "article" | "pdf"
      │             title: "Module 1: Payment Gateway Basics"
      │             file: <MP4 binary>  OR  youtube_url: "..."  OR  article_md: "..."
      │
      │     → [LMS Service]
      │           ├──→ [AWS S3] : PUT /company-courses/{companyId}/{courseId}/{moduleId}.mp4
      │           ├──→ [CDN]    : S3 origin → CloudFront serves to students
      │           └──→ [PostgreSQL] INSERT CompanyCourse, CompanyModule rows
      │
      └── Course published → auto-attached to roadmap items matching skills_covered
  
  How company courses appear in student roadmap:
    [LMS Service] on roadmap generation:
    → For each skill gap item → SELECT CompanyCourses WHERE skills_covered includes skill
    → Attach to roadmap item's content.company_courses array
    → Student sees them inline with the relevant skill, not in a separate page


SOURCE 3 — Creator Marketplace (Paid — Revenue Model)
─────────────────────────────────────────────────────────────────

  WHO CAN UPLOAD: Anyone — teachers, instructors, professionals, freelancers
  PURPOSE: Skill-specific paid courses (like Udemy, but inside SkillDipz)
  COST TO STUDENT: Course price set by creator (e.g., ₹499, ₹999, ₹1999)
  REVENUE SPLIT: Creator 70% / SkillDipz 30%
  
  CREATOR ONBOARDING:
  [Creator Registration — separate portal /creator]
      POST /creator/register
        Body: { name, email, expertise[], bio, linkedin, sample_video_url }
      → Admin review (manual or auto-approve if linkedin verified)
      → Creator account created (role: CREATOR)
  
  CREATOR COURSE UPLOAD FLOW:
  [Creator Dashboard]
      │
      ├── POST /creator/courses
      │     Body: {
      │       title: "Advanced Spring Boot + Microservices — Zero to Production",
      │       description: "...",
      │       target_roles: ["backend"],
      │       skills_covered: ["Spring Boot","Docker","Microservices"],
      │       price_inr: 1499,
      │       preview_video_url: "..."  ← free teaser (YouTube or S3)
      │     }
      │
      ├── Modules upload:
      │     POST /creator/courses/:courseId/modules
      │           Body (multipart): { title, type: "video", file: <MP4> }
      │           → [S3]: PUT /creator-courses/{creatorId}/{courseId}/{moduleId}.mp4
      │           → [CDN]: CloudFront serves (signed URLs — only paid students)
      │
      ├── Course Review:
      │     Admin reviews content quality
      │     POST /admin/creator-courses/:id/approve
      │     → Course published in marketplace
      │
      └── Course live → auto-attached to matching roadmap skill items
  
  STUDENT PURCHASE FLOW:
  [Student — clicks "Buy" on a marketplace course inside their roadmap]
      │
      ├── GET /marketplace/courses?skill=SpringBoot&role=backend
      │     ← List of creator courses with price, rating, creator name, preview
      │
      ├── Student clicks "Buy — ₹1499"
      │     → POST /marketplace/purchase
      │           Body: { courseId, studentId }
      │           → [Payment Gateway] (Razorpay/Stripe)
      │                 → Payment captured
      │                 → POST /marketplace/payment-success { orderId, courseId }
      │                 → [PostgreSQL] INSERT CourseEnrollment { studentId, courseId, paid_at, amount }
      │                 → [Message Queue] PUBLISH course.purchased
      │                        │
      │                        ↓ CONSUME
      │                 [Finance Service]
      │                 → Calculate split: creator 70%, platform 30%
      │                 → [PostgreSQL] INSERT CreatorEarning, PlatformRevenue rows
      │                 → Payout batched (weekly/monthly to creator bank account)
      │
      └── Student gets access:
            GET /marketplace/courses/:courseId/modules/:moduleId
            → Signed CDN URL (expires in 4 hours, only for enrolled student)
  
  VIDEO SECURITY (Paid content):
    ├── AWS S3 bucket: private (no public access)
    ├── CDN signed URLs: generated per request, 4h expiry, student-specific
    ├── No download option (stream only)
    └── Watermark: student name/email overlaid on video (optional, configurable)
```

### Roadmap Page Layout (Updated)

```
Learning Roadmap Page (DYNAMIC per student)
│
├── Phase Timeline (left column — ordered by gap priority, NOT fixed weeks)
│   ├── 🔴 Phase 1: Priority Skills (largest gaps)
│   │   ├── Microservices (gap: 3) — In Progress 40%
│   │   ├── Docker (gap: 3) — Locked
│   │   └── REST APIs (gap: 2) — Locked
│   ├── 🟡 Phase 2: Strengthen Skills
│   │   ├── JUnit (gap: 1) — Locked
│   │   └── Maven (gap: 1) — Locked
│   └── 🟢 Phase 3: Capstone Project
│       └── Full-stack project — Locked
│
├── Content Panel (right — when skill item selected, e.g., "Microservices")
│   │
│   ├── Skill Header: "Microservices" | Gap: 3 | Current: 1/4 | Est. 3 weeks
│   │
│   ├── 📺 FREE VIDEOS (YouTube API — fetched for "Microservices")
│   │   ├── "Microservices Full Course | Amigoscode" [YouTube] — 2h 45m
│   │   ├── "Spring Boot Microservices Tutorial" [YouTube] — 1h 20m
│   │   └── [embedded YouTube player]
│   │
│   ├── 🏢 COMPANY COURSES (Free — matching "Microservices")
│   │   └── "Razorpay Microservices Architecture" — by Razorpay L&D
│   │       [Start Course →]
│   │
│   └── 🎓 MARKETPLACE COURSES (Paid — matching "Microservices")
│       ├── "Advanced Microservices with Spring Cloud" — ₹1,499 ⭐ 4.8
│       │   [Preview] [Buy — ₹1,499]
│       └── "Docker + Kubernetes for Microservices" — ₹999 ⭐ 4.6
│           [Preview] [Buy — ₹999]
```

---

## 4. Target Company (AUTO-LISTED — Not Manually Selected)

**URL:** `/target-company`

### ⚠️ Key Change: Companies Are NOT Manually Added by Student

```
╔══════════════════════════════════════════════════════════════════╗
║                TARGET COMPANY — AUTO-MATCHING                     ║
║                                                                  ║
║  Student does NOT pick companies manually.                       ║
║  Companies REGISTER on the platform → post job requirements →   ║
║  Platform AUTO-MATCHES students to companies based on:           ║
║    1. Student's role vs company's required roles                 ║
║    2. Student's skills (from resume parse) vs company must-haves ║
║    3. Student's Employability Score vs company min_score         ║
║                                                                  ║
║  Student sees a ranked list of matching companies they can aim   ║
║  for — updated in real-time as their score changes.              ║
╚══════════════════════════════════════════════════════════════════╝
```

### Auto-Matching Flow

```
TRIGGER: score.updated OR profile.updated OR company.registered event

[Recruiting Service] computes matches:
    │
    ├── READ from [PostgreSQL]:
    │     StudentProfile (role, skills[], score)
    │     CompanyProfile (all verified companies)
    │     JobRequirements (active postings from each company)
    │
    ├── MATCH ALGORITHM per company:
    │     1. Role match: company.required_roles includes student.role? → YES/NO
    │     2. Skill overlap:
    │          student_skills ∩ company.must_have_skills
    │          match_pct = overlap.length / company.must_have_skills.length × 100
    │     3. Score check:
    │          student.score >= company.min_score? → ELIGIBLE / NOT YET
    │     4. Final match_score = (skill_match_pct × 0.6) + (score_readiness × 0.4)
    │
    ├── RANK companies by match_score DESC
    └── Cache in Redis: matched_companies:{studentId} (TTL: 30 min)

GET /students/me/target-companies
  → [Recruiting Service] → [Redis] → if cache miss → compute
  ← Response:
  {
    student_score: 88,
    student_role: "backend",
    matched_companies: [
      {
        company_id: "razorpay", name: "Razorpay", logo: "💳",
        industry: "Fintech", min_score: 75,
        your_score: 88, eligible: true,
        skill_match_pct: 85,   ← "you have 6/7 must-have skills"
        missing_skills: ["Microservices"],
        interview_rounds: ["Online Assessment", "Tech 1", "Tech 2", "HR"],
        active_openings: 3,    ← number of jobs posted by this company
        match_rank: 1
      },
      {
        company_id: "flipkart", name: "Flipkart", logo: "🛒",
        industry: "E-commerce", min_score: 78,
        your_score: 88, eligible: true,
        skill_match_pct: 70,
        missing_skills: ["DSA", "System Design"],
        interview_rounds: ["DSA 1", "DSA 2", "Machine Coding", "System Design", "HR"],
        active_openings: 2,
        match_rank: 2
      },
      {
        company_id: "google", name: "Google", logo: "🔎",
        industry: "Tech", min_score: 85,
        your_score: 88, eligible: true,
        skill_match_pct: 55,
        missing_skills: ["Algorithms", "System Design", "Distributed Systems"],
        interview_rounds: ["Phone Screen", "Onsite 1-4", "Googleyness", "HR"],
        active_openings: 1,
        match_rank: 3
      },
      {
        company_id: "amazon", name: "Amazon", logo: "📦",
        industry: "E-commerce/Cloud", min_score: 80,
        your_score: 88, eligible: true,
        skill_match_pct: 60,
        missing_skills: ["DSA", "System Design", "AWS"],
        match_rank: 4
      }
    ],
    companies_not_yet_eligible: [
      // companies where student.score < min_score
      // shown at bottom as "Improve to unlock"
    ]
  }

Company Detail View (when student clicks a company):
  GET /companies/:companyId/profile
  ← Full company profile + interview rounds + tips

Target Company Page UI:
├── "Your Matched Companies" header
├── Match cards sorted by match_score:
│   ├── 💳 Razorpay — Fintech | Match: 85% | Score: 88/75 ✅
│   │   Skills matched: 6/7 | Missing: Microservices
│   │   Openings: 3 jobs | [View Company →] [See Jobs →]
│   │
│   ├── 🛒 Flipkart — E-commerce | Match: 70% | Score: 88/78 ✅
│   │   Skills matched: 5/7 | Missing: DSA, System Design
│   │   Openings: 2 jobs | [View Company →]
│   │
│   └── 🔎 Google — Tech | Match: 55% | Score: 88/85 ✅
│       Skills matched: 4/7 | Missing: Algorithms, System Design, Distributed
│
├── "Improve to Unlock" section (companies where score < min_score)
│   └── 📊 Zoho — SaaS | Need: 72 | Your: 65 | +7 pts needed
│       [See what to improve →] → links to skill gap items
│
└── Updates in real-time:
    When student's score changes → matched_companies list re-ranked
    When new company registers → automatically appears if matching
```

---

## 5. My Activity

**Real-Time Data Sources:**

```
GET /students/me/activity?page=1&limit=20
→ [Activity Service] → [PostgreSQL]
  Aggregates from:
    - Submissions (code solved)
    - AssessmentResults (tests taken)
    - StudentProgress (modules completed)
    - ProjectSubmissions (projects submitted)
    - Shortlists (companies that shortlisted)
    - AIInterviewSessions (mock interviews done)
  
  Response: [
    { type: "submission", title: "Solved Two Sum", detail: "Accepted · 24ms", time: "2h ago" },
    { type: "assessment", title: "Backend Quiz — 8/10", detail: "+0.4 conceptual score", time: "5h ago" },
    { type: "shortlist", title: "TechCorp India shortlisted you", detail: "Java Backend Dev", time: "1d ago" }
  ]

Streak tracking:
  GET /students/me/streak
  → [PostgreSQL] Count consecutive days with at least 1 activity
  → Response: { current_streak: 7, longest_streak: 14, last_active: "2026-07-17" }
```

---

## 6. Jobs Hub (OPEN Positions — Company-Posted)

**URL:** `/jobs`

### ⚠️ Key Change: Shows REAL Open Positions That Companies Post

```
╔══════════════════════════════════════════════════════════════════╗
║                        JOBS HUB                                   ║
║                                                                  ║
║  Companies post OPEN job positions on the platform.              ║
║  Students see jobs auto-matched to their profile.                ║
║  Each job shows a Profile Match % based on student's skills,    ║
║  score, and the job's requirements.                              ║
╚══════════════════════════════════════════════════════════════════╝
```

### Company Side — Posting a Job

```
[Company Portal → Jobs tab]
│
└── POST /companies/me/jobs
      Body: {
        title: "Junior Java Backend Developer",
        role_id: "backend",
        description: "We are looking for...",
        min_score: 70,
        required_skills: ["Java","Spring Boot","REST APIs","SQL"],
        nice_to_have: ["Docker","Microservices"],
        location: "Bangalore",
        work_mode: "hybrid" | "remote" | "office",
        ctc_range: "8-14 LPA",
        experience: "0-2 years",
        deadline: "2026-08-15",
        openings_count: 3
      }
      → [PostgreSQL] INSERT JobRequirement (status: active)
      → [Message Queue] PUBLISH job.posted
             │
             ↓ CONSUME
      [Notification Service]
      → Find students WHERE role matches AND score >= min_score
      → Push: "New job opening at Razorpay — Java Backend Dev (8-14 LPA)!"
```

### Student Side — Browsing & Applying

```
GET /jobs?page=1&sort=match_score
→ [Recruiting Service]
    ├── [PostgreSQL] SELECT JobRequirements WHERE status = 'active'
    ├── For each job, compute PROFILE MATCH %:
    │     1. Role match: job.role == student.role? → base match
    │     2. Skill overlap:
    │          matched = student.skills ∩ job.required_skills
    │          skill_match = matched.length / job.required_skills.length × 100
    │     3. Score check:
    │          student.score >= job.min_score? → eligible = true
    │     4. Nice-to-have bonus:
    │          student.skills ∩ job.nice_to_have → bonus +5% each
    │     5. profile_match_pct = skill_match + bonus (capped at 100%)
    ├── Sort by: profile_match_pct DESC (best matches first)
    └── Return

Response per job:
{
  job_id, company_name, company_logo, title,
  role, min_score, location, work_mode, ctc_range,
  required_skills, nice_to_have,
  experience, deadline, openings_count,
  posted_at,
  profile_match_pct: 85,       ← "85% match with your profile"
  eligible: true,               ← score >= min_score
  matched_skills: ["Java","Spring Boot","SQL"],
  missing_skills: ["REST APIs"],
  already_applied: false
}

Jobs Hub UI:
├── Filter Bar:
│   ├── Role: Backend / Fullstack / Data / DevOps / AI (default: student's role)
│   ├── Location: All / Bangalore / Remote / Mumbai / etc.
│   ├── CTC Range: slider
│   ├── Show: All / Eligible Only / Applied
│   └── Sort: Best Match / Newest / Highest CTC
│
├── Job Cards (sorted by profile_match_pct):
│   ├── 💳 Razorpay — Junior Java Backend Dev
│   │   📍 Bangalore (Hybrid) | 💰 8-14 LPA | 🎯 Match: 85%
│   │   Skills: Java ✅ | Spring Boot ✅ | REST APIs ❌ | SQL ✅
│   │   Score: 88/70 ✅ | Deadline: Aug 15 | 3 openings
│   │   [View Details] [Apply Now →]
│   │
│   ├── 🛒 Flipkart — SDE Intern
│   │   📍 Remote | 💰 6-10 LPA | 🎯 Match: 72%
│   │   Score: 88/78 ✅ | Deadline: Sep 1 | 5 openings
│   │   [View Details] [Apply Now →]
│   │
│   └── 🔎 Google — Backend Engineer
│       📍 Bangalore | 💰 18-28 LPA | 🎯 Match: 55%
│       Score: 88/85 ✅ | Missing: Algorithms, System Design
│       [View Details] [Apply Now →]

Student applies to a job:
  POST /jobs/:jobId/apply
  → [Recruiting Service]
  → Eligibility check: score >= min_score AND role matches
  → [PostgreSQL] INSERT JobApplication { studentId, jobId, applied_at, status: 'Applied' }
  → [PostgreSQL] INSERT Shortlist { jobId, studentId, funnel_status: 'Applied' }
  → [Message Queue] PUBLISH job.applied
  → Company notified: "Arjun Sharma (Score: 88, Match: 85%) applied for Java Backend Dev"
  
  If NOT eligible (score too low):
  → Button shows: "Improve score by 7 pts to apply" (disabled)
  → Links to roadmap items to close the gap
```

---

## 7. Notifications

```
GET /notifications?limit=50&unread=true
→ [Notification Service] → [PostgreSQL]

PATCH /notifications/:id/read
PATCH /notifications/mark-all-read

All real-time via WebSocket push (no polling):
  ws://api.skilldipz.com/ws/student/{userId}
  Event: { type: "notification", payload: { id, title, body, action_url, created_at } }
```

---

## 8. Projects (UPDATED — Company-Assigned Model)

**URL:** `/projects`

### How It Works Now

```
╔══════════════════════════════════════════════════════════════════╗
║                  PROJECT FLOW (REVISED)                          ║
║                                                                  ║
║  Companies upload project briefs  →  Students see them          ║
║  Students work offline (GitHub)  →  Students submit URL         ║
║  NLP evaluates evidence          →  Score updated                ║
╚══════════════════════════════════════════════════════════════════╝
```

### Company Side — Project Upload

```
[Company Portal → Projects tab]
│
├── POST /companies/me/projects
│     Body: {
│       title: "Build a REST API for Order Management",
│       description: "Create a complete REST API using Spring Boot...",
│       target_roles: ["backend"],
│       required_skills: ["Spring Boot","REST APIs","MySQL","Git"],
│       difficulty: "Intermediate",
│       deliverables: [
│         "GitHub repo with README",
│         "Postman collection",
│         "Deployed API URL (optional)"
│       ],
│       deadline_days: 14,          ← days from assignment date
│       visibility: "all_students" | "shortlisted_only" | "specific_colleges",
│       resources: [                ← optional starter files / docs
│         { name: "DB Schema.pdf", s3_url: "..." },
│         { name: "Requirements Doc.pdf", s3_url: "..." }
│       ]
│     }
│
└── [PostgreSQL] INSERT CompanyProject row
    [Message Queue] PUBLISH project.posted
           │
           ↓ CONSUME
    [Notification Service]
    → Push to eligible students: "New project from Razorpay available!"

Project List (company sees all submissions):
GET /companies/me/projects/:projectId/submissions
→ [Recruiting Service] → [PostgreSQL]
→ Returns: [{ studentId, studentName, score, github_url, submitted_at, evaluation_status }]
```

### Student Side — Project Flow

```
[Student — Projects sidebar tab]
│
├── GET /students/me/projects
│     → [Recruiting Service] → [PostgreSQL]
│         SELECT CompanyProjects WHERE:
│           target_roles includes student.role
│           AND (visibility = 'all_students' OR student in shortlist)
│         LEFT JOIN StudentProjectSubmission (to show submission status)
│     ← Response:
│         [
│           {
│             project_id, company_name, company_logo,
│             title, difficulty, deadline,
│             required_skills, deliverables,
│             status: "available" | "submitted" | "evaluated",
│             my_submission: null | { github_url, submitted_at, nlp_score }
│           }
│         ]
│
├── Project Cards UI:
│   ├── 🏢 Razorpay — "Build Order Management REST API"
│   │   Difficulty: Intermediate | Deadline: 14 days | Skills: Spring Boot, MySQL
│   │   [View Details] [Start Project]
│   │
│   └── 💼 TechCorp — "React Dashboard with API Integration"
│       Difficulty: Advanced | Deadline: 21 days | Skills: React, Node.js
│       [View Details] [Submit Project]
│
├── Project Detail View:
│   ├── Full description + deliverables list
│   ├── Resource downloads (starter files, schema PDFs)
│   └── Submission form
│
└── SUBMISSION FLOW:
    Student clicks "Submit Project"
        POST /projects/:projectId/submit
        Body: {
          github_url: "https://github.com/student/order-api",
          demo_url: "https://order-api.railway.app",   ← optional
          notes: "Implemented JWT auth, pagination, and input validation"
        }
        
        → [Profile Service]
              ├──→ [PostgreSQL] INSERT StudentProjectSubmission
              └──→ [Message Queue] PUBLISH project.submitted
                         │
                         ↓ CONSUME (async — takes 1–3 mins)
                   [NLP Evaluation Worker]
                         ├── Fetch GitHub README via GitHub API
                         ├── Fetch repository file list (check tech stack)
                         ├── Extract: skills mentioned, complexity signals, docs quality
                         ├── Compare vs project.required_skills
                         └── Output: { verified_skills[], evidence_score: 0.87, quality_signals: [...] }
                         │
                         ↓
                   [Profile Service]
                         ├──→ [PostgreSQL] UPDATE StudentProjectSubmission (nlp_score, verified_skills)
                         └──→ [Message Queue] PUBLISH project.evaluated
                                    │
                                    ↓ CONSUME
                              [AI Scoring Service]
                                    ├── Update project_strength (15%) component
                                    ├── UPSERT EmployabilityScore
                                    └──→ [Message Queue] PUBLISH score.updated
                                                   │
                                           ┌───────┴───────┐
                                           ↓               ↓
                                    [WebSocket Gw]   [Notif Service]
                                    (score gauge      "Your project scored
                                     animates)         87% — +2.3 pts!")
        
        Company also gets notified:
        → [Notif Service] → Company push: "Arjun Sharma submitted 'Order Management API'"
```

---

## 9. Skill Tests + Code Practice (MERGED TAB)

**URL:** `/practice`  
**⚠️ These are the SAME tab. No duplicate UI.**

### Overview

```
╔══════════════════════════════════════════════════════════════════╗
║  Skill Tests  =  Code Practice  (ONE unified tab)               ║
║                                                                  ║
║  Two modes inside the same page:                                 ║
║    Mode A: MCQ Skill Tests  (role-based knowledge assessment)    ║
║    Mode B: Coding Problems  (Codeforces API + open problem sets) ║
╚══════════════════════════════════════════════════════════════════╝

Tab toggle inside /practice:
  [ Skill Tests ] [ Coding Problems ]
```

### Mode A — Skill Tests (MCQ)

```
Same flow as §6 of the main doc.
All questions from MongoDB (seeded manually or via admin upload).
No AI generation — admin uploads verified question banks.

GET /assessments/available?role={roleId}
→ [Assessment Service] → [MongoDB] question bank
← 10-question MCQ sets per role/topic

Real scores only, no mock scores.
Results stored in AssessmentResult table.
Publishes: assessment.completed → AI Scoring
```

### Mode B — Coding Problems (Codeforces API / Open Sets)

```
DATA SOURCE: Codeforces Public API (free, no API key required)
  Base URL: https://codeforces.com/api/

PROBLEM FETCH FLOW:
  [Coding Judge Service]
      │
      ├── GET https://codeforces.com/api/problemset.problems
      │     Params: tags=implementation,dp,graphs,strings  ← based on student role
      │
      │   Response: {
      │     problems: [
      │       { contestId: 1234, index: "A", name: "Two Pointers", 
      │         rating: 800, tags: ["implementation","two pointers"] }
      │     ],
      │     problemStatistics: [{ contestId, index, solvedCount }]
      │   }
      │
      ├── Filtered & sorted:
      │     - Difficulty mapping: 800–1000 → Easy, 1100–1600 → Medium, 1700+ → Hard
      │     - Filter by tags relevant to student's role + skill gaps
      │     - Sort by solvedCount DESC (popular problems first)
      │
      └── Cached in Redis (key: cf_problems:{role}:{difficulty}, TTL: 24 hours)

PROBLEM PRESENTATION:
  Problem statement fetched from Codeforces problem page:
  GET https://codeforces.com/problemset/problem/{contestId}/{index}
  → Rendered in our UI (problem text, input/output format, examples)
  → Attribution: "Source: Codeforces — Problem {contestId}{index}" (license compliant)

SUBMISSION FLOW (two options):
  Option A — In-Platform Judge (for selected problems):
    → Student writes code in Monaco editor
    → POST /submissions { code, language, cf_problem_id }
    → [Coding Judge] → Sandbox Worker runs against our mirrored test cases
    
    Getting test cases from Codeforces:
    → Codeforces has public test cases for many problems via:
       https://codeforces.com/contest/{contestId}/problem/{index}
       (first few test cases visible, others from community)
    → We mirror visible test cases + community-contributed ones in MongoDB
    → Sandbox execution same as before
  
  Option B — Redirect to Codeforces (lower infra cost):
    → "Solve on Codeforces →" button opens Codeforces in new tab
    → Student solves there, gets submission ID
    → POST /submissions/verify { cf_submission_id, cf_handle }
    → [Coding Judge] calls Codeforces API to verify:
       GET https://codeforces.com/api/user.status?handle={cfHandle}&from=1&count=10
       ← Checks if recent submission matches the problem and verdict = "OK"
    → Verdict confirmed → score updated

  Recommended for MVP: Option B (zero sandbox cost, Codeforces handles judging)

OTHER OPEN PROBLEM SOURCES (for variety):
  ├── LeetCode (problems are public, can display with attribution)
  │   → Statement shown, submission redirected to LeetCode
  ├── AtCoder (atcoder.jp, open problems, similar redirect model)
  └── Project Euler (mathematical/algorithmic, open license)
  
  License check per source:
  ├── Codeforces: problems freely accessible, attribution required ✓
  ├── LeetCode: display OK, submission verification harder (no public API)
  └── AtCoder: open access, attribution required ✓

SKILL MAPPING (Codeforces tags → SkillDipz roles):
  backend:   implementation, data structures, graphs, sorting, binary search
  fullstack: implementation, string processing, basic algorithms
  data:      math, combinatorics, probability, implementation
  devops:    system design concepts (theory MCQ, not CF)
  ai:        math, probability, greedy, dynamic programming

Student profile on Codeforces (optional connection):
  Student links Codeforces handle in profile:
  PUT /students/me/profile { cf_handle: "arjun_sharma" }
  → [Profile Service] → [PostgreSQL] UPDATE StudentProfile
  → Platform fetches recent CF submissions to auto-credit solved problems:
    GET https://codeforces.com/api/user.status?handle={cfHandle}
    ← All past accepted submissions → credit corresponding problems in our DB
    → [AI Scoring Service] recomputes coding_proficiency
```

### Unified Practice Page Layout

```
/practice page
│
├── Tab: [ Skill Tests ] [ Coding Problems ]
│
├── SKILL TESTS tab:
│   ├── Role badge: "Java Backend Developer"
│   ├── Test cards by topic:
│   │   ├── Spring Boot Basics — 10 Qs — ⏱ 15 min — [Start Test]
│   │   ├── REST API Design — 10 Qs — ⏱ 15 min — [Start Test]
│   │   └── Docker & Containers — 10 Qs — ⏱ 15 min — [Start Test]
│   └── Completed tests: score history + retake cooldown
│
└── CODING PROBLEMS tab:
    ├── Source badge: "Powered by Codeforces"
    ├── Filters: Difficulty / Topic / Status
    ├── Problem list (real CF problems):
    │   ├── [Easy]   Two Pointers Problem — CF 800 — 12,450 solved
    │   ├── [Easy]   String Reversal — CF 900 — 8,230 solved
    │   ├── [Medium] DP Optimization — CF 1400 — 2,100 solved
    │   └── [Hard]   Graph Traversal — CF 1800 — 450 solved
    │
    ├── Click problem:
    │   ├── Problem statement (CF content with attribution)
    │   ├── Monaco editor (language selector)
    │   ├── [Run] → test visible examples
    │   ├── [Submit on Codeforces] → opens CF, returns verification link
    │   └── [Verify Submission] → enter CF submission ID → auto-verified
    │
    └── Codeforces handle connected:
        "Your CF handle: arjun_sharma — 47 problems auto-credited ✓"
```

---

## 10. Mock Interview (COMPANY-CONDUCTED + PROCTORED)

**URL:** `/mock-interview`

### ⚠️ Key Change: Companies Conduct the Mock Interviews, Not AI Alone

```
╔══════════════════════════════════════════════════════════════════╗
║              MOCK INTERVIEW — COMPANY-CONDUCTED                   ║
║                                                                  ║
║  Companies schedule and conduct mock interviews for shortlisted  ║
║  students through the platform.                                  ║
║                                                                  ║
║  FULLY PROCTORED — like Infosys Springboard exam mode:           ║
║    ✗ No tab switching allowed                                    ║
║    ✗ No screenshots / screen recording                           ║
║    ✗ No copy-paste                                               ║
║    ✗ No right-click                                              ║
║    ✗ No browser DevTools                                         ║
║    ✗ No window resize / exit full screen                         ║
║    ✓ Mandatory full-screen mode                                  ║
║    ✓ Webcam always on (face detection proctoring)                ║
║    ✓ Tab-switch violation counter (auto-terminates at 3)         ║
╚══════════════════════════════════════════════════════════════════╝
```

### Two Interview Modes

```
Mode A: COMPANY-CONDUCTED MOCK INTERVIEW (Live, Real Interviewer)
═══════════════════════════════════════════════════════════════════

Company Side — Schedule Interview:
  [Company Portal → Interviews tab]
  │
  └── POST /companies/me/interviews/schedule
        Body: {
          student_id: "u9",
          job_id: "job123",
          interview_type: "technical" | "hr" | "coding" | "system_design",
          scheduled_at: "2026-07-20T14:00:00+05:30",
          duration_mins: 45,
          interviewer_name: "Priya (Senior Engineer)",
          proctoring_enabled: true
        }
        → [PostgreSQL] INSERT InterviewSession
        → [Notification Service] → notify student:
            "Razorpay scheduled a Technical Interview on Jul 20, 2:00 PM IST"
            → email + mobile push + in-app notification

Student Side — Attend Interview:
  [Student → Mock Interview tab → sees scheduled interviews]
  │
  ├── "Join Interview" button appears 5 min before scheduled time
  ├── Click "Join" →
  │
  │   PROCTORING LOCKDOWN ACTIVATES:
  │   ────────────────────────────────────────────────────────────
  │   [Proctor Service] initializes:
  │     ├── document.requestFullscreen() → MANDATORY full screen
  │     ├── document.addEventListener('visibilitychange') → detect tab switch
  │     ├── window.addEventListener('blur') → detect window focus loss
  │     ├── document.addEventListener('contextmenu', e => e.preventDefault())
  │     ├── document.addEventListener('keydown') → block:
  │     │     Ctrl+C, Ctrl+V, Ctrl+Shift+I, Ctrl+Shift+J, F12,
  │     │     Alt+Tab (detected as blur), PrintScreen
  │     ├── Disable text selection via CSS: user-select: none
  │     ├── navigator.mediaDevices.getDisplayMedia → BLOCKED
  │     ├── Screen capture API → BLOCKED
  │     └── CSS: -webkit-touch-callout: none (mobile)
  │
  │   VIOLATION TRACKING:
  │     Every violation logged in real-time:
  │     POST /interviews/:sessionId/violation
  │       Body: { type: "tab_switch" | "fullscreen_exit" | "copy_attempt", timestamp }
  │     
  │     Violation limits:
  │       tab_switch: 3 violations → session auto-terminated
  │       fullscreen_exit: 2 violations → session auto-terminated
  │       copy_paste: logged but session continues (warning shown)
  │     
  │     Student sees warning:
  │       "⚠️ Tab switch detected! Violation 1/3. Session will end at 3."
  │
  │   WEBCAM PROCTORING:
  │     ├── Webcam ON at all times (permission required before join)
  │     ├── Face detection running (detect if student looks away)
  │     ├── Snapshots taken every 30 seconds → stored in S3
  │     ├── No second person detection (multiple faces = violation)
  │     └── Interviewer can see student's webcam feed
  │
  │   VIDEO CALL:
  │     ├── WebRTC peer-to-peer connection (company interviewer ↔ student)
  │     ├── OR company uses their own video tool (Google Meet / Zoom link)
  │     │   → embedded in iframe within proctored fullscreen window
  │     ├── Screen sharing: student can share code editor only (sandboxed)
  │     └── Chat panel: text messages between interviewer and student
  │
  │   SESSION END:
  │     POST /interviews/:sessionId/complete
  │       Body: {
  │         completed_by: "interviewer",
  │         technical_score: 72,
  │         communication_score: 78,
  │         coding_score: 65,
  │         overall_score: 72,
  │         feedback: "Good Java basics, improve system design",
  │         violations_count: 1,
  │         proctoring_report: { snapshots_s3_keys: [...], violations: [...] }
  │       }
  │     → [PostgreSQL] UPDATE InterviewSession (scores, feedback, status: completed)
  │     → [Message Queue] PUBLISH interview.completed
  │     → [AI Scoring Service] updates conceptual_knowledge component
  │     → Student gets result notification with feedback


Mode B: AI-ASSISTED MOCK INTERVIEW (Practice Mode — also proctored)
═══════════════════════════════════════════════════════════════════

  For students who want to practice BEFORE company interviews.
  Same proctoring lockdown applies (to simulate real conditions).

  Student selects:
    ├── Target Company: Razorpay / Flipkart / etc.
    ├── Interview Type: Technical / HR
    └── Duration: 20 min / 45 min

  POST /ai-interview/start
    Body: { company_key: "razorpay", type: "technical", duration_mins: 45 }
    → PROCTORING LOCKDOWN ACTIVATES (same as Mode A)
    → AI Interview Service creates session

  AI-driven flow (same proctoring, but AI asks questions):
    AI sends question → Student responds via webcam/mic →
    Speech-to-text → AI generates follow-up → repeat

  Results:
    { overall_score, feedback, transcript, violations_count }
    → Score contributes to Employability Score
    → Violations logged (student practices in exam conditions)
```

### Proctoring Technical Implementation

```
PROCTOR SERVICE — Client-Side Implementation
─────────────────────────────────────────────────────────────────

// Anti-cheat measures (JavaScript):

1. FULL SCREEN ENFORCEMENT:
   document.documentElement.requestFullscreen()
   document.addEventListener('fullscreenchange', () => {
     if (!document.fullscreenElement) {
       logViolation('fullscreen_exit')
       showWarning('Return to fullscreen or interview ends')
       // auto re-request fullscreen
     }
   })

2. TAB SWITCH DETECTION:
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) {
       logViolation('tab_switch')
       violationCount++
       if (violationCount >= 3) terminateSession()
     }
   })
   window.addEventListener('blur', () => logViolation('window_blur'))

3. KEYBOARD LOCKDOWN:
   Blocked combinations:
     Ctrl+C, Ctrl+V, Ctrl+X           → copy/paste disabled
     Ctrl+Shift+I, Ctrl+Shift+J, F12  → DevTools blocked
     Ctrl+P                            → Print blocked
     PrintScreen / PrtSc               → screenshot detection
     Alt+Tab                           → detected as blur event
     Ctrl+Tab                          → blocked
     Windows key                       → detected as blur

4. RIGHT-CLICK DISABLED:
   document.addEventListener('contextmenu', e => e.preventDefault())

5. TEXT SELECTION DISABLED:
   CSS: * { user-select: none; -webkit-user-select: none; }

6. WEBCAM FACE DETECTION:
   Using TensorFlow.js face-api.js:
     - Detect face presence every 5 seconds
     - Alert if: no face detected, multiple faces, face looking away
     - Snapshots stored: S3 /proctoring/{sessionId}/{timestamp}.jpg

7. SCREEN RECORDING DETECTION:
   navigator.mediaDevices.getDisplayMedia → intercept and block
   Detect recording software via window title (limited)

8. SERVER-SIDE VALIDATION:
   All violations sent to server in real-time:
   POST /interviews/:sessionId/violation { type, timestamp, details }
   Server maintains authoritative violation count
   Session can be terminated server-side if violations exceed limit
```

---

## 11. Daily Assignments

**URL:** `/daily-assignments`

```
ASSIGNMENT GENERATION (Server-side, runs daily at midnight IST)

[Cron Job — Daily Assignment Generator]
  ├── For each active student:
  │     GET student.role, student.skill_gaps, student.last_activity
  │     
  │     Generate 3 tasks:
  │     ├── Task 1 (MCQ): Pick a quiz topic from top skill gap
  │     ├── Task 2 (Code): Pick a Codeforces problem matching gap skill
  │     └── Task 3 (Video): Pick a YouTube video for current roadmap week
  │     
  │     → [PostgreSQL] INSERT DailyAssignment { studentId, date, tasks: JSONB }
  │     → [Message Queue] PUBLISH daily_assignments.generated
  │            │
  │            ↓ CONSUME
  │     [Notification Service]
  │     → Push: "Your daily assignments for July 17 are ready 🎯"

GET /students/me/daily-assignments?date=2026-07-17
  ← {
      date: "2026-07-17",
      completed: 1,
      total: 3,
      tasks: [
        { type: "quiz", title: "Docker Basics Quiz", status: "completed", points: 10 },
        { type: "code", title: "CF 1234A — Two Pointers", status: "pending", points: 15, cf_url: "..." },
        { type: "video", title: "REST API Design (YouTube)", status: "pending", points: 5, youtube_id: "..." }
      ],
      streak: 7,
      streak_bonus: "+5 bonus XP for 7-day streak"
    }

Completing tasks:
  POST /daily-assignments/:taskId/complete
  → [PostgreSQL] UPDATE DailyAssignmentTask (status: completed)
  → [Message Queue] PUBLISH task.completed
         │
         ↓ CONSUME
  [AI Scoring Service]
  → Small learning_progress boost (daily consistency factor)
```

---

## 12. Leaderboard (ALL Students — Full Ranking)

**URL:** `/leaderboard`

### 12.1 ⚠️ Key Change: Shows ALL Registered Students, Not Just Top 100

```
╔══════════════════════════════════════════════════════════════════╗
║                     LEADERBOARD — ALL STUDENTS                    ║
║                                                                  ║
║  Every registered student who has a score gets ranked.           ║
║  If 2,40,000 students registered → 2,40,000 positions shown.   ║
║  Virtual scrolling / pagination for performance.                 ║
╚══════════════════════════════════════════════════════════════════╝

GET /leaderboard?role={roleId}&scope=global|college|city&page=1&around_me=true
  → [Recruiting Service] → [Elasticsearch]
  → Query: ALL students ranked by overall_score WHERE role filter applies
  → Paginated: 50 students per page
  → around_me=true: returns students near current student's rank

Response:
{
  total_students: 240000,      ← ALL registered students for this role
  my_rank: 4712,               ← student's exact position out of 240,000
  my_score: 88,
  page: 95,                    ← page containing student's rank
  per_page: 50,
  students: [
    { rank: 4701, name: "...", college: "...", score: 88.2, avatar: ".." },
    { rank: 4702, name: "...", college: "...", score: 88.1, avatar: ".." },
    ...
    { rank: 4712, name: "Arjun Sharma", college: "VIT Vellore", score: 88, avatar: "AS", isMe: true },
    ...
    { rank: 4750, name: "...", college: "...", score: 87.5, avatar: ".." }
  ],
  top_3: [
    { rank: 1, name: "Rahul Gupta", college: "Chandigarh Univ", score: 94, avatar: "RG" },
    { rank: 2, name: "Meera Krishnan", college: "PSG Coimbatore", score: 91, avatar: "MK" },
    { rank: 3, name: "Divya Menon", college: "Amrita Coimbatore", score: 89, avatar: "DM" }
  ]
}

Leaderboard UI:
├── TOP 3 Banner (always visible at top):
│   🥇 Rahul Gupta (94) | 🥈 Meera Krishnan (91) | 🥉 Divya Menon (89)
│
├── Your Position Card (always visible, sticky):
│   "You are ranked #4,712 out of 2,40,000 students"
│   "Score: 88 | Top 1.96%"
│   "↑ Improve by 0.2 pts to move up 10 spots"
│
├── Filter Bar:
│   ├── Scope: Global / My College / My City
│   ├── Role: Backend / Fullstack / Data / DevOps / AI
│   └── [Jump to My Rank] button
│
├── Full Student List (virtual scroll / paginated):
│   ├── Rank | Avatar | Name | College | Score | Trend (↑↓)
│   ├── Student's own row highlighted in green
│   ├── Scroll up/down through entire list
│   └── Page navigation: [1] ... [94] [95] [96] ... [4800]
│
└── Additional Stats:
    ├── Percentile: "You are in the top 1.96%"
    ├── College rank: "#3 in VIT Vellore" (out of 450 from VIT)
    ├── City rank: "#142 in Vellore" (out of 1200)
    └── Rank change: "↑ 23 spots this week" / "↓ 5 spots"

Elasticsearch Implementation:
  Index: students (same index as candidate search)
  Query for leaderboard:
  {
    query: { term: { role: "backend" } },
    sort: [{ overall_score: { order: "desc" } }],
    from: (page - 1) * 50,
    size: 50
  }
  
  For "my rank" computation:
  {
    query: { 
      bool: {
        filter: [
          { term: { role: "backend" } },
          { range: { overall_score: { gt: 88 } } }  ← count students above me
        ]
      }
    },
    track_total_hits: true
  }
  → total_hits + 1 = my_rank

Performance:
  ├── Elasticsearch handles millions of docs with sub-100ms sort queries
  ├── Leaderboard cache in Redis: per role, refreshed every 5 minutes
  ├── "My rank" computed per-request (fast ES count query)
  └── Top 3 cached separately (rarely changes, 15-min TTL)
```

---

## 13. My Profile

**URL:** `/profile`

```
GET /students/me/profile (full detail)
→ [Profile Service] → [PostgreSQL]
→ Response: {
    name, email, phone, college, branch, grad_year,
    resume_url (S3 pre-signed), skills[], visibility_setting,
    github, linkedin, cf_handle,
    target_role, target_company,
    certificates: [{ role, score, issued_at, cert_id, pdf_url }],
    score_breakdown: { coding, conceptual, learning, project, profile },
    enrolled_courses: [{ title, progress_pct, source: "marketplace|company|youtube" }]
  }

Profile Edit:
  PUT /students/me/profile
  Body (any fields): { name, phone, github, linkedin, visibility_setting, cf_handle }
  → [Profile Service] → [PostgreSQL] UPDATE StudentProfile
  → [Message Queue] PUBLISH profile.updated
  → [AI Scoring Service] recomputes profile_completeness (10%)
  → [Recruiting Service] updates Elasticsearch document

Resume upload/replace:
  PUT /students/me/resume (multipart)
  → [S3] PUT new file → old file replaced
  → [NLP API] re-parse → update skills
  → [AI Scoring] recompute

Profile Completeness indicator:
  Field                    Weight   Status
  ─────────────────────────────────────────
  Education filled          +2 pts   ✅
  GitHub linked             +2 pts   ✅
  LinkedIn linked           +2 pts   ❌ → "Add LinkedIn"
  Resume uploaded           +2 pts   ✅
  Profile photo             +1 pt    ❌ → "Add photo"
  Skills list (≥5 skills)   +1 pt    ✅
  ─────────────────────────────────────────
  Total: 8/10 → profile_completeness score = 80%
  → contributes 10% × 80% = 8 pts to Employability Score

Certificates section:
  List of earned certificates with:
  ├── [Download PDF] → GET /certificates/:id/pdf → S3 signed URL
  ├── [Share Link] → copy https://skilldipz.com/verify/{certId}
  └── [Share on LinkedIn] → LinkedIn API share with certificate image

Linked Codeforces account:
  PUT /students/me/profile { cf_handle: "arjun_sharma" }
  → Auto-fetch past accepted submissions
  → GET https://codeforces.com/api/user.status?handle=arjun_sharma
  → Credit all solved problems in our DB
  → Recompute coding_proficiency score
```

---

## 14. Revenue Model Summary (Startup)

```
╔════════════════════════════════════════════════════════════════════╗
║                    SKILLDIPZ REVENUE STREAMS                       ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. CREATOR MARKETPLACE (30% platform cut)                        ║
║     Teachers/instructors upload paid courses                       ║
║     Student pays → 70% to creator, 30% to SkillDipz              ║
║     Target: ₹999–₹3999 per course                                 ║
║                                                                    ║
║  2. COMPANY SUBSCRIPTION (B2B)                                     ║
║     Companies pay monthly/annual for:                              ║
║     ├── Access to verified candidate directory                     ║
║     ├── Unlimited candidate search + shortlisting                  ║
║     ├── Job posting slots                                          ║
║     └── Upload company courses (max N per plan tier)              ║
║     Target: ₹10,000–₹50,000/month per company                     ║
║                                                                    ║
║  3. PREMIUM STUDENT PLAN (B2C)                                     ║
║     Free: YouTube videos, MCQ tests, 5 CF problems/day             ║
║     Paid (₹299/month):                                             ║
║     ├── Unlimited coding problems                                  ║
║     ├── AI Mock Interviews (3/month free → unlimited)              ║
║     ├── Priority shortlisting visibility to companies              ║
║     └── Access to all company-uploaded courses                     ║
║                                                                    ║
║  4. CERTIFICATE VERIFICATION API (B2B)                             ║
║     Companies can call our verification API for bulk checks        ║
║     ₹5/verification call (batch pricing available)                 ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 15. Company Portal Flow

**URL:** `/company/dashboard`, `/company/leaderboard`, `/company/jobs`, `/company/database`  
**Auth Required:** Yes (COMPANY role, verified)

### 15.1 Employer Dashboard

```
GET /companies/me/dashboard
    Response: {
        stats: {
            active_students_on_platform: "number",
            verified_skilled_developers: "number",
            partner_hiring_corporates: "number",
            average_recruitment_time_saved_pct: "number"
        },
        outstanding_talent_pools: [
            {
                student_id: "string",
                name: "string",
                avatar_initials: "string",
                college: "string",
                target_role: "string",
                skills: "string[]",
                ai_skill_fit_pct: "number"
            }
        ]
    }

Dashboard UI Layout:
├── Header: "Welcome, Hiring Partner!" + subtitle
├── Top Stats Row:
│   ├── Active Students on Platform (number)
│   ├── Verified Skilled Developers (number)
│   ├── Partner Hiring Corporates (number)
│   └── Average Recruitment Time Saved (% number)
│
└── Outstanding Active Talent Pools
    ├── List of candidate cards
    │   ├── Avatar (initials) + Name
    │   ├── College + Target Role (e.g., "Java Backend Developer")
    │   ├── Top Skills (tags)
    │   └── AI SKILL FIT (% score, green)
    └── "View All Candidates →" button
```

### 15.2 Global Leaderboard (Company View)

```
GET /companies/me/leaderboard?specialty={roleId}
    → Fetches real-time ranked list of all registered students from Elasticsearch.
    
    Response: {
        candidates: [
            {
                rank: "number",
                student_id: "string",
                name: "string",
                avatar_initials: "string",
                college: "string",
                role: "string",
                score_pct: "number",
                tests_checked: "number"
            }
        ],
        total_count: "number"
    }

Leaderboard UI Layout:
├── Title: "Standard Platform Leaderboard" (Global rankings evaluated across both testing and custom live projects)
├── Filter: "All Specialties" dropdown (Role selector)
└── List of All Registered Candidates
    ├── Medal/Rank number
    ├── Avatar + Name
    ├── College + Role
    ├── Score (%)
    ├── N TESTS CHECKED (stats)
    └── ">" button to view profile popup
```

### 15.3 Jobs & Applicants Center

```
Company creates job vacancy:
    → POST /companies/me/jobs
        Body: { title: "string", min_score: "number", location: "string", required_skills: "string[]", ... }

Jobs Center UI Layout:
├── Title: "Corporate Placements & Job Center"
├── Buttons:
│   ├── "Active Listings & Applicants"
│   └── "+ Post a New Vacancy"
│
└── Empty State (if no jobs):
    ├── Briefcase icon + "You haven't posted any opportunities yet."
    └── CTA: "List your first corporate opportunity →"
```

### 15.4 Student Placement Database

```
Company searches candidates directory:
    → GET /companies/me/database?search={string}&page=1
    
    Response: {
        results: [
            {
                student_id: "string",
                name: "string",
                email: "string",
                phone: "string",
                college: "string",
                matched_domain: "string",
                target_company: "string",
                score_pct: "number",
                completed_projects: "number"
            }
        ]
    }

Student Database UI Layout:
├── Title: "Student Placement Database" + "Export CSV" button
├── Search Bar: "Search students database by name, email, phone, college, skill..."
└── Data Table:
    ├── Columns:
    │   ├── STUDENT EMAIL (Name + Email)
    │   ├── PHONE
    │   ├── COLLEGE
    │   ├── MATCHED DOMAIN
    │   ├── TARGET COMPANY (Company Logo + Name)
    │   ├── SCORE (%)
    │   ├── COMPLETED PROJECTS (Count)
    │   └── ACTION ("View" button)
```

### 15.5 Candidate Detail View Popup

```
Triggered when clicking a candidate from Dashboard, Leaderboard, or Database.

GET /companies/candidates/:studentId
    → Fetches live candidate data.
    
    Response: {
        student_id: "string",
        name: "string",
        avatar_initials: "string",
        college: "string",
        email: "string",
        phone: "string",
        matched_developer_target: "string",
        skills_match_pct: "number",
        acquired_skills_portfolio: "string[]",
        github_url: "string"
    }

Candidate Detail Popup UI:
├── Profile Header: Avatar | Name | College | Email
├── Right Side: Skills Match % (large green number)
├── Matched Developer Target (Role text)
├── Acquired Skills Portfolio:
│   └── Tags with checkmarks (e.g., ✓ Java, ✓ Spring Boot, ✓ Docker)
│
├── Verified Contact Info:
│   └── Phone number with icon
│
└── Action Buttons:
    ├── "Request Interview" button (primary blue)
    └── "Candidate GitHub" button (secondary outline)
```

### 15.6 Browse Candidates Flow

```
GET /companies/me/browse?role={string}&min_score={string}&min_projects={string}&search={string}
    → Fetches candidate grid data based on filters.
    
    Response: {
        candidates: [
            {
                student_id: "string",
                name: "string",
                avatar_initials: "string",
                college: "string",
                skills: "string[]",
                additional_skills_count: "number",
                skill_index_pct: "number",
                tests_completed: "number",
                projects_completed: "number"
            }
        ]
    }

Browse Candidates UI Layout:
├── Top Filters Bar:
│   ├── TARGET ROLE (Dropdown, e.g., "All Specialties")
│   ├── MIN SKILL SCORE (Dropdown, e.g., "Any Rating")
│   ├── COMPLETED PROJECTS (Dropdown, e.g., "Any Projects")
│   └── DIRECT SEARCH (Text Input: "Search name, college, skill...")
│
└── Candidate Grid (2 columns of cards):
    Each Card:
    ├── Avatar (Initials inside circle)
    ├── Name + College
    ├── Skills Tags (e.g., [Java] [Spring Boot] [REST APIs] [+2 more])
    ├── Right Side: SKILL INDEX (% in large green text)
    └── Stats below index (e.g., "3 tests - 4 projects")
```

---

## 16. Updated Event Bus (New Events Added)

```
New events added on top of previous 17:

EVENT: project.posted (NEW)
  Publisher:  Company Portal → Recruiting Service
  Consumers:  Notification Service (notify eligible students)
  Payload:    { projectId, companyId, targetRoles[], visibility }

EVENT: project.submitted (NEW)
  Publisher:  Profile Service
  Consumers:  NLP Worker (trigger evaluation), Company Notification
  Payload:    { studentId, projectId, github_url }

EVENT: course.purchased (NEW)
  Publisher:  Payment Gateway webhook handler
  Consumers:  Finance Service (split calculation), LMS Service (grant access)
  Payload:    { studentId, courseId, amount, orderId }

EVENT: daily_assignments.generated (NEW)
  Publisher:  Daily Assignment Cron Job
  Consumers:  Notification Service
  Payload:    { studentId, date, task_count }

EVENT: task.completed (NEW)
  Publisher:  Daily Assignment Service
  Consumers:  AI Scoring Service (consistency factor update)
  Payload:    { studentId, taskId, task_type, date }

EVENT: job.applied (NEW)
  Publisher:  Recruiting Service
  Consumers:  Notification Service (notify company)
  Payload:    { studentId, jobId, companyId }

EVENT: benchmark.updated (NEW)
  Publisher:  Admin Service
  Consumers:  AI Scoring Service (batch recompute for role)
  Payload:    { roleId, updatedBy, changes[] }
```

---

## 17. Data Entities Added

```
New MongoDB collections:

CompanyCourse:
  { course_id, company_id, title, description, target_roles[], visibility,
    status (draft/published), created_at }

CompanyModule:
  { module_id, course_id, type, title, s3_url, youtube_url, order_index }

CreatorProfile:
  { creator_id (FK→User), name, bio, expertise[], linkedin, verified, created_at }

MarketplaceCourse:
  { course_id, creator_id, title, description, target_roles[], skills_covered[],
    price_inr, preview_url, status (pending/approved/rejected), avg_rating, created_at }

MarketplaceModule:
  { module_id, course_id, title, type, s3_key (private), order_index, duration_mins }

CourseEnrollment:
  { enrollment_id, student_id, course_id, source (marketplace/company), paid_at, amount }

CreatorEarning:
  { earning_id, creator_id, course_id, student_id, gross, platform_cut, net, payout_status }

CompanyProject:
  { project_id, company_id, title, description, required_skills[], difficulty,
    deadline_days, visibility, resources[], status (active/closed), created_at }

StudentProjectSubmission:
  { submission_id, student_id, project_id, github_url, demo_url, notes,
    nlp_score, verified_skills[], submitted_at, evaluation_status }

DailyAssignment:
  { assignment_id, student_id, date, tasks: JSONB, completed_count, generated_at }

CFProblemCache:
  { cf_id (contestId+index), name, rating, tags[], solved_count, fetched_at }

StudentCFHandle:
  { student_id, cf_handle, linked_at, last_synced_at, auto_credited_count }

JobApplication:
  { application_id, student_id, job_id, applied_at, status }
```

---

*SkillDipz Feature Spec v3.0 — Updated with real-time flows, merged Skill Tests + Code Practice,*  
*Company-assigned Projects, 3-source Video model, Creator Marketplace revenue system.*  
*No mock data. All flows wire to real APIs and real databases.*

---

## 18. Environment Configuration & Required API Keys

To support the architecture mapped above, the following `.env` schema and API keys are strictly required. This ensures the real-time AI and media flows function correctly in production.

```env
# ----------------------------------------------------
# 1. CORE DATABASES & CACHING
# ----------------------------------------------------
MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/skilldipz"
ELASTICSEARCH_URL="https://search-skilldipz-xxx.eu-central-1.es.amazonaws.com"
REDIS_URL="redis://<user>:<password>@cache.skilldipz.internal:6379"

# ----------------------------------------------------
# 2. AI & ML SERVICES
# ----------------------------------------------------
# Used by NLP Resume Parser & Mock Interview Grader
OPENAI_API_KEY="sk-..."
# Fallback / Specialized Models (if not using OpenAI for everything)
HUGGINGFACE_API_TOKEN="hf_..."

# ----------------------------------------------------
# 3. VIDEO & MEDIA (S3 + YouTube)
# ----------------------------------------------------
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET_NAME="skilldipz-media-prod"
AWS_REGION="ap-south-1"
AWS_CLOUDFRONT_DOMAIN="https://cdn.skilldipz.com"

# For fetching free recommended videos in the Roadmap
YOUTUBE_DATA_API_KEY="AIza..."

# ----------------------------------------------------
# 4. EXTERNAL EVALUATION APIs
# ----------------------------------------------------
# Codeforces API is public but we identify our agent to prevent rate limits
CODEFORCES_API_URL="https://codeforces.com/api"

# ----------------------------------------------------
# 5. PAYMENTS & AUTH
# ----------------------------------------------------
# For Creator Marketplace course purchases
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."

# JWT Auth
JWT_SECRET_KEY="super_secure_random_string"
JWT_ACCESS_EXPIRATION_MINUTES=30
```

### Schema Implementation Notes:
- **MongoDB:** Collections defined in Section 17 must be implemented using `Pydantic` models (if FastAPI) or `Mongoose` schemas (if NestJS), with strict type enforcement.
- **Code Execution:** If utilizing a sandbox (like Judge0) for Code Practice instead of purely relying on Codeforces, a `JUDGE0_API_URL` and `JUDGE0_API_KEY` will be required.
