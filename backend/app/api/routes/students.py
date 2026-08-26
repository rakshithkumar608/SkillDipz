import logging
import uuid
import re
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel


from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.employability_score import EmployabilityScore, ScoreHistory
from app.models.roadmap import StudentRoadmap
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.student_streak import StudentStreak
from app.models.skill_gap import StudentSkillLevel, RoleSkillBenchmark
from app.models.student_profile import StudentProfile
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["Students"])

# Response schemas


class ScoreHistoryItem(BaseModel):
    score: float
    recorded_at: datetime


class ScoreComponentsOut(BaseModel):
    resume_quality: float
    skill_tests: float
    practice: float
    learning_roadmap: float
    project_strength: float
    activity_consistency: float
    # Backward compatibility
    assessment_score: Optional[float] = 0.0
    interview_readiness: Optional[float] = 0.0


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
    notification_type: str
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

class CalendarOut(BaseModel):
    dates: dict[str, int]
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


def _compute_streak(active_dates: set[date]) -> tuple[int, int, Optional[date]]:
    if not active_dates:
        return 0, 0, None

    today = datetime.now(timezone.utc).date()
    sorted_dates = sorted(active_dates, reverse=True)
    last_active = sorted_dates[0]

    # Current streak: walk backwards from today (or yesterday if not active yet today)
    current = 0
    if last_active < today - timedelta(days=1):
        current = 0
    else:
        check = today if today in active_dates else today - timedelta(days=1)
        while check in active_dates:
            current += 1
            check -= timedelta(days=1)

    # Longest streak: find max consecutive day sequence
    longest = 0
    run = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i - 1] - sorted_dates[i]).days == 1:
            run += 1
        else:
            longest = max(longest, run)
            run = 1
    longest = max(longest, run, current)

    return current, longest, last_active


async def _get_all_student_active_dates(student_id: str) -> set[date]:
    active_dates: set[date] = set()

    # 1. ActivityLog
    logs = await ActivityLog.find(ActivityLog.student_id == student_id).to_list()
    for log in logs:
        if log.created_at:
            active_dates.add(log.created_at.date())

    # 2. Assessment Results
    try:
        from app.models.assessment import AssessmentResult
        results = await AssessmentResult.find(AssessmentResult.student_id == student_id).to_list()
        for r in results:
            if r.taken_at:
                active_dates.add(r.taken_at.date())
    except Exception:
        pass

    # 3. Daily Assignments
    try:
        from app.models.daily_assignment import DailyAssignment
        assignments = await DailyAssignment.find(DailyAssignment.student_id == student_id).to_list()
        for a in assignments:
            if any(t.status == "completed" for t in a.tasks):
                try:
                    active_dates.add(date.fromisoformat(a.date))
                except Exception:
                    pass
            for t in a.tasks:
                if t.status == "completed" and t.completed_at:
                    active_dates.add(t.completed_at.date())
    except Exception:
        pass

    # 4. Arena Attempts & Sessions
    try:
        from app.models.arena import ArenaAttempt, ArenaSession
        attempts = await ArenaAttempt.find(ArenaAttempt.student_id == student_id).to_list()
        for att in attempts:
            if att.date_str:
                try:
                    active_dates.add(date.fromisoformat(att.date_str))
                except Exception:
                    pass
        sessions = await ArenaSession.find(
            ArenaSession.student_id == student_id,
            ArenaSession.status == "completed",
        ).to_list()
        for s in sessions:
            if s.completed_at:
                active_dates.add(s.completed_at.date())
    except Exception:
        pass

    # 5. Coding Solved Problems
    try:
        from app.models.coding_question import CodingSolvedProblem
        solved = await CodingSolvedProblem.find(CodingSolvedProblem.student_id == student_id).to_list()
        for sp in solved:
            if sp.solved_at:
                active_dates.add(sp.solved_at.date())
    except Exception:
        pass

    # 6. Project Submissions
    try:
        from app.models.project_submission import StudentProjectSubmission
        subs = await StudentProjectSubmission.find(StudentProjectSubmission.student_id == student_id).to_list()
        for sub in subs:
            if sub.submitted_at:
                active_dates.add(sub.submitted_at.date())
    except Exception:
        pass

    return active_dates


