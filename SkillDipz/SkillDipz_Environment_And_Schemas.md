# SkillDipz: Environment Config & Full Schemas

This document explicitly separates the environment configurations required for the Frontend and Backend applications, and defines the complete, full MongoDB Database Schemas required to run the platform.

---

## 1. Environment Configurations (API Keys)

### Backend (`.env`)
The backend strictly handles secrets, database connections, and AI integrations. These keys must NEVER be exposed to the client.

```env
# ----------------------------------------------------
# BACKEND CORE SERVICES
# ----------------------------------------------------
PORT=8000
NODE_ENV=development
MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/skilldipz"
ELASTICSEARCH_URL="https://search-skilldipz-xxx.eu-central-1.es.amazonaws.com"
REDIS_URL="redis://<user>:<password>@cache.skilldipz.internal:6379"

# ----------------------------------------------------
# SECURITY & AUTH
# ----------------------------------------------------
JWT_SECRET_KEY="super_secure_random_string"
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=7

# ----------------------------------------------------
# AI & EXTERNAL APIs
# ----------------------------------------------------
OPENAI_API_KEY="sk-..."                     # For Resume Parsing & Mock Interviews
HUGGINGFACE_API_TOKEN="hf_..."              # For backup NLP tasks
YOUTUBE_DATA_API_KEY="AIza..."              # For fetching free roadmap videos
CODEFORCES_API_URL="https://codeforces.com/api"

# ----------------------------------------------------
# AWS / S3 (Media & Resumes)
# ----------------------------------------------------
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET_NAME="skilldipz-media-prod"
AWS_REGION="ap-south-1"

# ----------------------------------------------------
# PAYMENTS
# ----------------------------------------------------
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
```

### Frontend (`.env.local`)
The Next.js web application and React Native mobile app require public-facing URLs to connect to the backend and load CDNs.

```env
# ----------------------------------------------------
# FRONTEND CONFIGURATION
# ----------------------------------------------------
# Main API connection
NEXT_PUBLIC_API_URL="https://api.skilldipz.com/v1"

# WebSocket connection for real-time scores and notifications
NEXT_PUBLIC_SOCKET_URL="wss://api.skilldipz.com/ws"

# CDN for loading images/videos fast (bypassing S3 limits)
NEXT_PUBLIC_AWS_CLOUDFRONT_DOMAIN="https://cdn.skilldipz.com"

# Public key for payments
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_..."
```

---

## 2. Full Database Schemas (MongoDB)

These are the strict schemas to implement (using Mongoose for Node.js or Pydantic/Beanie for FastAPI).

### 2.1 Core User & Auth
```json
// Collection: users
{
  "_id": "ObjectId",
  "email": { "type": "string", "required": true, "unique": true },
  "password_hash": { "type": "string", "required": true },
  "role": { "type": "string", "enum": ["STUDENT", "COMPANY", "CREATOR", "ADMIN"] },
  "is_verified": { "type": "boolean", "default": false },
  "created_at": { "type": "date", "default": "Date.now" }
}
```

### 2.2 Student Profile
```json
// Collection: student_profiles
{
  "_id": "ObjectId",
  "user_id": { "type": "ObjectId", "ref": "users" },
  "full_name": { "type": "string" },
  "college": { "type": "string" },
  "phone": { "type": "string" },
  "avatar_url": { "type": "string" },
  "resume_s3_key": { "type": "string" },
  
  "primary_role": { "type": "string" }, // e.g., "Java Backend Developer"
  
  "skills": { 
    "acquired": ["string"],
    "missing": ["string"]
  },
  
  "overall_score": { "type": "number", "default": 0 },
  "score_breakdown": {
    "coding": { "type": "number", "default": 0 },
    "project": { "type": "number", "default": 0 },
    "mock_interview": { "type": "number", "default": 0 },
    "learning": { "type": "number", "default": 0 }
  },

  "github_url": { "type": "string" },
  "visibility": { "type": "string", "enum": ["PUBLIC", "PRIVATE", "COMPANIES_ONLY"] }
}
```

