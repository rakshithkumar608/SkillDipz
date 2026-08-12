import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.models.assessment import AssessmentResult
from app.models.daily_assignment import DailyAssignment
from app.models.employability_score import EmployabilityScore
from app.models.project import StudentProjectSubmission
from app.models.student_profile import StudentProfile
from app.models.student_streak import StudentStreak
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


class LeaderboardEntry(BaseModel):
    rank: int
    student_id: str
    name: str
    avatar_initials: str
    college: Optional[str] = None
    branch: Optional[str] = None
    target_role: Optional[str] = None
    overall_score: float
    assessments_taken: int
    projects_completed: int
    assignments_completed: int
    current_streak: int
    resume_quality: float
    assessment_score: float
    project_strength: float
    interview_readiness: float
    activity_consistency: float
    is_me: bool = False

class Top3Entry(BaseModel):
    rank: int
    student_id: str
    name: str
    avatar_initials: str
    college: Optional[str] = None
    target_role: Optional[str] = None
    overall_score: float
    assessments_taken: int
    projects_completed: int
    assignments_completed: int
    current_streak: int

class MyRankOut(BaseModel):
    rank: int
    total_students: int
    overall_score: float
    percentile: float
    college_rank: Optional[int] = None
    college_total: Optional[int] = None
    rank_changes_7d: int

class LeaderboardResponse(BaseModel):
    total_students: int
    page: int
    per_page: int
    total_pages: int
    my_rank: int
    my_score: float
    top_3: List[Top3Entry]
    students: List[LeaderboardEntry]
    my_rank_details: MyRankOut