async def sync_student_streak(student_id: str) -> tuple[int, int, Optional[date]]:
    """Synchronize the StudentStreak document dynamically based on all real student activities."""
    active_dates = await _get_all_student_active_dates(student_id)
    current, longest, last_active = _compute_streak(active_dates)

    streak_doc = await StudentStreak.get_or_create(student_id)
    if (
        streak_doc.current_streak != current
        or streak_doc.longest_streak != longest
        or streak_doc.last_active != last_active
    ):
        streak_doc.current_streak = current
        streak_doc.longest_streak = longest
        streak_doc.last_active = last_active
        await streak_doc.save()

    return current, longest, last_active


async def compute_realtime_score(student_id: str) -> EmployabilityScore:
    """
    Computes all 6 Skill Indices dynamically from actual database records:
    1. Resume Quality (15%): Profile completeness and resume upload status.
    2. Skill Tests (20%): Average score percentage of completed skill tests from AssessmentResult.
    3. Practice (15%): Total solved coding challenges (LeetCode + Codeforces + Daily Assignment tasks).
    4. Learning Roadmap (20%): Progress percentage from StudentRoadmap.
    5. Projects (15%): Evaluated project submissions (NLP score) and personal projects.
    6. Consistency (15%): Dynamic calculation from user's current streak and 14-day activity frequency.
    """
    doc = await EmployabilityScore.get_or_create(student_id)
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)

    if prof and prof.target_roles and doc.target_role != prof.target_roles:
        doc.target_role = prof.target_roles

    # 1. Resume Quality (0-100%)
    resume_up = bool((prof and prof.resume_file_path) or (roadmap and roadmap.resume_uploaded))
    if prof:
        completeness_pts = prof.compute_completeness()  # 0 to 10
        if resume_up:
            resume_val = min(100.0, max(60.0, float(completeness_pts * 10)))
        else:
            resume_val = float(completeness_pts * 10)
    elif resume_up:
        resume_val = 70.0
    else:
        resume_val = 0.0

    # 2. Skill Tests & Practice (Total Questions in MCQ + Coding vs Solved by Student)
    from app.models.assessment import (
        AssessmentTopic,
        AssessmentResult,
        CodingQuestion,
        CodingSolvedProblem,
        CFSolvedProblem,
    )
    from app.models.daily_assignment import DailyAssignment

    # Total MCQ questions across all active topics in database
    active_topics = await AssessmentTopic.find(AssessmentTopic.is_active == True).to_list()
    total_mcq_questions = sum(t.question_count for t in active_topics) if active_topics else 0

    # Total MCQ questions correctly solved by this student
    test_results = await AssessmentResult.find(AssessmentResult.student_id == student_id).to_list()
    mcq_correct_solved = sum(r.correct_count for r in test_results) if test_results else 0

    # Total Coding questions available in database
    total_coding_questions = await CodingQuestion.find(CodingQuestion.is_active == True).count()

    # Total Coding problems solved by this student (LeetCode + Codeforces + Daily Tasks)
    coding_count = await CodingSolvedProblem.find(CodingSolvedProblem.student_id == student_id).count()
    cf_count = await CFSolvedProblem.find(CFSolvedProblem.student_id == student_id).count()
    assignment_docs = await DailyAssignment.find(DailyAssignment.student_id == student_id).to_list()
    assignment_completed_tasks = sum(
        1 for a in assignment_docs for task in a.tasks if getattr(task, "status", "") == "completed"
    )
    total_coding_solved = coding_count + cf_count + assignment_completed_tasks

    # Calculate real percentage solved out of all questions available
    total_available_questions = total_mcq_questions + total_coding_questions
    total_solved_questions = mcq_correct_solved + total_coding_solved

    if total_available_questions > 0 and total_solved_questions > 0:
        skill_tests_val = min(100.0, round((total_solved_questions / total_available_questions) * 100.0, 1))
    elif total_solved_questions > 0:
        skill_tests_val = min(100.0, round(total_solved_questions * 5.0, 1))
    else:
        skill_tests_val = 0.0

    # 3. Learning Roadmap (0-100%)
    if roadmap and roadmap.total_skills > 0:
        roadmap_val = round((roadmap.completed_skills / roadmap.total_skills) * 100.0, 1)
    elif roadmap and roadmap.progress_pct:
        roadmap_val = float(roadmap.progress_pct)
    else:
        roadmap_val = 0.0

    # 4. Projects (0-100%) — ONLY if submitted in database
    from app.models.project import StudentProjectSubmission
    submissions = await StudentProjectSubmission.find(StudentProjectSubmission.student_id == student_id).to_list()
    if submissions:
        evaluated_scores = [sub.nlp_score * 100.0 for sub in submissions if sub.nlp_score is not None]
        if evaluated_scores:
            projects_val = round(sum(evaluated_scores) / len(evaluated_scores), 1)
        else:
            projects_val = 0.0
    else:
        projects_val = 0.0  # Zero percentage if no project submitted

    # 5. Consistency (0-100%)
    current_streak, longest_streak, last_active = await sync_student_streak(student_id)
    logs = await ActivityLog.find(ActivityLog.student_id == student_id).to_list()
    active_dates = {log.created_at.date() for log in logs}
    today = datetime.now(timezone.utc).date()
    past_14_days_active = sum(1 for d in active_dates if (today - d).days <= 14)

    if active_dates:
        streak_pts = min(50.0, current_streak * 7.15)
        freq_pts = min(50.0, (past_14_days_active / 7.0) * 50.0)
        consistency_val = round(min(100.0, streak_pts + freq_pts), 1)
    else:
        consistency_val = 0.0

    # Update doc components
    doc.components.resume_quality = resume_val
    doc.components.skill_tests = skill_tests_val
    doc.components.practice = round((total_coding_solved / max(1, total_coding_questions)) * 100.0, 1) if total_coding_questions > 0 else 0.0
    doc.components.learning_roadmap = roadmap_val
    doc.components.project_strength = projects_val
    doc.components.activity_consistency = consistency_val
    doc.components.assessment_score = skill_tests_val
    doc.components.interview_readiness = 0.0

    overall = doc.compute_overall()
    if overall != doc.overall_score:
        doc.overall_score = overall
        doc.last_updated = datetime.now(timezone.utc)
        doc.history.append(ScoreHistory(score=overall))
        doc.history = doc.history[-7:]
        await doc.save()

        # Broadcast real-time score update to active WebSockets
        try:
            await ws_manager.broadcast(
                student_id,
                "score_update",
                {
                    "overall_score": overall,
                    "components": doc.components.model_dump(),
                    "last_updated": doc.last_updated.isoformat(),
                },
            )
        except Exception as e:
            logger.warning(f"Could not broadcast score update: {e}")
    else:
        await doc.save()

    return doc