### 2.3 Company Profile & Jobs
```json
// Collection: company_profiles
{
  "_id": "ObjectId",
  "user_id": { "type": "ObjectId", "ref": "users" },
  "company_name": { "type": "string" },
  "industry": { "type": "string" },
  "verification_status": { "type": "string", "enum": ["PENDING", "VERIFIED"] },
  "logo_url": { "type": "string" }
}

// Collection: job_requirements
{
  "_id": "ObjectId",
  "company_id": { "type": "ObjectId", "ref": "company_profiles" },
  "title": { "type": "string" },
  "role_id": { "type": "string" }, // e.g., "frontend-dev"
  "min_score": { "type": "number" },
  "location": { "type": "string" },
  "ctc_range": { "type": "string" },
  "required_skills": ["string"],
  "status": { "type": "string", "enum": ["ACTIVE", "CLOSED"] },
  "created_at": { "type": "date" }
}
```

### 2.4 Learning & Projects
```json
// Collection: courses (Unified for Company & Marketplace)
{
  "_id": "ObjectId",
  "creator_id": { "type": "ObjectId", "ref": "users" }, 
  "source_type": { "type": "string", "enum": ["COMPANY", "MARKETPLACE", "YOUTUBE"] },
  "title": { "type": "string" },
  "description": { "type": "string" },
  "target_roles": ["string"],
  "price": { "type": "number", "default": 0 },
  "modules": [
    {
      "title": { "type": "string" },
      "video_url": { "type": "string" }, // S3 or YouTube ID
      "duration_mins": { "type": "number" }
    }
  ]
}

// Collection: projects (Company-Assigned)
{
  "_id": "ObjectId",
  "company_id": { "type": "ObjectId", "ref": "company_profiles" },
  "title": { "type": "string" },
  "description": { "type": "string" },
  "required_skills": ["string"],
  "deadline_days": { "type": "number" }
}

// Collection: project_submissions
{
  "_id": "ObjectId",
  "student_id": { "type": "ObjectId", "ref": "student_profiles" },
  "project_id": { "type": "ObjectId", "ref": "projects" },
  "github_url": { "type": "string" },
  "demo_url": { "type": "string" },
  "nlp_evaluated_score": { "type": "number" },
  "status": { "type": "string", "enum": ["PENDING", "EVALUATED"] },
  "submitted_at": { "type": "date" }
}
```

### 2.5 Tests & Practice
```json
// Collection: skill_tests (MCQ & Concepts)
{
  "_id": "ObjectId",
  "title": { "type": "string" },
  "role_tag": { "type": "string" },
  "questions": [
    {
      "question_text": { "type": "string" },
      "options": ["string"],
      "correct_answer_index": { "type": "number" },
      "difficulty": { "type": "string", "enum": ["EASY", "MEDIUM", "HARD"] }
    }
  ]
}

// Collection: code_submissions (Codeforces / Internal Judge)
{
  "_id": "ObjectId",
  "student_id": { "type": "ObjectId", "ref": "student_profiles" },
  "problem_id": { "type": "string" }, // e.g., "158A"
  "language": { "type": "string" },
  "verdict": { "type": "string", "enum": ["ACCEPTED", "WRONG_ANSWER", "TIME_LIMIT"] },
  "execution_time_ms": { "type": "number" },
  "submitted_at": { "type": "date" }
}
}
```

---

## 3. Full API Endpoints Mapping

This is the complete list of REST and WebSocket endpoints for the SkillDipz Backend (FastAPI).

### 3.1 Auth & Onboarding
- `POST /v1/auth/register` - Create user account
- `POST /v1/auth/login` - Authenticate, return JWT
- `POST /v1/auth/resume-upload` - Upload resume to S3, trigger NLP parsing
- `GET  /v1/auth/me` - Get current user context

### 3.2 Student Features
- `GET  /v1/students/me/dashboard` - Get overall score, stats, upcoming tasks
- `GET  /v1/students/me/roadmap` - Get AI-generated learning roadmap
- `GET  /v1/students/me/roadmap/videos` - Fetch recommended videos for skill gaps
- `GET  /v1/students/me/skill-gap` - Analyze current skills vs target role
- `GET  /v1/students/me/activity` - Fetch recent activity feed
- `GET  /v1/students/me/notifications` - Fetch notification history

### 3.3 Practice & Tests (Unified)
- `GET  /v1/practice/mcq` - Fetch randomized skill tests
- `POST /v1/practice/mcq/submit` - Submit answers, evaluate score
- `GET  /v1/practice/coding/problems` - Fetch Codeforces / internal problems
- `POST /v1/practice/coding/submit` - Submit code for execution/evaluation

### 3.4 Projects & Mock Interviews
- `GET  /v1/projects` - List all company-assigned projects
- `POST /v1/projects/{id}/submit` - Submit GitHub link for NLP evaluation
- `POST /v1/interviews/session/start` - Initialize webcam, start AI recording
- `POST /v1/interviews/session/end` - Upload recording to S3, run Whisper/GPT grading

