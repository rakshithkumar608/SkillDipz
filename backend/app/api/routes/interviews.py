# Interview Handles :
#  - Company scheduling interviews for students   (Mode A)
#  - Student joining / proctoring violation log   (Mode A + B)
#  - Session completion with score submission     (Mode A)
#  - AI-driven practice interviews                (Mode B)


import uuid
import logging
import json
import re
from typing import Optional, List, Literal
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_student, get_current_company
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.interview import InterviewSession, InterviewViolation, ProctoringReport, DetailedRubric
from app.models.employability_score import EmployabilityScore, ScoreHistory
from app.models.target_company import CompanyProfile
from app.models.student_profile import StudentProfile
from app.core.event_bus import event_bus
from app.core.config import settings
from app.core.ws_manager import ws_manager
from app.services.notification_service import send_notification

logger = logging.getLogger(__name__)

# Violation limits for auto-termination
TAB_SWITCH_LIMIT = 3
FULLSCREEN_EXIT_LIMIT = 2

router = APIRouter(prefix="/interviews", tags=["Interviews"])
ai_router = APIRouter(prefix="/ai-interview", tags=["AI Interview"])
company_router = APIRouter(prefix="/companies/me/interviews", tags=["Company Portal Interviews"])


def _get_groq_client():
    try:
        from groq import AsyncGroq
        return AsyncGroq(api_key=settings.GROQ_API_KEY)
    except Exception:
        return None

class ScheduleInterviewRequest(BaseModel):
    student_id: str
    job_id: Optional[str] = None
    interview_type: str = "technical"
    scheduled_at: datetime
    duration_mins: int = 45
    interviewer_name: Optional[str] = None
    video_call_url: Optional[str] = None
    proctoring_enabled: bool = True

class ViolationRequest(BaseModel):
    type: Literal[
        "tab_switch",
        "fullscreen_exit",
        "copy_attempt",
        "window_blur",
        "keyboard_shortcut",
        "context_menu",
        "no_face_detected",
        "multiple_faces",
        "screen_recording_attempt",
    ]
    timestamp: Optional[datetime] = None
    details: Optional[str] = None

class CompleteInterviewRequest(BaseModel):
    completed_by: Literal["interviewer", "student", "system", "mentor"] = "interviewer"
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    coding_score: Optional[float] = None
    overall_score: Optional[float] = None
    feedback: Optional[str] = None
    rubric: Optional[DetailedRubric] = None
    violations_count: Optional[int] = None
    proctoring_report: Optional[dict] = None


class AIStartRequest(BaseModel):
    company_key: str = Field(..., description="Company slug e.g. 'razorpay'")
    company_name: Optional[str] = None
    interview_type: Literal["technical", "hr"] = "technical"
    duration_mins: int = 45


class AIAnswerRequest(BaseModel):
    answer: str
    session_id: str



# MODE A - Company Schedules Interview

@company_router.post("/schedule", status_code=201)
@router.post("/schedule", status_code=201)
async def schedule_interview(
    body: ScheduleInterviewRequest,
    current_company: dict = Depends(get_current_company),
):
    company_id = current_company["company_id"]
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company:
        company_name = current_company.get("user", {}).company_name or company_id
    else:
        company_name = company.name

    session = InterviewSession(
        student_id=body.student_id,
        company_id=company_id,
        company_name=company_name,
        job_id=body.job_id,
        mode="company",
        interview_type=body.interview_type,
        scheduled_at=body.scheduled_at,
        duration_mins=body.duration_mins,
        interviewer_name=body.interviewer_name or "Senior Technical Interviewer",
        video_call_url=body.video_call_url,
        proctoring_enabled=body.proctoring_enabled,
        status="scheduled",
    )
    await session.insert()

    scheduled_str = body.scheduled_at.strftime("%b %d, %I:%M %p IST")
    await send_notification(
        student_id=body.student_id,
        title=f"{company_name} scheduled a {body.interview_type.title()} Interview",
        body=f"{company_name} scheduled a {body.interview_type.title()} Interview on {scheduled_str}. Fully proctored session.",
        action_url="/student/mock-interview",
        notification_type="interview_scheduled",
    )

    await event_bus.publish("interview.scheduled", {
        "session_id": session.session_id,
        "student_id": body.student_id,
        "company_id": company_id,
        "company_name": company_name,
        "interview_type": body.interview_type,
        "scheduled_at": body.scheduled_at.isoformat(),
    })

    return {
        "message": "Interview scheduled successfully",
        "session_id": session.session_id,
    }


