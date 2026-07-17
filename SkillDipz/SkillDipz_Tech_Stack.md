# SkillDipz Platform — Proposed Tech Stack

Based on the highly dynamic, real-time, and data-heavy architecture we just designed (Event Bus, Real-Time Leaderboards, AI Parsing, Proctored Video Interviews), here is the recommended modern tech stack to build SkillDipz.

> [!TIP]
> This stack is optimized for scalability (to handle 240,000+ students), real-time performance, and AI integration. 

## 1. Frontend (Web UI)
* **Framework:** **Next.js (React)** 
  * *Why:* Offers excellent SEO (for landing pages), fast server-side rendering (SSR), and seamless API integration.
* **Styling:** **Tailwind CSS + Shadcn UI** 
  * *Why:* Allows us to build that premium, dark-mode, glassmorphic UI rapidly while keeping the CSS bundle tiny.
* **State Management:** **Zustand** or **Redux Toolkit**
  * *Why:* Perfect for managing the complex global state of the user's dashboard and real-time score updates.
* **Real-Time Communication:** **Socket.io-client** or native **WebSockets**

## 2. Frontend (Mobile App)
* **Framework:** **React Native (with Expo)**
  * *Why:* Already referenced in our architecture. It allows us to share 80% of the business logic with the Next.js web app. Expo makes handling camera permissions (for AI interviews) and video playback (courses) incredibly easy.

## 3. Backend (API & Business Logic)
Given your current environment (I see you use Python/FastAPI for NeuralBase), we have two great options:

* **Option A: Python (FastAPI) — *Recommended for AI Heavy Apps***
  * *Why:* Since SkillDipz relies heavily on AI (Resume Parsing, AI Mock Interviews, Scoring Algorithms), Python is native to these ML libraries. FastAPI is incredibly fast and natively supports WebSockets.
* **Option B: Node.js (NestJS)**
  * *Why:* An enterprise-grade Node.js framework. Great for event-driven architectures. You could use NestJS for the main API and a small Python microservice specifically for the AI tasks.

## 4. Databases & Storage
* **Primary Database:** **MongoDB** (or **MySQL**)
  * *Why:* If PostgreSQL isn't an option, **MongoDB** is the perfect NoSQL alternative. It offers incredible flexibility for dynamic data (like student profiles and roadmaps) and scales effortlessly. If you strictly need a relational database, **MySQL** is the industry-standard alternative to Postgres.
* **Search & Leaderboard Engine:** **Elasticsearch** (or AWS OpenSearch)
  * *Why:* Essential for querying 240,000+ students instantly for the Global Leaderboard, and for companies to perform complex multi-filter candidate searches.
* **Caching Layer:** **Redis**
  * *Why:* To cache Codeforces API responses, temporarily store JWT refresh tokens, and manage WebSocket connection states.
* **Object Storage:** **AWS S3**
  * *Why:* For storing student resumes (PDFs), profile avatars, company-uploaded video courses, and proctoring webcam snapshots.

## 5. Event Bus / Message Queue (No Kafka Required)
* **Message Broker:** **Redis Streams** or **AWS SQS / SNS**
  * *Why:* If Kafka is too heavy or complex to manage, **Redis Streams** is built directly into Redis (which you already need for caching) and handles event-driven architecture beautifully with minimal setup. Alternatively, **AWS SQS** is a fully managed, serverless queue that requires zero maintenance.

## 6. AI & Third-Party Integrations
* **Video/Streaming:** **YouTube Data API v3** (for free courses) and **AWS CloudFront** (CDN for premium S3 videos).
* **AI NLP/Processing:** **OpenAI API** (or open-source LLMs via HuggingFace) for evaluating the transcript of the Mock Interview and parsing resume text.
* **Code Execution Sandbox:** **Judge0** or custom Docker Sandbox (for running submitted code securely).
* **Payment Gateway:** **Razorpay / Stripe** (for Creator Marketplace course purchases).
* **Proctoring (Client-Side):** **face-api.js** (for detecting faces in the browser during the mock interview).

---

### Summary of the "Alternative Stack" for SkillDipz:
**Next.js (Web) + React Native (Mobile) + FastAPI/NestJS (Backend) + MongoDB (DB) + Elasticsearch (Ranking) + Redis Streams (Events)**