### 3.5 Company Portal
- `GET  /v1/companies/me/dashboard` - Company stats and talent pools
- `GET  /v1/companies/me/candidates` - Browse and search candidate directory
- `POST /v1/companies/me/jobs` - Post a new job/vacancy
- `GET  /v1/companies/candidates/{id}` - View specific student profile
- `POST /v1/companies/shortlist` - Shortlist a candidate

### 3.6 Leaderboard & WebSockets
- `GET  /v1/leaderboard` - Fetch global student ranking (Elasticsearch)
- `WS   /ws/live` - Real-time WebSocket connection for score updates and notifications

---

## 4. Full Monorepo Folder Structure

This is the exact folder structure required for the `SkillDipz` project, strictly separating the Next.js frontend and FastAPI backend.

```text
SkillDipz/
│
├── frontend/                     # Next.js Web Application
│   ├── .env.local                # Frontend secrets/configs
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── (auth)/           # Login, Register, Onboarding
│   │   │   ├── student/          # Student Portal pages
│   │   │   │   ├── overview/page.tsx       # Section 5: Dashboard Overview
│   │   │   │   ├── skill-gap/page.tsx      # Section 6: Skill Gap Analysis
│   │   │   │   ├── roadmap/page.tsx        # Section 7: Dynamic Roadmap & Videos
│   │   │   │   ├── target-company/page.tsx # Auto-Matched Company
│   │   │   │   ├── activity/page.tsx       # Real-Time Activity Feed
│   │   │   │   ├── jobs/page.tsx           # Section 13: Jobs Hub
│   │   │   │   ├── notifications/page.tsx  # Event Bus Notifications
│   │   │   │   ├── projects/page.tsx       # Section 11: Assigned Projects
│   │   │   │   ├── practice/page.tsx       # Section 9: Unified Code Practice & Skill Tests
│   │   │   │   ├── mock-interview/page.tsx # Section 10: Proctored Interviews
│   │   │   │   ├── assignments/page.tsx    # Section 8: Daily Assignments
│   │   │   │   ├── leaderboard/page.tsx    # Section 12: Global Leaderboard
│   │   │   │   └── profile/page.tsx        # My Profile Management
│   │   │   ├── company/          # Company Portal pages (Dashboard, Candidates, Jobs)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx          # Landing Page
│   │   ├── components/           # Reusable UI (Shadcn UI, Buttons, Cards)
│   │   │   ├── ui/               # Base components
│   │   │   ├── shared/           # Navigation, sidebars, headers
│   │   │   └── forms/            # Form components
│   │   ├── lib/                  # Utility functions
│   │   │   ├── api.ts            # Axios instances for backend communication
│   │   │   ├── utils.ts          # Tailwind merge utilities
│   │   │   └── socket.ts         # WebSocket client configuration
│   │   ├── hooks/                # Custom React hooks (useAuth, useScore)
│   │   └── store/                # Zustand / Redux state management
│   │       ├── userStore.ts
│   │       └── notificationStore.ts
│
└── backend/                      # FastAPI Python Application
    ├── .env                      # Backend strict secrets (MongoDB, AWS, OpenAI)
    ├── requirements.txt
    ├── main.py                   # FastAPI Application Entrypoint
    └── app/
        ├── api/                  # Route Definitions
        │   ├── routes/
        │   │   ├── auth.py
        │   │   ├── students.py
        │   │   ├── companies.py
        │   │   ├── practice.py
        │   │   └── websockets.py
        │   └── dependencies.py   # Auth guards, DB injections
        ├── core/                 # Application Configuration
        │   ├── config.py         # Pydantic BaseSettings for .env parsing
        │   ├── security.py       # JWT creation and hashing
        │   └── database.py       # MongoDB & Redis connection managers
        ├── models/               # MongoDB Database Models (Pydantic / Beanie)
        │   ├── user.py
        │   ├── student.py
        │   ├── company.py
        │   └── project.py
        ├── schemas/              # Pydantic Request/Response validation schemas
        │   ├── user_schema.py
        │   └── response_schema.py
        └── services/             # Core Business Logic & External APIs
            ├── ai_service.py     # OpenAI Resume Parsing & Interview Grading
            ├── codeforces.py     # Codeforces API integration
            ├── s3_service.py     # AWS Media Uploads
            └── email_service.py  # Notifications
```
