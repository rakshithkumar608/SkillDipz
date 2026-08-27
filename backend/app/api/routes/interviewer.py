from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.api.dependencies import get_current_interviewer, get_current_admin
from app.models.user import User
from app.models.interview import InterviewSession, DetailedRubric
from app.models.student_profile import StudentProfile
from app.core.security import hash_password, get_password_hash
from app.core.event_bus import event_bus

router = APIRouter(prefix="/interviewer", tags=["Interviewer Portal"])
admin_interviewer_router = APIRouter(prefix="/admin", tags=["Admin Interviewer Management"])


# ─── PYDANTIC SCHEMAS ────────────────────────────────────────────────────────

class CreateInterviewerRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class AssignInterviewRequest(BaseModel):
    interviewer_id: str


class SubmitReviewRequest(BaseModel):
    overall_score: float = Field(..., ge=0, le=100)
    feedback: str
    rubric: Optional[DetailedRubric] = None


# ─── INTERVIEWER DASHBOARD ENDPOINTS (Authenticated via Session) ─────────────

@router.get("/interviews")
async def get_interviewer_assigned_interviews(
    current: dict = Depends(get_current_interviewer),
):
    """
    Retrieve all real mock interviews assigned to the authenticated interviewer.
    Loads real MongoDB documents. Does NOT use mock data.
    """
    interviewer_id = current["interviewer_id"]

    # Query assigned sessions from MongoDB
    sessions = await InterviewSession.find(
        InterviewSession.assigned_interviewer_id == interviewer_id
    ).sort(-InterviewSession.created_at).to_list(200)

    if not sessions:
        return {
            "assigned": [],
            "pending": [],
            "completed": [],
            "total": 0,
            "interviewer": {
                "id": interviewer_id,
                "name": current.get("full_name"),
                "email": current.get("email"),
            },
        }

    # Fetch real student profiles for candidate names & colleges
    student_ids = list({s.student_id for s in sessions if s.student_id})
    profiles = (
        await StudentProfile.find({"student_id": {"$in": student_ids}}).to_list()
        if student_ids
        else []
    )
    profile_map = {p.student_id: p for p in profiles}

    assigned_list = []
    pending_list = []
    completed_list = []

    for s in sessions:
        prof = profile_map.get(s.student_id)
        candidate_name = prof.name if prof and prof.name else "Candidate"
        candidate_college = prof.college if prof and prof.college else ""
        candidate_email = prof.email if prof and prof.email else ""

        item = {
            "session_id": s.session_id,
            "student_id": s.student_id,
            "student_name": candidate_name,
            "student_college": candidate_college,
            "student_email": candidate_email,
            "interview_type": s.interview_type,
            "mode": s.mode,
            "company_name": s.company_name or s.target_company_name or "SkillDipz Assessment",
            "duration_mins": s.duration_mins,
            "status": s.status,
            "review_status": s.review_status,
            "recording_url": s.recording_url,
            "recording_duration_sec": s.recording_duration_sec,
            "recording_file_size": s.recording_file_size,
            "assigned_at": s.assigned_at.isoformat() if s.assigned_at else None,
            "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
            "overall_score": s.interviewer_score or s.overall_score,
            "interviewer_feedback": s.interviewer_feedback or s.feedback,
            "rubric": s.interviewer_rubric.model_dump() if s.interviewer_rubric else (s.rubric.model_dump() if s.rubric else None),
            "transcript": s.transcript,
            "tab_switch_count": s.tab_switch_count,
            "fullscreen_exit_count": s.fullscreen_exit_count,
            "created_at": s.created_at.isoformat(),
        }

        assigned_list.append(item)
        if s.review_status == "reviewed":
            completed_list.append(item)
        else:
            pending_list.append(item)

    return {
        "assigned": assigned_list,
        "pending": pending_list,
        "completed": completed_list,
        "total": len(assigned_list),
        "interviewer": {
            "id": interviewer_id,
            "name": current.get("full_name"),
            "email": current.get("email"),
        },
    }


@router.get("/interviews/{session_id}")
async def get_interviewer_session_detail(
    session_id: str,
    current: dict = Depends(get_current_interviewer),
):
    """
    Retrieve full session for evaluation.
    Enforces authorization: interviewer can only access their assigned interviews.
    """
    interviewer_id = current["interviewer_id"]
    user = current.get("user")
    is_admin = (user.role or "").upper() == "ADMIN" if user else False

    session = await InterviewSession.find_one(InterviewSession.session_id == session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    if session.assigned_interviewer_id != interviewer_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to evaluate this interview session.",
        )

    # Fetch student profile
    profile = await StudentProfile.find_one(StudentProfile.student_id == session.student_id)

    return {
        "session": session,
        "candidate": {
            "name": profile.name if profile else "Candidate",
            "email": profile.email if profile else "",
            "college": profile.college if profile else "",
            "phone": profile.phone if profile else "",
            "target_roles": profile.target_roles if profile else [],
        },
    }