#  Score
@router.get("/me/score", response_model=ScoreOut)
async def get_my_score(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await compute_realtime_score(student_id)
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)

    return ScoreOut(
        student_id=student_id,
        overall_score=doc.overall_score,
        components=ScoreComponentsOut(
            resume_quality=doc.components.resume_quality,
            skill_tests=doc.components.skill_tests,
            practice=doc.components.practice,
            learning_roadmap=doc.components.learning_roadmap,
            project_strength=doc.components.project_strength,
            activity_consistency=doc.components.activity_consistency,
            assessment_score=doc.components.skill_tests,
            interview_readiness=doc.components.interview_readiness,
        ),
        target_role=doc.target_role or (prof.target_roles if prof else None),
        last_updated=doc.last_updated,
        history=[
            ScoreHistoryItem(score=h.score, recorded_at=h.recorded_at)
            for h in doc.history[-7:]
        ],
        is_empty=doc.overall_score == 0.0,
    )


class ScoreUpdatePayload(BaseModel):
    resume_quality: Optional[float] = None
    skill_tests: Optional[float] = None
    practice: Optional[float] = None
    learning_roadmap: Optional[float] = None
    project_strength: Optional[float] = None
    activity_consistency: Optional[float] = None
    target_role: Optional[str] = None
    # Backward compatibility
    assessment_score: Optional[float] = None
    interview_readiness: Optional[float] = None


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
    if body.skill_tests is not None:
        doc.components.skill_tests = body.skill_tests
    elif body.assessment_score is not None:
        doc.components.skill_tests = body.assessment_score
    if body.practice is not None:
        doc.components.practice = body.practice
    if body.learning_roadmap is not None:
        doc.components.learning_roadmap = body.learning_roadmap
    if body.project_strength is not None:
        doc.components.project_strength = body.project_strength
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
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if prof and prof.target_roles and not doc.role:
        doc.role = prof.target_roles
        await doc.save()
    return RoadmapSummaryOut(
        student_id=student_id,
        resume_uploaded=doc.resume_uploaded,
        role=doc.role or (prof.target_roles if prof else None),
        progress_pct=doc.progress_pct,
        total_skills=doc.total_skills,
        completed_skills=doc.completed_skills,
        next_skill=doc.next_skill,
        last_regenerated=doc.last_regenerated,
    )