def _initials(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


async def _fetch_activity_counts(student_id: str) -> dict:
    """Four concurrent count queries — real activity data per student."""

    async def count_assessments():
        return await AssessmentResult.find(
            AssessmentResult.student_id == student_id
        ).count()

    async def count_projects():
        return await StudentProjectSubmission.find(
            StudentProjectSubmission.student_id == student_id,
            StudentProjectSubmission.evaluation_status == "evaluated",
        ).count()

    async def count_assignments():
        docs = await DailyAssignment.find(
            DailyAssignment.student_id == student_id
        ).to_list()
        return sum(
            1 for doc in docs for task in doc.tasks if task.status == "completed"
        )

    async def get_streak():
        doc = await StudentStreak.find_one(StudentStreak.student_id == student_id)
        return doc.current_streak if doc else 0

    results = await asyncio.gather(
        count_assessments(), count_projects(),
        count_assignments(), get_streak(),
        return_exceptions=True,
    )
    return {
        "assessments_taken":     results[0] if isinstance(results[0], int) else 0,
        "projects_completed":    results[1] if isinstance(results[1], int) else 0,
        "assignments_completed": results[2] if isinstance(results[2], int) else 0,
        "current_streak":        results[3] if isinstance(results[3], int) else 0,
    }


async def _build_entry(
    rank: int,
    score_doc: EmployabilityScore,
    profile: Optional[StudentProfile],
    me_id: str,
) -> LeaderboardEntry:
    name = (profile.name if profile else "") or "Student"
    activity = await _fetch_activity_counts(score_doc.student_id)
    c = score_doc.components
    return LeaderboardEntry(
        rank=rank,
        student_id=score_doc.student_id,
        name=name,
        avatar_initials=_initials(name),
        college=profile.college if profile else None,
        branch=profile.branch if profile else None,
        target_role=score_doc.target_role or (
            profile.target_roles if profile else None
        ),
        overall_score=round(score_doc.overall_score, 1),
        assessments_taken=activity["assessments_taken"],
        projects_completed=activity["projects_completed"],
        assignments_completed=activity["assignments_completed"],
        current_streak=activity["current_streak"],
        resume_quality=round(c.resume_quality, 1),
        assessment_score=round(c.assessment_score, 1),
        project_strength=round(c.project_strength, 1),
        interview_readiness=round(c.interview_readiness, 1),
        activity_consistency=round(c.activity_consistency, 1),
        is_me=(score_doc.student_id == me_id),
    )


async def _compute_my_rank_details(
    me_id: str,
    all_scores: List[EmployabilityScore],
    my_score_doc: Optional[EmployabilityScore],
) -> tuple:
    total = len(all_scores)
    my_overall = my_score_doc.overall_score if my_score_doc else 0.0
    my_rank = next(
        (i + 1 for i, s in enumerate(all_scores) if s.student_id == me_id), total
    )
    percentile = round((1 - (my_rank - 1) / max(total, 1)) * 100, 2)

    college_rank: Optional[int] = None
    college_total: Optional[int] = None
    my_profile = await StudentProfile.find_one(StudentProfile.student_id == me_id)
    if my_profile and my_profile.college:
        c_profs = await StudentProfile.find(
            StudentProfile.college == my_profile.college
        ).to_list()
        c_ids = {p.student_id for p in c_profs}
        c_scores = [s for s in all_scores if s.student_id in c_ids]
        college_total = len(c_scores)
        college_rank = next(
            (i + 1 for i, s in enumerate(c_scores) if s.student_id == me_id), None
        )

    rank_change_7d = 0
    if my_score_doc and my_score_doc.history:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        old_snaps = [h for h in my_score_doc.history if h.recorded_at <= cutoff]
        if old_snaps:
            old_score = max(old_snaps, key=lambda h: h.recorded_at).score
            above_now  = sum(1 for s in all_scores if s.overall_score > my_overall)
            above_then = sum(1 for s in all_scores if s.overall_score > old_score)
            rank_change_7d = above_then - above_now   # positive = moved up

    return my_rank, MyRankOut(
        rank=my_rank,
        total_students=total,
        overall_score=round(my_overall, 1),
        percentile=percentile,
        college_rank=college_rank,
        college_total=college_total,
        rank_change_7d=rank_change_7d,
    )


# GET / Leaderboard

@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    role: Optional[str] = Query(None),
    scope: Literal["global", "college"] = Query("global"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=10, le=100),
    around_me: bool = Query(False),
    current_user: User = Depends(get_current_user),
) -> LeaderboardResponse:
    me_id = str(current_user.id)

    q_args = [EmployabilityScore.target_role == role] if role else []
    all_scores: List[EmployabilityScore] = (
        await EmployabilityScore.find(*q_args)
        .sort(-EmployabilityScore.overall_score)
        .to_list()
    )

    if scope == "college":
        my_p = await StudentProfile.find_one(StudentProfile.student_id == me_id)
        if my_p and my_p.college:
            c_profs = await StudentProfile.find(
                StudentProfile.college == my_p.college
            ).to_list()
            c_ids = {p.student_id for p in c_profs}
            all_scores = [s for s in all_scores if s.student_id in c_ids]

    total_students = len(all_scores)
    my_score_doc = await EmployabilityScore.find_one(
        EmployabilityScore.student_id == me_id
    )
    my_rank, my_rank_details = await _compute_my_rank_details(
        me_id, all_scores, my_score_doc
    )

    if around_me:
        page = max(1, (my_rank - 1) // per_page + 1)
    total_pages = max(1, (total_students + per_page - 1) // per_page)
    page = min(page, total_pages)

    start = (page - 1) * per_page
    page_scores = all_scores[start : start + per_page]

    page_ids = [s.student_id for s in page_scores]
    profiles = await StudentProfile.find({"student_id": {"$in": page_ids}}).to_list()
    profile_map = {p.student_id: p for p in profiles}

    entries: List[LeaderboardEntry] = []
    for i, sd in enumerate(page_scores):
        e = await _build_entry(start + i + 1, sd, profile_map.get(sd.student_id), me_id)
        entries.append(e)

    top3_ids = [s.student_id for s in all_scores[:3]]
    t3_profs = await StudentProfile.find({"student_id": {"$in": top3_ids}}).to_list()
    t3_map = {p.student_id: p for p in t3_profs}

    top_3: List[Top3Entry] = []
    for t_rank, ts in enumerate(all_scores[:3], start=1):
        tp = t3_map.get(ts.student_id)
        t_name = (tp.name if tp else "") or "Student"
        act = await _fetch_activity_counts(ts.student_id)
        top_3.append(Top3Entry(
            rank=t_rank,
            student_id=ts.student_id,
            name=t_name,
            avatar_initials=_initials(t_name),
            college=tp.college if tp else None,
            target_role=ts.target_role,
            overall_score=round(ts.overall_score, 1),
            assessments_taken=act["assessments_taken"],
            projects_completed=act["projects_completed"],
            assignments_completed=act["assignments_completed"],
            current_streak=act["current_streak"],
        ))

    return LeaderboardResponse(
        total_students=total_students,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        my_rank=my_rank,
        my_score=round(my_score_doc.overall_score if my_score_doc else 0.0, 1),
        top_3=top_3,
        students=entries,
        my_rank_details=my_rank_details,
    )


# GET/ leaderboard/me

@router.get("/me", response_model=MyRankOut)
async def get_my_rank(
    role: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
) -> MyRankOut:
    me_id = str(current_user.id)
    q_args = [EmployabilityScore.target_role == role] if role else []
    all_scores = (
        await EmployabilityScore.find(*q_args)
        .sort(-EmployabilityScore.overall_score)
        .to_list()
    )
    my_score_doc = await EmployabilityScore.find_one(
        EmployabilityScore.student_id == me_id
    )
    _, details = await _compute_my_rank_details(me_id, all_scores, my_score_doc)
    return details