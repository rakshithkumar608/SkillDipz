import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.employability_score import EmployabilityScore, ScoreHistory
from app.models.roadmap import StudentRoadmap
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.student_streak import StudentStreak
from app.models.skill_gap import StudentSkillLevel, RoleSkillBenchmark
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["Students"])

# Response schemas

class ScoreHistoryItem(BaseModel):
    score: float
    recorded_at: datetime

class ScoreComponentsOut(BaseModel):
    resume_quality: float
    assessment_score: float
    project_strength: float
    interview_readiness: float
    activity_consistency: float

class ScoreOut(BaseModel):
    student_id: str
    overall_score: float
    components: ScoreComponentsOut
    target_role: Optional[str]
    last_updated: datetime
    history: List[ScoreHistoryItem]
    is_empty: bool


class RoadmapSummaryOut(BaseModel):
    student_id: str
    resume_uploaded: bool
    role: Optional[str]
    progress_pct: int
    total_skills: int
    completed_skills: int
    next_skill: Optional[str]
    last_regenerated: Optional[datetime]

class NotificationItem(BaseModel):
    id: str
    title: str
    body: str
    action_url: Optional[str]
    is_read: bool
    created_at: datetime


class NotificationsOut(BaseModel):
    unread_count: int
    items: List[NotificationItem]


class ActivityItem(BaseModel):
    id: str
    type: str
    title: str
    detail: str
    created_at: datetime


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_active: Optional[str]


class SkillGapItem(BaseModel):
    skill: str
    current: int
    required: int
    gap: int
    priority: int

class SkillGapOut(BaseModel):
    role: str
    acquired_skills: List[str]
    skill_gaps: List[SkillGapItem]
    overall_match_pct: float


#  Score
@router.get("/me/score", response_model=ScoreOut)
async def get_my_score(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await EmployabilityScore.get_or_create(student_id)

    overall = doc.compute_overall()
    if overall != doc.overall_score:
        doc.overall_score = overall
        doc.last_updated = datetime.now(timezone.utc)
        await doc.save()

    return ScoreOut(
        student_id=student_id,
        overall_score=overall,
        components=ScoreComponentsOut(
            resume_quality=doc.components.resume_quality,
            assessment_score=doc.components.assessment_score,
            project_strength=doc.components.project_strength,
            interview_readiness=doc.components.interview_readiness,
            activity_consistency=doc.components.activity_consistency,
        ),
        target_role=doc.target_role,
        last_updated=doc.last_updated,
        history=[
            ScoreHistoryItem(score=h.score, recorded_at=h.recorded_at)
            for h in doc.history[-7:]
        ],
        is_empty=overall == 0.0,
    )


class ScoreUpdatePayload(BaseModel):
    resume_quality: Optional[float] = None
    assessment_score: Optional[float] = None
    project_strength: Optional[float] = None
    interview_readiness: Optional[float] = None
    activity_consistency: Optional[float] = None
    target_role: Optional[str] = None


@router.patch("/me/score", response_model=ScoreOut)
async def update_score(
    body: ScoreUpdatePayload,
    current_user: User = Depends(get_current_user),
):
    """
    Called by AI scoring workers when a component changes.
    Recalculates overall and pushes real-time WS event.
    """
    student_id = str(current_user.id)
    doc = await EmployabilityScore.get_or_create(student_id)

    if body.resume_quality is not None:
        doc.components.resume_quality = body.resume_quality
    if body.assessment_score is not None:
        doc.components.assessment_score = body.assessment_score
    if body.project_strength is not None:
        doc.components.project_strength = body.project_strength
    if body.interview_readiness is not None:
        doc.components.interview_readiness = body.interview_readiness
    if body.activity_consistency is not None:
        doc.components.activity_consistency = body.activity_consistency
    if body.target_role is not None:
        doc.target_role = body.target_role

    new_overall = doc.compute_overall()
    doc.overall_score = new_overall
    doc.last_updated = datetime.now(timezone.utc)
    doc.history.append(ScoreHistory(score=new_overall))
    doc.history = doc.history[-7:]
    await doc.save()

    # Push real-time WS event
    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": doc.components.model_dump(),
            "last_updated": doc.last_updated.isoformat(),
        },
    )

    return await get_my_score(current_user)


# Roadmap Summary