# Resume Upload & Skill Analysis

ALLOWED_RESUME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB
RESUME_DIR = settings.UPLOAD_DIR / "resumes"


class ResumeUploadOut(BaseModel):
    message: str
    file_name: str
    resume_uploaded: bool
    skills_extracted: List[str]


def _extract_skills_from_text(text: str) -> List[str]:
    import re
    known_skills = [
        "React", "Next.js", "Vue", "Angular", "JavaScript", "TypeScript",
        "Node.js", "Express", "Python", "FastAPI", "Django", "Flask", "Java", "Spring Boot",
        "C++", "C#", ".NET", "Go", "Rust", "PHP", "Laravel", "HTML", "CSS", "Tailwind",
        "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST API",
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "GitHub", "CI/CD",
        "Linux", "Data Structures", "Algorithms", "Machine Learning", "TensorFlow",
        "PyTorch", "Pandas", "NumPy", "System Design", "Agile", "Kotlin", "Swift",
        "Flutter", "React Native", "Firebase", "Scikit-learn", "Spark",
    ]
    # Special patterns for skills that break simple word-boundary regex
    special_patterns: dict[str, str] = {
        "C++":     r"c\+\+",
        "C#":      r"c#",
        ".NET":    r"\.net",
        "CI/CD":   r"ci/cd",
        "REST API": r"rest\s+api",
        "Node.js": r"node\.js",
        "Next.js": r"next\.js",
        "React Native": r"react\s+native",
        "Spring Boot": r"spring\s+boot",
        "Data Structures": r"data\s+structures",
        "Machine Learning": r"machine\s+learning",
        "System Design": r"system\s+design",
        "Scikit-learn": r"scikit[- ]learn",
    }
    text_lower = text.lower()
    found = []
    for skill in known_skills:
        if skill in special_patterns:
            pattern = special_patterns[skill]
        else:
            pattern = r"(?<![a-zA-Z])" + re.escape(skill.lower()) + r"(?![a-zA-Z])"
        if re.search(pattern, text_lower):
            found.append(skill)
    return found


