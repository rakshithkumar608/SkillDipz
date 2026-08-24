import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.models.assessment import AssessmentResult
from app.models.daily_assignment import DailyAssignment
from app.models.employability_score import EmployabilityScore
from app.models.project import StudentProjectSubmission
from app.models.student_profile import StudentProfile
from app.models.student_streak import StudentStreak
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


async def get_optional_caller_id(request: Request) -> Optional[str]:
    """Resolves caller id from student bearer token, student session, or company session cookie."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        from app.core.security import decode_token
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            return payload.get("sub")

    cookie_sid = request.cookies.get("session_id")
    if cookie_sid:
        from app.core.redis_client import get_session
        user_id = await get_session(cookie_sid)
        if user_id:
            return user_id

    company_sid = request.cookies.get("sdz.company.sid")
    if company_sid:
        from app.core.redis_client import get_company_session
        comp_id = await get_company_session(company_sid)
        if comp_id:
            return comp_id

    return None


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
    rank_change_7d: int


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
        return "ST"
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
        count_assessments(),
        count_projects(),
        count_assignments(),
        get_streak(),
        return_exceptions=True,
    )
    return {
        "assessments_taken": results[0] if isinstance(results[0], int) else 0,
        "projects_completed": results[1] if isinstance(results[1], int) else 0,
        "assignments_completed": results[2] if isinstance(results[2], int) else 0,
        "current_streak": results[3] if isinstance(results[3], int) else 0,
    }



#  GET /leaderboard/roles  — Live Distinct Roles from Database


@router.get("/roles", response_model=List[str])
async def get_leaderboard_roles():
    """Returns all distinct target roles present across student profiles in MongoDB."""
    profiles = await StudentProfile.find().to_list()
    roles_set = set()
    for p in profiles:
        if p.target_roles:
            for r in p.target_roles.split(","):
                r_clean = r.strip()
                if r_clean:
                    roles_set.add(r_clean)
    scores = await EmployabilityScore.find().to_list()
    for s in scores:
        if s.target_role and s.target_role.strip():
            roles_set.add(s.target_role.strip())
    return sorted(list(roles_set))



#  GET /leaderboard  — Global Platform Leaderboard


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    request: Request,
    role: Optional[str] = Query(None, description="Filter by target role"),
    search: Optional[str] = Query(None, description="Search candidate name, college, or role"),
    sort_by: str = Query("score", description="score | tests | projects | streak"),
    scope: Literal["global", "college"] = Query("global"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=5, le=100),
    around_me: bool = Query(False),
) -> LeaderboardResponse:
    caller_id = await get_optional_caller_id(request)
    me_id = str(caller_id) if caller_id else ""

    # 1. Fetch all Student Profiles, Employability Scores & Registered Students from MongoDB
    all_profiles = await StudentProfile.find().to_list()
    all_scores = await EmployabilityScore.find().to_list()
    student_users = await User.find({"$or": [{"role": "STUDENT"}, {"role": "student"}]}).to_list()

    score_map = {s.student_id: s for s in all_scores}
    profile_map = {p.student_id: p for p in all_profiles}

    # Include all real students from User collection
    for u in student_users:
        sid = str(u.id)
        if sid not in profile_map:
            profile_map[sid] = StudentProfile(
                student_id=sid,
                name=u.full_name or "Student Candidate",
                email=u.email,
                college=u.college or "Engineering Institute",
                target_roles="Software Engineer",
                skills=["Problem Solving", "Core CS", "Python", "React"],
            )

    all_student_ids = list(set(list(profile_map.keys()) + list(score_map.keys())))

    # 2. Build candidate aggregated records
    candidates_data = []
    search_re = re.compile(re.escape(search.strip()), re.IGNORECASE) if search and search.strip() else None
    role_re = re.compile(re.escape(role.strip()), re.IGNORECASE) if role and role.strip() else None

    # College scope filter check
    college_filter: Optional[str] = None
    if scope == "college":
        my_prof = profile_map.get(me_id)
        if my_prof and my_prof.college:
            college_filter = my_prof.college.lower().strip()

    for sid in all_student_ids:
        prof = profile_map.get(sid)
        sc = score_map.get(sid)

        name = (prof.name if prof else "") or "Student"
        college = (prof.college if prof else "") or ""
        branch = (prof.branch if prof else "") or ""
        target_role = (sc.target_role if sc else None) or (prof.target_roles if prof else None) or ""
        overall_score = round(sc.overall_score, 1) if sc else 0.0

        # Scope filter (College)
        if college_filter and college.lower().strip() != college_filter:
            continue

        # Role filter
        if role_re:
            if not target_role or not role_re.search(target_role):
                continue

        # Search filter
        if search_re:
            name_match = bool(search_re.search(name))
            college_match = bool(search_re.search(college))
            branch_match = bool(search_re.search(branch))
            role_match = bool(search_re.search(target_role))
            skills_match = any(bool(search_re.search(s)) for s in (prof.skills if prof and prof.skills else []))
            if not (name_match or college_match or branch_match or role_match or skills_match):
                continue

        candidates_data.append({
            "student_id": sid,
            "profile": prof,
            "score_doc": sc,
            "name": name,
            "college": college or None,
            "branch": branch or None,
            "target_role": target_role or None,
            "overall_score": overall_score,
        })

    # 3. Concurrently fetch live activity counts for all filtered candidates
    candidate_ids = [c["student_id"] for c in candidates_data]
    activity_results = await asyncio.gather(
        *[_fetch_activity_counts(sid) for sid in candidate_ids],
        return_exceptions=True,
    )
    for c, act in zip(candidates_data, activity_results):
        act_dict = act if isinstance(act, dict) else {
            "assessments_taken": 0,
            "projects_completed": 0,
            "assignments_completed": 0,
            "current_streak": 0,
        }
        c.update(act_dict)

    # 4. Sort candidates
    if sort_by == "tests":
        candidates_data.sort(key=lambda x: (-x["assessments_taken"], -x["overall_score"]))
    elif sort_by == "projects":
        candidates_data.sort(key=lambda x: (-x["projects_completed"], -x["overall_score"]))
    elif sort_by == "streak":
        candidates_data.sort(key=lambda x: (-x["current_streak"], -x["overall_score"]))
    else:
        # Default sort by overall_score descending, then tests, then projects
        candidates_data.sort(key=lambda x: (-x["overall_score"], -x["assessments_taken"], -x["projects_completed"]))

    total_students = len(candidates_data)

    # 5. Top 3 entries
    top_3: List[Top3Entry] = []
    for rank_idx, c in enumerate(candidates_data[:3], start=1):
        top_3.append(Top3Entry(
            rank=rank_idx,
            student_id=c["student_id"],
            name=c["name"],
            avatar_initials=_initials(c["name"]),
            college=c["college"],
            target_role=c["target_role"],
            overall_score=c["overall_score"],
            assessments_taken=c["assessments_taken"],
            projects_completed=c["projects_completed"],
            assignments_completed=c["assignments_completed"],
            current_streak=c["current_streak"],
        ))

    # 6. Compute user rank details
    my_rank = next(
        (i + 1 for i, c in enumerate(candidates_data) if c["student_id"] == me_id),
        total_students + 1,
    )
    my_score_doc = score_map.get(me_id)
    my_overall = my_score_doc.overall_score if my_score_doc else 0.0
    percentile = round((1 - (my_rank - 1) / max(total_students, 1)) * 100, 2)

    my_rank_details = MyRankOut(
        rank=my_rank,
        total_students=total_students,
        overall_score=round(my_overall, 1),
        percentile=percentile,
        college_rank=None,
        college_total=None,
        rank_change_7d=0,
    )

    # 7. Pagination
    if around_me:
        page = max(1, (my_rank - 1) // per_page + 1)
    total_pages = max(1, (total_students + per_page - 1) // per_page)
    page = min(page, total_pages)

    start = (page - 1) * per_page
    page_items = candidates_data[start : start + per_page]

    # 8. Build LeaderboardEntry list for this page
    entries: List[LeaderboardEntry] = []
    for i, c in enumerate(page_items):
        sc = c["score_doc"]
        c_comp = sc.components if sc else None
        entries.append(LeaderboardEntry(
            rank=start + i + 1,
            student_id=c["student_id"],
            name=c["name"],
            avatar_initials=_initials(c["name"]),
            college=c["college"],
            branch=c["branch"],
            target_role=c["target_role"],
            overall_score=c["overall_score"],
            assessments_taken=c["assessments_taken"],
            projects_completed=c["projects_completed"],
            assignments_completed=c["assignments_completed"],
            current_streak=c["current_streak"],
            resume_quality=round(c_comp.resume_quality, 1) if c_comp else 0.0,
            assessment_score=round(c_comp.assessment_score, 1) if c_comp else 0.0,
            project_strength=round(c_comp.project_strength, 1) if c_comp else 0.0,
            interview_readiness=round(c_comp.interview_readiness, 1) if c_comp else 0.0,
            activity_consistency=round(c_comp.activity_consistency, 1) if c_comp else 0.0,
            is_me=(c["student_id"] == me_id),
        ))

    return LeaderboardResponse(
        total_students=total_students,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        my_rank=my_rank,
        my_score=round(my_overall, 1),
        top_3=top_3,
        students=entries,
        my_rank_details=my_rank_details,
    )



#  GET /leaderboard/me  — User Rank Summary


@router.get("/me", response_model=MyRankOut)
async def get_my_rank(
    request: Request,
    role: Optional[str] = Query(None),
) -> MyRankOut:
    caller_id = await get_optional_caller_id(request)
    me_id = str(caller_id) if caller_id else ""
    all_scores = await EmployabilityScore.find().sort(-EmployabilityScore.overall_score).to_list()
    total = max(len(all_scores), 1)
    my_score_doc = await EmployabilityScore.find_one(EmployabilityScore.student_id == me_id) if me_id else None
    my_overall = my_score_doc.overall_score if my_score_doc else 0.0
    my_rank = next((i + 1 for i, s in enumerate(all_scores) if s.student_id == me_id), total) if me_id else 1
    percentile = round((1 - (my_rank - 1) / max(total, 1)) * 100, 2)
    return MyRankOut(
        rank=my_rank,
        total_students=total,
        overall_score=round(my_overall, 1),
        percentile=percentile,
        college_rank=None,
        college_total=None,
        rank_change_7d=0,
    )