@company_router.get("")
@company_router.get("/")
async def get_company_interviews(
    current_company: dict = Depends(get_current_company),
):
    company_id = current_company["company_id"]
    user_id = current_company.get("user_id", "")

    # Query all sessions created by / assigned to this company
    sessions = await InterviewSession.find(
        {"$or": [
            {"company_id": company_id},
            {"company_id": user_id},
        ]}
    ).sort(-InterviewSession.created_at).to_list(100)

    # Fetch candidate details for each session from StudentProfile
    student_ids = list({s.student_id for s in sessions if s.student_id})
    profiles = await StudentProfile.find({"student_id": {"$in": student_ids}}).to_list() if student_ids else []
    profile_map = {p.student_id: p for p in profiles}

    result = []
    for s in sessions:
        prof = profile_map.get(s.student_id)
        result.append({
            "session_id": s.session_id,
            "student_id": s.student_id,
            "student_name": prof.name if prof and prof.name else "Candidate",
            "student_email": prof.email if prof and prof.email else "",
            "student_college": prof.college if prof and prof.college else "",
            "target_role": prof.target_roles if prof and prof.target_roles else s.interview_type.title(),
            "interview_type": s.interview_type,
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
            "duration_mins": s.duration_mins,
            "interviewer_name": s.interviewer_name,
            "video_call_url": s.video_call_url,
            "status": s.status,
            "overall_score": s.overall_score,
            "feedback": s.feedback,
            "tab_switch_count": s.tab_switch_count,
            "fullscreen_exit_count": s.fullscreen_exit_count,
            "created_at": s.created_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        })

    return {"sessions": result, "total": len(result)}

def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/my")
async def get_my_interviews(
    current: dict = Depends(get_current_student),
):
    # Fetch all scheduled and practice mock interviews for the authenticated student
    student_id = current["student_id"]
    sessions = await InterviewSession.find(
        InterviewSession.student_id == student_id
    ).sort(-InterviewSession.created_at).to_list(100)

    now = datetime.now(timezone.utc)
    result = []
    for s in sessions:
        sched = _normalize_dt(s.scheduled_at)
        if (
            s.status == "scheduled"
            and sched
            and abs((now - sched).total_seconds()) <= 300
        ):
            s.status = "waiting"
            await s.save()

        result.append({
            "session_id": s.session_id,
            "mode": s.mode,
            "interview_type": s.interview_type,
            "company_name": s.company_name or s.target_company_name or "SkillDipz AI",
            "company_id": s.company_id,
            "interviewer_name": s.interviewer_name,
            "video_call_url": s.video_call_url,
            "scheduled_at": sched.isoformat() if sched else (s.scheduled_at.isoformat() if s.scheduled_at else None),
            "duration_mins": s.duration_mins,
            "status": s.status,
            "overall_score": s.overall_score,
            "feedback": s.feedback,
            "tab_switch_count": s.tab_switch_count,
            "fullscreen_exit_count": s.fullscreen_exit_count,
            "violations_total": len(s.violations),
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        })

    return {"sessions": result, "total": len(result)}


@router.get("/my/{session_id}")
async def get_session_detail(
    session_id: str,
    current: dict = Depends(get_current_student),
):
    student_id = current["student_id"]
    session = await InterviewSession.find_one(
        InterviewSession.session_id == session_id
    )
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "mode": session.mode,
        "interview_type": session.interview_type,
        "company_name": session.company_name or session.target_company_name,
        "company_key": session.company_key,
        "interviewer_name": session.interviewer_name,
        "video_call_url": session.video_call_url,
        "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
        "duration_mins": session.duration_mins,
        "status": session.status,
        "proctoring_enabled": session.proctoring_enabled,
        "tab_switch_count": session.tab_switch_count,
        "fullscreen_exit_count": session.fullscreen_exit_count,
        "violations": [v.model_dump() for v in session.violations],
        "overall_score": session.overall_score,
        "technical_score": session.technical_score,
        "communication_score": session.communication_score,
        "coding_score": session.coding_score,
        "feedback": session.feedback,
        "rubric": session.rubric.model_dump() if session.rubric else None,
        "recording_url": session.recording_url,
        "recording_duration_sec": session.recording_duration_sec,
        "mentor_id": session.mentor_id,
        "mentor_name": session.mentor_name,
        "transcript": session.transcript,
        "conversation": session.conversation,
        "question_count": session.question_count,
        "joined_at": session.joined_at.isoformat() if session.joined_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
    }