@router.get("/me/roadmap-summary", response_model=RoadmapSummaryOut)
async def get_roadmap_summary(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await StudentRoadmap.get_or_create(student_id)
    return RoadmapSummaryOut(
        student_id=student_id,
        resume_uploaded=doc.resume_uploaded,
        role=doc.role,
        progress_pct=doc.progress_pct,
        total_skills=doc.total_skills,
        completed_skills=doc.completed_skills,
        next_skill=doc.next_skill,
        last_regenerated=doc.last_regenerated,
    )

#  Resume Upload 

ALLOWED_RESUME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB
RESUME_DIR = Path("uploads") / "resumes"


class ResumeUploadOut(BaseModel):
    message: str
    file_name: str
    resume_uploaded: bool


@router.post("/me/resume", response_model=ResumeUploadOut)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a student resume (PDF / DOC / DOCX, max 5 MB).
    Saves to disk under uploads/resumes/ and marks resume_uploaded=True.
    """
    # Validate content-type
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF or Word (.doc / .docx) files are accepted.",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 5 MB.")

    # Build a safe file name: <student_id>_<uuid>.<ext>
    ext = Path(file.filename or "resume").suffix.lower() or ".pdf"
    safe_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"

    # Ensure directory exists
    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    dest = RESUME_DIR / safe_name

    dest.write_bytes(contents)
    logger.info(f"Resume saved: {dest}")

    # Update roadmap document
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    roadmap.resume_uploaded = True
    roadmap.resume_file_path = str(dest)
    await roadmap.save()

    return ResumeUploadOut(
        message="Resume uploaded successfully.",
        file_name=safe_name,
        resume_uploaded=True,
    )


# Notifications

@router.get("/me/notifications", response_model=NotificationsOut)
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    items = (
        await Notification.find(Notification.student_id == student_id)
        .sort(-Notification.created_at)
        .limit(limit)
        .to_list()
    )
    unread = sum(1 for n in items if not n.is_read)
    return NotificationsOut(
        unread_count=unread,
        items=[
            NotificationItem(
                id=str(n.id),
                title=n.title,
                body=n.body,
                action_url=n.action_url,
                is_read=n.is_read,
                created_at=n.created_at,
            )
            for n in items
        ],
    )


@router.patch("/me/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    from beanie import PydanticObjectId
    notif = await Notification.get(PydanticObjectId(notification_id))
    if not notif or str(notif.student_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = True
    await notif.save()
    return {"message": "Marked as read."}


@router.patch("/me/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    unread = await Notification.find(
        Notification.student_id == student_id,
        Notification.is_read == False,  # noqa: E712
    ).to_list()
    for n in unread:
        n.is_read = True
        await n.save()
    return {"message": f"Marked {len(unread)} notifications as read."}


# Activity

@router.get("/me/activity", response_model=List[ActivityItem])
async def get_activity(
    limit: int = Query(5, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    logs = (
        await ActivityLog.find(ActivityLog.student_id == student_id)
        .sort(-ActivityLog.created_at)
        .limit(limit)
        .to_list()
    )
    return [
        ActivityItem(
            id=str(l.id),
            type=l.type,
            title=l.title,
            detail=l.detail,
            created_at=l.created_at,
        )
        for l in logs
    ]


# Streak

@router.get("/me/streak", response_model=StreakOut)
async def get_streak(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await StudentStreak.get_or_create(student_id)
    return StreakOut(
        current_streak=doc.current_streak,
        longest_streak=doc.longest_streak,
        last_active=str(doc.last_active) if doc.last_active else None,
    )


# Skill Gap Analysis 

@router.get("/me/skill-gap", response_model=SkillGapOut)
async def get_skill_gap(current_user: User = Depends(get_current_user)):
    """
    Computes the student's skill gaps against their target role.
    Returns acquired skills and remaining gaps sorted by priority.
    """
    student_id = str(current_user.id)

    # 1. Get student's target role from their score document
    score_doc = await EmployabilityScore.get_or_create(student_id)
    roadmap_doc = await StudentRoadmap.get_or_create(student_id)

    target_role = score_doc.target_role or roadmap_doc.role
    if not target_role:
        return SkillGapOut(
            role="No target role set",
            acquired_skills=[],
            skill_gaps=[],
            overall_match_pct=0.0,
        )

    # 2. Fetch all student skill levels
    student_skills = await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id
    ).to_list()
    skill_map = {s.skill.lower(): s.current_level for s in student_skills}

    # 3. Fetch all role benchmarks for the target role
    benchmarks = await RoleSkillBenchmark.find(
        RoleSkillBenchmark.role == target_role
    ).sort(RoleSkillBenchmark.priority).to_list()

    if not benchmarks:
        # No benchmarks defined yet for this role
        return SkillGapOut(
            role=target_role,
            acquired_skills=list(skill_map.keys()),
            skill_gaps=[],
            overall_match_pct=0.0,
        )

    # 4. Compute gaps
    acquired = []
    gaps = []

    total_required = 0
    total_current = 0

    for bm in benchmarks:
        current = skill_map.get(bm.skill.lower(), 0)
        gap = max(0, bm.required_level - current)
        total_required += bm.required_level
        total_current += min(current, bm.required_level)

        if gap == 0:
            acquired.append(bm.skill)
        else:
            gaps.append(SkillGapItem(
                skill=bm.skill,
                current=current,
                required=bm.required_level,
                gap=gap,
                priority=bm.priority,
            ))

    # Sort gaps: largest gap first, then by priority
    gaps.sort(key=lambda g: (-g.gap, g.priority))

    # Overall match percentage
    match_pct = round((total_current / total_required) * 100, 1) if total_required > 0 else 0.0

    return SkillGapOut(
        role=target_role,
        acquired_skills=acquired,
        skill_gaps=gaps,
        overall_match_pct=match_pct,
    )