def _parse_resume_text(contents: bytes, filename: str) -> str:
    import io
    text = ""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(contents))
            for page in reader.pages:
                text += page.extract_text() or ""
        except Exception:
            text = contents.decode("latin-1", errors="ignore")
    elif ext in [".docx", ".doc"]:
        try:
            import docx
            doc = docx.Document(io.BytesIO(contents))
            text = "\n".join([p.text for p in doc.paragraphs])
        except Exception:
            text = contents.decode("utf-8", errors="ignore")
    else:
        text = contents.decode("utf-8", errors="ignore")
    return text


@router.post("/me/resume", response_model=ResumeUploadOut)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a student resume (PDF / DOC / DOCX, max 5 MB).
    Saves to disk and extracts real skills into database.
    """
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF or Word (.doc / .docx) files are accepted.",
        )

    contents = await file.read()
    if len(contents) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 5 MB.")

    ext = Path(file.filename or "resume").suffix.lower() or ".pdf"
    safe_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"

    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    dest = RESUME_DIR / safe_name
    dest.write_bytes(contents)
    logger.info(f"Resume saved: {dest}")

    # Real text extraction and skill analysis
    raw_text = _parse_resume_text(contents, file.filename or "resume.pdf")
    extracted_skills = _extract_skills_from_text(raw_text)

    student_id = str(current_user.id)

    # Replace skills entirely — delete old resume skills, insert fresh ones
    await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id,
        StudentSkillLevel.source == "resume",
    ).delete()

    for skill_name in extracted_skills:
        await StudentSkillLevel(
            student_id=student_id,
            skill=skill_name,
            current_level=3,  # Baseline level parsed from resume
            source="resume"
        ).insert()

    # Also replace the skills list on the profile document
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if profile:
        profile.skills = list(extracted_skills)
        await profile.save()

    # Update roadmap document — reset phases so roadmap rebuilds from new resume
    roadmap = await StudentRoadmap.get_or_create(student_id)
    roadmap.resume_uploaded = True
    roadmap.resume_file_path = str(dest)
    if profile and profile.target_roles:
        roadmap.role = profile.target_roles
    roadmap.phases = []
    roadmap.last_regenerated = None
    roadmap.progress_pct = 0
    roadmap.completed_skills = 0
    roadmap.total_skills = 0
    roadmap.next_skill = None
    await roadmap.save()

    # Update resume_quality score based on real extracted skills count
    score_doc = await EmployabilityScore.get_or_create(student_id)
    if profile and profile.target_roles:
        score_doc.target_role = profile.target_roles
    quality_score = min(100.0, float(len(extracted_skills)
                        * 15 + 40)) if extracted_skills else 50.0
    score_doc.components.resume_quality = quality_score
    new_overall = score_doc.compute_overall()
    score_doc.overall_score = new_overall
    score_doc.last_updated = datetime.now(timezone.utc)
    await score_doc.save()

    # Log Activity
    activity_detail = f"Extracted {len(extracted_skills)} skills: {', '.join(extracted_skills[:4])}" if extracted_skills else "Resume parsed."
    await ActivityLog(
        student_id=student_id,
        type="resume",
        title="Resume Parsed & Analyzed",
        detail=activity_detail
    ).insert()

    # Create Notification
    await Notification(
        student_id=student_id,
        title="Resume Processing Complete",
        body=f"Your resume was processed. Found {len(extracted_skills)} skills.",
        action_url="/student/skill-gap"
    ).insert()

    # Push real-time WS updates
    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": score_doc.components.model_dump(),
            "last_updated": score_doc.last_updated.isoformat(),
        },
    )

    await ws_manager.broadcast(
        student_id,
        "skill_gap_update",
        {
            "skills_extracted": extracted_skills,
            "count": len(extracted_skills)
        }
    )

    return ResumeUploadOut(
        message="Resume uploaded and analyzed successfully.",
        file_name=safe_name,
        resume_uploaded=True,
        skills_extracted=extracted_skills,
    )


# Notifications

@router.get("/me/notifications", response_model=NotificationsOut)
async def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread: bool = Query(False, description="Return only unread notifications when true"),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    query = Notification.find(Notification.student_id == student_id)
    if unread:
        query = query.find(Notification.is_read == False)


    items = (
        await query
        .sort(-Notification.created_at)
        .limit(limit)
        .to_list()
    )
    unread = sum(1 for n in items if not n.is_read)

    def _to_utc(dt: Optional[datetime]) -> datetime:
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    return NotificationsOut(
        unread_count=unread,
        items=[
            NotificationItem(
                id=str(n.id),
                title=n.title,
                body=n.body,
                action_url=n.action_url,
                is_read=n.is_read,
                notification_type=getattr(n, "notification_type", "general"),
                created_at=_to_utc(n.created_at),
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

# Activity

@router.get("/me/activity", response_model=List[ActivityItem])
async def get_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    skip = (page - 1) * limit
    logs = (
        await ActivityLog.find(ActivityLog.student_id == student_id)
        .sort(-ActivityLog.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )
    return [
        ActivityItem(
            id=str(log.id),
            type=log.type,
            title=log.title,
            detail=log.detail,
            created_at=log.created_at,
        )
        for log in logs
    ]


class ActivityLogBody(BaseModel):
    type: Literal["submission", "assessment", "shortlist", "module", "interview", "project", "resume"]
    title: str
    detail: str = ""


@router.post("/me/activity/log", status_code=201)
async def log_activity(
    body: ActivityLogBody,
    current_user: User = Depends(get_current_user),
):
    """
    Generic activity logger — used by frontend modules to record student solves/activities.
    Syncs streak and recalculates employability score dynamically in real-time.
    """
    student_id = str(current_user.id)
    await ActivityLog(
        student_id=student_id,
        type=body.type,
        title=body.title,
        detail=body.detail,
    ).insert()

    # Sync streak and real-time score
    await sync_student_streak(student_id)
    await compute_realtime_score(student_id)

    return {"message": "Activity logged."}


# Streak

@router.get("/me/streak", response_model=StreakOut)
async def get_streak(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    current, longest, last_active = await sync_student_streak(student_id)

    return StreakOut(
        current_streak=current,
        longest_streak=longest,
        last_active=str(last_active) if last_active else None,
    )

@router.get("/me/activity/calendar", response_model=CalendarOut)
async def get_activity_calendar(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    active_dates = await _get_all_student_active_dates(student_id)

    # Aggregate counts per date
    counts: dict[str, int] = {}
    logs = await ActivityLog.find(
        ActivityLog.student_id == student_id,
        ActivityLog.created_at >= cutoff,
    ).to_list()
    for log in logs:
        d = log.created_at.date()
        key = str(d)
        counts[key] = counts.get(key, 0) + 1

    # Ensure every active date has at least count 1
    for d in active_dates:
        key = str(d)
        if key not in counts:
            counts[key] = 1

    current, longest, last_active = _compute_streak(active_dates)

    # Keep StudentStreak document in sync
    streak_doc = await StudentStreak.get_or_create(student_id)
    if (
        streak_doc.current_streak != current
        or streak_doc.longest_streak != longest
        or streak_doc.last_active != last_active
    ):
        streak_doc.current_streak = current
        streak_doc.longest_streak = longest
        streak_doc.last_active = last_active
        await streak_doc.save()

    return CalendarOut(
        dates=counts,
        current_streak=current,
        longest_streak=longest,
        last_active=str(last_active) if last_active else None,
    )
    

# Skill Gap Analysis

@router.get("/me/skill-gap", response_model=SkillGapOut)
async def get_skill_gap(current_user: User = Depends(get_current_user)):
    """
    Computes the student's real skill gaps against role benchmarks.
    Queries pure database records with no mock data.
    """
    student_id = str(current_user.id)

    # 1. Get student's target role
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    roadmap_doc = await StudentRoadmap.get_or_create(student_id)

    target_role = (
        (prof.target_roles if prof and prof.target_roles else None)
        or score_doc.target_role
        or roadmap_doc.role
    )
    if not target_role:
        return SkillGapOut(
            role="No target role set",
            acquired_skills=[],
            skill_gaps=[],
            overall_match_pct=0.0,
        )

    # 2. Fetch all real student skill levels from DB
    student_skills = await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id
    ).to_list()

    skill_map = {s.skill.lower(): s.current_level for s in student_skills}

    # Synchronize any skills completed or progressed on the roadmap
    if roadmap_doc and roadmap_doc.phases:
        for phase in roadmap_doc.phases:
            for item in phase.get("items", []):
                if item.get("type") == "project":
                    continue
                s_name = item.get("skill")
                if not s_name:
                    continue
                s_key = s_name.lower()
                watched_list = roadmap_doc.watched_videos.get(s_key, [])
                watched_count = len(watched_list)
                is_completed = (
                    item.get("status") == "completed"
                    or item.get("progress_pct", 0) >= 100
                    or watched_count >= 4
                )
                req_lvl = item.get("required_level", 4)
                curr_lvl = item.get("current_level", 0)

                if is_completed:
                    effective_lvl = req_lvl
                elif item.get("progress_pct", 0) > 0 or watched_count > 0:
                    prog_pct = max(item.get("progress_pct", 0), watched_count * 25)
                    effective_lvl = max(curr_lvl, int(req_lvl * (prog_pct / 100.0)))
                else:
                    effective_lvl = curr_lvl

                if effective_lvl > skill_map.get(s_key, 0):
                    skill_map[s_key] = effective_lvl
                    # Persist to StudentSkillLevel in DB
                    existing_skill_doc = await StudentSkillLevel.find_one(
                        StudentSkillLevel.student_id == student_id,
                        {"skill": {"$regex": f"^{re.escape(s_name)}$", "$options": "i"}},
                    )
                    if existing_skill_doc:
                        if existing_skill_doc.current_level < effective_lvl:
                            existing_skill_doc.current_level = effective_lvl
                            existing_skill_doc.last_updated = datetime.now(timezone.utc)
                            await existing_skill_doc.save()
                    else:
                        new_skill_doc = StudentSkillLevel(
                            student_id=student_id,
                            skill=s_name,
                            current_level=effective_lvl,
                            source="roadmap_completion",
                        )
                        await new_skill_doc.insert()

    # 3. Fetch benchmarks from DB or generate real-time with Groq API
    from app.core.groq_service import get_or_generate_benchmarks
    benchmarks = await get_or_generate_benchmarks(target_role)

    if not benchmarks:
        return SkillGapOut(
            role=target_role,
            acquired_skills=[s.skill for s in student_skills],
            skill_gaps=[],
            overall_match_pct=0.0,
        )

    # 4. Compute gaps from real data
    acquired = []
    gaps = []

    total_required = 0
    total_current = 0

    for bm in benchmarks:
        current = skill_map.get(bm.skill.lower(), 0)
        gap = max(0, bm.required_level - current)
        total_required += bm.required_level
        total_current += min(current, bm.required_level)

        if gap == 0 and current > 0:
            acquired.append(bm.skill)
        else:
            gaps.append(SkillGapItem(
                skill=bm.skill,
                current=current,
                required=bm.required_level,
                gap=gap,
                priority=bm.priority,
            ))

    # Sort gaps: priority first, then largest gap
    gaps.sort(key=lambda g: (g.priority, -g.gap))

    match_pct = round((total_current / total_required) *
                      100, 1) if total_required > 0 else 0.0

    return SkillGapOut(
        role=target_role,
        acquired_skills=acquired,
        skill_gaps=gaps,
        overall_match_pct=match_pct,
    )