@router.post("/{session_id}/join")
async def join_interview(
    session_id: str,
    current: dict = Depends(get_current_student),
):
    student_id = current["student_id"]
    session = await InterviewSession.find_one(
        InterviewSession.session_id == session_id
    )
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status not in ("scheduled", "waiting", "in_progress"):
        raise HTTPException(
            status_code=400,
            detail=f"Session cannot be joined — current status: {session.status}",
        )

    session.status = "in_progress"
    session.joined_at = datetime.now(timezone.utc)
    await session.save()

    return {
        "message": "Joined successfully. Proctoring lockdown is now ACTIVE.",
        "session_id": session.session_id,
        "mode": session.mode,
        "interview_type": session.interview_type,
        "duration_mins": session.duration_mins,
        "video_call_url": session.video_call_url,
        "proctoring_enabled": session.proctoring_enabled,
    }


@router.post("/{session_id}/violation")
async def log_violation(
    session_id: str,
    body: ViolationRequest,
    current: dict = Depends(get_current_student),
):
    # Authoritative real-time violation logging endpoint.
    
    student_id = current["student_id"]
    session = await InterviewSession.find_one(
        InterviewSession.session_id == session_id
    )
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "in_progress":
        return {"message": "Session not active", "session_terminated": False}

    violation = InterviewViolation(
        type=body.type,
        timestamp=body.timestamp or datetime.now(timezone.utc),
        details=body.details,
    )
    session.violations.append(violation)

    if body.type == "tab_switch":
        session.tab_switch_count += 1
    elif body.type == "fullscreen_exit":
        session.fullscreen_exit_count += 1

    terminated = False
    termination_reason = None

    if session.tab_switch_count >= TAB_SWITCH_LIMIT:
        terminated = True
        termination_reason = f"Tab switched {session.tab_switch_count} times (limit: {TAB_SWITCH_LIMIT})"
    elif session.fullscreen_exit_count >= FULLSCREEN_EXIT_LIMIT:
        terminated = True
        termination_reason = f"Exited fullscreen {session.fullscreen_exit_count} times (limit: {FULLSCREEN_EXIT_LIMIT})"

    if terminated:
        session.status = "terminated"
        session.ended_at = datetime.now(timezone.utc)
        await session.save()

        await send_notification(
            student_id=student_id,
            title="Interview Terminated Due to Proctoring Violations",
            body=f"Your interview session was terminated: {termination_reason}.",
            action_url="/student/mock-interview",
            notification_type="interview_terminated",
        )

        await ws_manager.broadcast(
            student_id,
            "interview_terminated",
            {
                "session_id": session_id,
                "reason": termination_reason,
                "tab_switch_count": session.tab_switch_count,
                "fullscreen_exit_count": session.fullscreen_exit_count,
            },
        )

        await event_bus.publish("interview.terminated", {
            "session_id": session_id,
            "student_id": student_id,
            "reason": termination_reason,
        })
    else:
        await session.save()

    return {
        "session_terminated": terminated,
        "termination_reason": termination_reason,
        "tab_switch_count": session.tab_switch_count,
        "fullscreen_exit_count": session.fullscreen_exit_count,
        "total_violations": len(session.violations),
        "tab_switch_remaining": max(0, TAB_SWITCH_LIMIT - session.tab_switch_count),
        "fullscreen_exit_remaining": max(0, FULLSCREEN_EXIT_LIMIT - session.fullscreen_exit_count),
    }