@router.post("/interviews/{session_id}/review")
async def submit_interviewer_review(
    session_id: str,
    body: SubmitReviewRequest,
    current: dict = Depends(get_current_interviewer),
):
    """
    Submit real score, feedback, and 5-factor competency rubric for an assigned mock interview.
    """
    interviewer_id = current["interviewer_id"]
    user = current.get("user")
    is_admin = (user.role or "").upper() == "ADMIN" if user else False

    session = await InterviewSession.find_one(InterviewSession.session_id == session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    if session.assigned_interviewer_id != interviewer_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to submit reviews for this session.",
        )

    now = datetime.now(timezone.utc)
    session.interviewer_score = body.overall_score
    session.interviewer_feedback = body.feedback
    session.interviewer_rubric = body.rubric
    session.review_status = "reviewed"
    session.reviewed_at = now

    # Also update primary score & rubric
    session.overall_score = body.overall_score
    session.feedback = body.feedback
    if body.rubric:
        session.rubric = body.rubric

    await session.save()

    # Broadcast event
    await event_bus.publish("interview.reviewed", {
        "session_id": session_id,
        "student_id": session.student_id,
        "interviewer_id": interviewer_id,
        "overall_score": body.overall_score,
        "reviewed_at": now.isoformat(),
    })

    return {
        "message": "Interview evaluation submitted successfully.",
        "session_id": session_id,
        "review_status": session.review_status,
        "overall_score": session.overall_score,
        "reviewed_at": session.reviewed_at.isoformat(),
    }


# ─── ADMIN INTERVIEWER & ASSIGNMENT MANAGEMENT ───────────────────────────────

@admin_interviewer_router.get("/interviewers")
async def list_registered_interviewers():
    """
    List all real registered interviewers from MongoDB.
    """
    users = await User.find({"role": {"$in": ["INTERVIEWER", "interviewer"]}}).to_list(100)
    return {
        "interviewers": [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": len(users),
    }


@admin_interviewer_router.post("/interviewers", status_code=201)
async def create_real_interviewer(
    body: CreateInterviewerRequest,
):
    """
    Admin registers and authorizes a real interviewer account in MongoDB.
    """
    existing = await User.find_one(User.email == body.email.lower().strip())
    if existing:
        if existing.role == "INTERVIEWER":
            return {"message": "User is already an active interviewer", "interviewer_id": str(existing.id)}
        existing.role = "INTERVIEWER"
        existing.full_name = body.full_name
        existing.password_hash = get_password_hash(body.password)
        existing.is_verified = True
        await existing.save()
        return {
            "message": "User role updated to INTERVIEWER",
            "interviewer_id": str(existing.id),
            "email": existing.email,
            "full_name": existing.full_name,
        }

    interviewer = User(
        email=body.email.lower().strip(),
        password_hash=get_password_hash(body.password),
        role="INTERVIEWER",
        full_name=body.full_name,
        is_verified=True,
    )
    await interviewer.insert()

    return {
        "message": "Real interviewer account created successfully",
        "interviewer_id": str(interviewer.id),
        "email": interviewer.email,
        "full_name": interviewer.full_name,
    }


@admin_interviewer_router.get("/interviews/assignable")
async def list_assignable_mock_interviews():
    """
    List real completed mock interviews available for interviewer assignment.
    """
    sessions = await InterviewSession.find(
        {"status": {"$in": ["completed", "terminated", "in_progress", "scheduled", "waiting"]}}
    ).sort(-InterviewSession.created_at).to_list(150)

    # Fetch candidate profiles
    student_ids = list({s.student_id for s in sessions if s.student_id})
    profiles = (
        await StudentProfile.find({"student_id": {"$in": student_ids}}).to_list()
        if student_ids
        else []
    )
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
            "interview_type": s.interview_type,
            "mode": s.mode,
            "duration_mins": s.duration_mins,
            "status": s.status,
            "review_status": s.review_status,
            "assigned_interviewer_id": s.assigned_interviewer_id,
            "assigned_interviewer_name": s.assigned_interviewer_name,
            "assigned_at": s.assigned_at.isoformat() if s.assigned_at else None,
            "recording_url": s.recording_url,
            "created_at": s.created_at.isoformat(),
        })

    return {"interviews": result, "total": len(result)}


@admin_interviewer_router.post("/interviews/{session_id}/assign")
async def assign_interview_to_interviewer(
    session_id: str,
    body: AssignInterviewRequest,
):
    """
    Admin assigns a real mock interview session to a real authorized interviewer.
    Stores assignment in MongoDB.
    """
    session = await InterviewSession.find_one(InterviewSession.session_id == session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    # Validate interviewer from MongoDB
    interviewer = await User.get(body.interviewer_id)
    if not interviewer or (interviewer.role or "").upper() not in ("INTERVIEWER", "ADMIN"):
        raise HTTPException(
            status_code=400,
            detail="Selected user is not an authorized interviewer in the database.",
        )

    session.assigned_interviewer_id = str(interviewer.id)
    session.assigned_interviewer_name = interviewer.full_name
    session.assigned_interviewer_email = interviewer.email
    session.assigned_at = datetime.now(timezone.utc)
    session.review_status = "assigned"

    await session.save()

    return {
        "message": f"Interview successfully assigned to interviewer {interviewer.full_name}.",
        "session_id": session_id,
        "assigned_interviewer_id": session.assigned_interviewer_id,
        "assigned_interviewer_name": session.assigned_interviewer_name,
        "review_status": session.review_status,
        "assigned_at": session.assigned_at.isoformat(),
    }