@router.post("/{session_id}/complete")
async def complete_interview(
    session_id: str,
    body: CompleteInterviewRequest,
    current_user: User = Depends(get_current_user),
):
    session = await InterviewSession.find_one(
        InterviewSession.session_id == session_id
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user.id)
    is_student = session.student_id == user_id
    is_company = (
        current_user.role in ("company", "company_admin", "admin")
        and (session.company_id == (current_user.company_name or user_id) or current_user.role == "admin")
    )

    if not is_student and not is_company:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to complete this session",
        )

    if session.status in ("completed", "terminated", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Session is already {session.status}",
        )

    if body.overall_score is None and any([
        body.technical_score, body.communication_score, body.coding_score
    ]):
        scores = [s for s in [
            body.technical_score, body.communication_score, body.coding_score
        ] if s is not None]
        body.overall_score = round(sum(scores) / len(scores), 1)

    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    session.technical_score = body.technical_score
    session.communication_score = body.communication_score
    session.coding_score = body.coding_score
    session.overall_score = body.overall_score
    if body.rubric:
        session.rubric = body.rubric

    if body.proctoring_report:
        session.proctoring_report = ProctoringReport(**body.proctoring_report)

    await session.save()

    await event_bus.publish("interview.completed", {
        "session_id": session_id,
        "student_id": session.student_id,
        "overall_score": body.overall_score,
        "feedback": body.feedback,
        "mode": session.mode,
        "company_name": session.company_name or session.target_company_name or "SkillDipz AI",
    })

    return {
        "message": "Interview completed successfully",
        "session_id": session_id,
        "overall_score": body.overall_score,
    }


# Video Recording Upload Endpoint
@router.post("/{session_id}/recording")
async def upload_interview_recording(
    session_id: str,
    file: UploadFile = File(...),
    duration_sec: Optional[float] = Form(None),
    current_student: dict = Depends(get_current_student),
):
    student_id = current_student["student_id"]
    session = await InterviewSession.find_one(InterviewSession.session_id == session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")

    recordings_dir = settings.UPLOAD_DIR / "recordings"
    recordings_dir.mkdir(parents=True, exist_ok=True)

    timestamp = int(datetime.now(timezone.utc).timestamp())
    clean_filename = file.filename.replace(" ", "_") if file.filename else "interview_recording.webm"
    storage_key = f"rec_{session_id}_{timestamp}_{clean_filename}"
    file_path = recordings_dir / storage_key

    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty recording file")

    file_path.write_bytes(content)

    public_url = f"/v1/uploads/recordings/{storage_key}"
    session.recording_url = public_url
    session.storage_key = storage_key
    session.recording_file_path = str(file_path)
    session.mime_type = file.content_type or "video/webm"
    session.recording_duration_sec = duration_sec
    session.recording_file_size = file_size
    session.recorded_at = datetime.now(timezone.utc)
    session.recording_status = "ready"
    await session.save()

    return {
        "message": "Recording uploaded successfully and metadata persisted to database",
        "session_id": session_id,
        "student_id": student_id,
        "recording_url": public_url,
        "storage_key": storage_key,
        "mime_type": session.mime_type,
        "duration": duration_sec,
        "file_size": file_size,
        "recorded_at": session.recorded_at.isoformat(),
        "status": session.recording_status,
    }


# Structured Rubric Feedback Submission Endpoint
@router.post("/{session_id}/rubric-feedback")
async def submit_rubric_feedback(
    session_id: str,
    rubric: DetailedRubric,
    current_user: User = Depends(get_current_user),
):
    session = await InterviewSession.find_one(InterviewSession.session_id == session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.rubric = rubric
    # Calculate overall score if rubric scores are populated
    score_components = [
        rubric.dsa_problem_solving,
        rubric.system_architecture,
        rubric.behavioral_culture_fit,
        rubric.code_quality,
        rubric.communication_clarity,
    ]
    valid_scores = [s for s in score_components if s is not None]
    if valid_scores:
        session.overall_score = round(sum(valid_scores) / len(valid_scores), 1)

    await session.save()

    return {
        "message": "Rubric feedback submitted successfully",
        "overall_score": session.overall_score,
        "rubric": session.rubric,
    }


# MODE B — AI PRACTICE INTERVIEW (GROQ DRIVEN) 

def _build_system_prompt(company_key: str, interview_type: str, duration_mins: int) -> str:
    company_prompts = {
        "razorpay": "Senior Technical Lead at Razorpay. Focus on distributed systems, payment architecture, idempotency, microservices, and database transaction locks.",
        "flipkart": "Senior Software Architect at Flipkart. Focus on high-concurrency systems, flash sale scalability, Kafka event streams, and DSA optimization.",
        "google": "Staff Software Engineer at Google. Focus on algorithmic perfection, time/space complexity analysis, system design at global scale, and clean modular code.",
        "amazon": "Principal Engineer at Amazon. Focus on Amazon Leadership Principles (Customer Obsession, Deep Dive, Ownership), Object-Oriented Design, and AWS infrastructure.",
        "zomato": "Tech Lead at Zomato. Focus on real-time location matching, dispatch algorithms, websocket connections, and caching layer design.",
        "swiggy": "Senior Backend Lead at Swiggy. Focus on delivery routing optimization, Redis caching, microservices resiliency, and real-time order state engines.",
    }
    context = company_prompts.get(company_key.lower(), "Senior Technical Interviewer at a premier technology company.")

    if interview_type == "hr":
        return f"""You are an elite HR / Culture Fit Interviewer. {context}
Total Interview Length: 7 sequential questions.
Your behavior rules:
1. Evaluate candidate's previous response with 1 encouraging sentence.
2. Ask ONE focused, realistic HR question at a time using the STAR framework (Situation, Task, Action, Result).
3. Cover: leadership, teamwork under pressure, conflict resolution, career ambitions, and adaptability.
4. CRITICAL: Do NOT wrap up or say 'interview completed' until question 7 is reached! Keep asking follow-up questions."""
    else:
        return f"""You are a world-class Senior Technical Interviewer. {context}
Total Interview Length: 7 sequential technical questions.
Your behavior rules:
1. Acknowledge candidate's answer with 1 sentence of technical assessment or feedback.
2. Ask ONE targeted technical follow-up question at a time. Progress from core fundamentals -> system design -> data structures/algorithms -> concurrency & databases -> real-world debugging scenarios.
3. Keep your questions sharp, professional, and challenging.
4. CRITICAL: Do NOT say 'We have completed all interview modules' or end early! Ask question N of 7 sequentially."""


@ai_router.post("/start", status_code=201)
async def start_ai_interview(
    body: AIStartRequest,
    current: dict = Depends(get_current_student),
):
    student_id = current["student_id"]
    session = InterviewSession(
        student_id=student_id,
        mode="ai",
        company_key=body.company_key,
        target_company_name=body.company_name or body.company_key.title(),
        interview_type=body.interview_type,
        duration_mins=body.duration_mins,
        proctoring_enabled=True,
        status="in_progress",
        joined_at=datetime.now(timezone.utc),
    )
    await session.insert()

    system_prompt = _build_system_prompt(body.company_key, body.interview_type, body.duration_mins)
    groq = _get_groq_client()
    first_message = "Hello, I am ready to begin the interview."
    initial_ai_message = f"Welcome to your proctored {body.interview_type.title()} interview for {session.target_company_name}! To begin, please introduce yourself, your technical background, and your key projects."

    if groq and settings.GROQ_API_KEY:
        try:
            resp = await groq.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": first_message},
                ],
                max_tokens=300,
                temperature=0.7,
            )
            initial_ai_message = resp.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Groq API call error: {e}")

    session.conversation = [
        {"role": "user", "content": first_message},
        {"role": "ai", "content": initial_ai_message},
    ]
    session.question_count = 1
    await session.save()

    return {
        "session_id": session.session_id,
        "mode": "ai",
        "interview_type": body.interview_type,
        "company_name": session.target_company_name,
        "duration_mins": body.duration_mins,
        "proctoring_enabled": True,
        "first_question": initial_ai_message,
        "question_number": 1,
        "status": "in_progress",
    }


def _get_fallback_question(company_name: str, interview_type: str, q_num: int, answer: str) -> str:
    """Intelligent fallback question generator when LLM API is unreachable."""
    if q_num >= 7:
        return f"Thank you for sharing your technical insights. That completes our 7-question proctored interview module for {company_name}. We will evaluate your overall performance now."

    tech_questions = {
        2: f"Great! Coming to core architecture at {company_name}, how do you design your backend services for high concurrency and thread safety?",
        3: f"Understood. When building scalable data pipelines at {company_name}, how do you handle database indexing, transaction locks, and query optimization?",
        4: f"Thanks. How do you implement caching strategies (such as Redis) and handle cache invalidation and stampede issues in production?",
        5: f"Good points. Can you walk me through a complex technical problem or bug you solved in your recent projects using Python or fullstack tools?",
        6: f"Excellent. How do you design microservices for resiliency, circuit breaking, and event-driven messaging using systems like Kafka or RabbitMQ?",
        7: f"Thank you for your responses! That wraps up our technical deep-dive for {company_name}. Do you have any questions for the team?",
    }

    hr_questions = {
        2: f"Thanks for introducing yourself! Tell me about a time you faced a tight deadline or conflicting priorities. How did you handle it?",
        3: f"Good insight. Can you share an instance where you disagreed with a teammate or lead on a technical approach? How was it resolved?",
        4: f"Great. Describe a project where you had to take complete ownership from design to deployment. What were the key challenges?",
        5: f"Understood. How do you handle constructive feedback or sudden changes in project requirements?",
        6: f"What specifically attracts you to work with our team at {company_name}, and where do you see your technical growth in the next 2 years?",
        7: f"Thank you! That completes our HR assessment for {company_name}. We appreciate your time today!",
    }

    q_map = hr_questions if interview_type == "hr" else tech_questions
    return q_map.get(q_num, f"Thank you. Let's move on to the next question for {company_name}: Can you elaborate on your experience with automated testing and CI/CD pipelines?")


@ai_router.post("/{session_id}/answer")
async def submit_ai_answer(
    session_id: str,
    body: AIAnswerRequest,
    current: dict = Depends(get_current_student),
):
    student_id = current["student_id"]
    session = await InterviewSession.find_one(InterviewSession.session_id == session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"Session is currently {session.status}")

    MAX_QUESTIONS = 7

    # Append user's answer
    session.conversation.append({"role": "user", "content": body.answer})

    # Increment question turn count
    next_q_num = session.question_count + 1
    interview_over = next_q_num > MAX_QUESTIONS

    company_name = session.target_company_name or session.company_key or "SkillDipz AI"
    ai_response = _get_fallback_question(company_name, session.interview_type, next_q_num, body.answer)

    groq = _get_groq_client()
    if groq and settings.GROQ_API_KEY:
        try:
            # Build System Prompt with explicit turn context
            system_prompt = (
                _build_system_prompt(session.company_key or "default", session.interview_type, session.duration_mins)
                + f"\n\nCURRENT STATUS: Candidate just submitted answer to question {session.question_count} of {MAX_QUESTIONS}."
            )

            if interview_over:
                system_prompt += "\nThis is the FINAL TURN. Thank the candidate, provide a brief wrap-up evaluation, and conclude the interview."
            else:
                system_prompt += f"\nYou must now ask QUESTION {next_q_num} of {MAX_QUESTIONS}. Give 1 brief sentence acknowledging their answer, then ask your next technical question."

            # Construct clean OpenAI/Groq messages array with SYSTEM at index 0 ONLY
            messages = [{"role": "system", "content": system_prompt}]
            for turn in session.conversation:
                # Ensure only 'user' or 'assistant' roles are passed in history
                if turn.get("role") in ("user", "ai", "assistant"):
                    role = "assistant" if turn["role"] == "ai" else turn["role"]
                    messages.append({"role": role, "content": turn["content"]})

            resp = await groq.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                max_tokens=350,
                temperature=0.7,
            )
            llm_text = resp.choices[0].message.content.strip()
            if llm_text:
                ai_response = llm_text
        except Exception as e:
            logger.warning(f"Groq turn API error: {e}")

    session.conversation.append({"role": "ai", "content": ai_response})
    session.question_count = next_q_num

    if interview_over:
        score_data = await _evaluate_ai_interview(session)
        session.overall_score = score_data["overall"]
        session.technical_score = score_data.get("technical")
        session.communication_score = score_data.get("communication")
        session.coding_score = score_data.get("coding")
        session.feedback = score_data.get("feedback", "Completed proctored practice session.")
        session.rubric = score_data.get("rubric")
        session.transcript = _format_transcript(session.conversation)
        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        await session.save()

        await event_bus.publish("interview.completed", {
            "session_id": session_id,
            "student_id": student_id,
            "overall_score": session.overall_score,
            "feedback": session.feedback,
            "mode": "ai",
            "company_name": company_name,
            "rubric": session.rubric.model_dump() if session.rubric else None,
        })

        return {
            "ai_message": ai_response,
            "question_number": session.question_count,
            "interview_complete": True,
            "overall_score": session.overall_score,
            "feedback": session.feedback,
            "transcript": session.transcript,
            "rubric": session.rubric.model_dump() if session.rubric else None,
        }

    await session.save()
    return {
        "ai_message": ai_response,
        "question_number": session.question_count,
        "interview_complete": False,
    }


@ai_router.post("/{session_id}/violation")
async def log_ai_violation(
    session_id: str,
    body: ViolationRequest,
    current: dict = Depends(get_current_student),
):
    # Direct alias for AI interview violation logging.
    return await log_violation(session_id, body, current)


async def _evaluate_ai_interview(session: InterviewSession) -> dict:
    groq = _get_groq_client()
    default_rubric = DetailedRubric(
        dsa_problem_solving=75.0,
        system_architecture=74.0,
        behavioral_culture_fit=78.0,
        code_quality=76.0,
        communication_clarity=75.0,
        key_strengths=[
            "Clear technical introduction and articulation of past projects.",
            "Demonstrated solid understanding of core software principles.",
        ],
        improvement_areas=[
            "Can deepen explanations with concrete time/space complexity analysis.",
            "Include more specific edge cases when explaining architectural decisions.",
        ],
        actionable_recommendations=[
            "Practice explaining concurrency locks and distributed transactions.",
            "Review the STAR framework for behavioral and leadership scenarios.",
        ],
    )

    if not groq or not settings.GROQ_API_KEY:
        return {
            "overall": 75.6,
            "technical": 75.0,
            "communication": 76.0,
            "coding": 76.0,
            "feedback": "Completed proctored session with solid technical demonstration across core competencies.",
            "rubric": default_rubric,
        }

    transcript = _format_transcript(session.conversation)
    eval_prompt = f"""You are a Principal Engineering Interviewer evaluating a candidate for {session.target_company_name}.
Interview Type: {session.interview_type}

Transcript:
{transcript[:4000]}

Evaluate the candidate across these 5 strict industry factors (0-100 float each):
1. dsa_problem_solving
2. system_architecture
3. behavioral_culture_fit
4. code_quality
5. communication_clarity

Return JSON ONLY in this exact structure with NO surrounding markdown or backticks:
{{
  "overall": 78.5,
  "technical": 80.0,
  "communication": 78.0,
  "coding": 76.0,
  "feedback": "Comprehensive summary paragraph of the candidate's performance...",
  "rubric": {{
    "dsa_problem_solving": 80.0,
    "system_architecture": 75.0,
    "behavioral_culture_fit": 82.0,
    "code_quality": 77.0,
    "communication_clarity": 79.0,
    "key_strengths": ["Clear communication under pressure", "Good understanding of caching mechanisms"],
    "improvement_areas": ["Needs more depth in distributed locks", "Could structure answers with STAR"],
    "actionable_recommendations": ["Review Redis cache stampede mitigation", "Practice 3 mock system design scenarios"]
  }}
}}"""

    try:
        resp = await groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": eval_prompt}],
            max_tokens=600,
            temperature=0.2,
        )
        content = resp.choices[0].message.content.strip()
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            res = json.loads(match.group())
            rubric_dict = res.get("rubric", {})
            rubric_obj = DetailedRubric(
                dsa_problem_solving=float(rubric_dict.get("dsa_problem_solving", 75.0)),
                system_architecture=float(rubric_dict.get("system_architecture", 75.0)),
                behavioral_culture_fit=float(rubric_dict.get("behavioral_culture_fit", 78.0)),
                code_quality=float(rubric_dict.get("code_quality", 75.0)),
                communication_clarity=float(rubric_dict.get("communication_clarity", 75.0)),
                key_strengths=rubric_dict.get("key_strengths", default_rubric.key_strengths),
                improvement_areas=rubric_dict.get("improvement_areas", default_rubric.improvement_areas),
                actionable_recommendations=rubric_dict.get("actionable_recommendations", default_rubric.actionable_recommendations),
            )
            return {
                "overall": float(res.get("overall", 76.0)),
                "technical": float(res.get("technical", 75.0)),
                "communication": float(res.get("communication", 75.0)),
                "coding": float(res.get("coding", 75.0)),
                "feedback": str(res.get("feedback", "Solid technical demonstration.")),
                "rubric": rubric_obj,
            }
    except Exception as e:
        logger.warning(f"AI Evaluation parsing failed: {e}")

    return {
        "overall": 75.0,
        "technical": 75.0,
        "communication": 75.0,
        "coding": 75.0,
        "feedback": "Session complete. Good technical articulation.",
        "rubric": default_rubric,
    }


def _format_transcript(conversation: list) -> str:
    out = []
    for turn in conversation:
        role = "Interviewer" if turn["role"] == "ai" else "Candidate"
        out.append(f"[{role}]: {turn['content']}")
    return "\n\n".join(out)