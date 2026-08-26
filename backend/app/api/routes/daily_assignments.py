

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.daily_assignment import (
    DailyAssignment,
    CompanySponsoredChallenge,
)
from app.models.student_profile import StudentProfile
from app.models.student_streak import StudentStreak
from app.models.notification import Notification
from app.schemas.daily_assignment_schema import (
    DailyAssignmentOut,
    TaskOut,
    SponsoredTaskOut,
    SponsoredChallengeIn,
    PlatformStatsOut,
)
from app.services.daily_assignment_service import generate_assignment_for_student
from app.models.activity_log import ActivityLog
from app.api.routes.students import _compute_streak
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

# Student-facing endpoints
router = APIRouter(prefix="/students/me", tags=["Daily Assignments"])

# Company-facing endpoint
company_router = APIRouter(prefix="/companies/me", tags=["Daily Assignments — Company"])

# Public stats endpoint (no auth)
public_router = APIRouter(prefix="/daily-assignments", tags=["Daily Assignments — Stats"])



# HELPERS


def _build_task_out(t) -> TaskOut:
    return TaskOut(
        task_id=t.task_id,
        type=t.type,
        subtype=t.subtype,
        title=t.title,
        status=t.status,
        points=t.points,
        completed_at=t.completed_at.isoformat() if t.completed_at else None,
        skill_tag=t.skill_tag,
        topic_id=t.topic_id,
        cf_url=t.cf_url,
        cf_rating=t.cf_rating,
        youtube_id=t.youtube_id,
        channel=t.channel,
        duration_label=t.duration_label,
        flashcards=t.flashcards,
        explain_prompt=t.explain_prompt,
        resume_skill=t.resume_skill,
        tweak_instruction=t.tweak_instruction,
    )


def _build_response(assignment: DailyAssignment, platform_count: int) -> DailyAssignmentOut:
    tasks_out = [_build_task_out(t) for t in assignment.tasks]
    completed = sum(1 for t in assignment.tasks if t.status == "completed")

    sponsored_out = None
    if assignment.sponsored_task:
        s = assignment.sponsored_task
        sponsored_out = SponsoredTaskOut(
            company=s.company_name,
            type=s.type,
            title=s.title,
            points=s.points,
            content_ref=s.content_ref,
        )

    return DailyAssignmentOut(
        date=assignment.date,
        difficulty=assignment.difficulty,
        completed=completed,
        total=len(assignment.tasks),
        tasks=tasks_out,
        sponsored_task=sponsored_out,
        streak=assignment.streak,
        streak_tier=assignment.streak_tier,
        streak_bonus=assignment.streak_bonus,
        completed_today_platform_wide=platform_count,
    )


async def _get_platform_completed_today(redis=None) -> int:
    
    today = date.today().isoformat()
    cache_key = f"da_stats:completed:{today}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return int(cached)
        except Exception:
            pass

    # Count those where all tasks are completed
    all_today = await DailyAssignment.find(DailyAssignment.date == today).to_list()
    completed_count = sum(
        1 for a in all_today
        if a.tasks and all(t.status == "completed" for t in a.tasks)
    )

    if redis:
        try:
            await redis.setex(cache_key, 300, str(completed_count))  # 5-min TTL
        except Exception:
            pass

    return completed_count



# GET /students/me/daily-assignments

@router.get("/daily-assignments", response_model=DailyAssignmentOut)
async def get_daily_assignment(
    date_str: Optional[str] = Query(None, alias="date", description="YYYY-MM-DD — defaults to today"),
    current_user: User = Depends(get_current_user),
):
    
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Students only")

    student_id = str(current_user.id)
    today = date.today().isoformat()
    target_date = date_str or today

    if target_date == today:
        # Generate on-demand if not yet created
        assignment = await generate_assignment_for_student(student_id)
    else:
        assignment = await DailyAssignment.get_for_student(student_id, target_date)

    if not assignment:
        raise HTTPException(status_code=404, detail=f"No assignment found for {target_date}")

    streak_doc = await StudentStreak.get_or_create(student_id)
    assignment.streak = streak_doc.current_streak
    assignment.streak_tier = streak_doc.streak_tier

    redis = get_redis()
    platform_count = await _get_platform_completed_today(redis)

    return _build_response(assignment, platform_count)



# POST /students/me/daily-assignments/{task_id}/complete

@router.post("/daily-assignments/{task_id}/complete")
async def complete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Students only")

    student_id = str(current_user.id)
    today = date.today().isoformat()

    assignment = await DailyAssignment.get_for_student(student_id, today)
    if not assignment:
        raise HTTPException(status_code=404, detail="No assignment found for today")

    # Find the task
    task = next((t for t in assignment.tasks if t.task_id == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status == "completed":
        return {"message": "Task already completed", "task_id": task_id}

    # Mark complete
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    await assignment.save()

    # Log to ActivityLog feed (counts towards Activity page feed, streak & heatmap)
    task_type_map = {
        "quiz": "assessment",
        "code": "submission",
        "video": "module",
        "flashcard": "assessment",
        "explain": "assessment",
        "resume_tweak": "resume",
        "wildcard": "assessment",
    }
    log_type = task_type_map.get(task.type, "assessment")

    try:
        await ActivityLog(
            student_id=student_id,
            type=log_type,
            title=f"Daily Task: {task.title}",
            detail=f"Completed {task.type} daily task (+{task.points} pts)",
        ).insert()
    except Exception as e:
        logger.warning(f"Could not log ActivityLog for task {task_id}: {e}")

    # Re-calculate streak dynamically from all ActivityLogs to keep StudentStreak document aligned
    logs = await ActivityLog.find(ActivityLog.student_id == student_id).to_list()
    active_dates = {log.created_at.date() for log in logs}
    current_s, longest_s, last_act = _compute_streak(active_dates)

    streak_doc = await StudentStreak.get_or_create(student_id)
    streak_doc.current_streak = current_s
    streak_doc.longest_streak = longest_s
    streak_doc.last_active = last_act or date.today()
    await streak_doc.save()

    try:
        from app.api.routes.students import compute_realtime_score
        await compute_realtime_score(student_id)
    except Exception:
        pass

    all_done = all(t.status == "completed" for t in assignment.tasks)
    if all_done:
        # Invalidate stats cache
        redis = get_redis()
        if redis:
            try:
                await redis.delete(f"da_stats:completed:{today}")
            except Exception:
                pass

        # Push notification for streak milestones
        milestones = {7, 14, 30, 60, 100}
        if streak_doc.current_streak in milestones:
            await Notification(
                student_id=student_id,
                title=f"🔥 {streak_doc.current_streak}-Day Streak!",
                body=f"Incredible! You've maintained a {streak_doc.current_streak}-day streak. Keep crushing it!",
                action_url="/student/daily-assignments",
                notification_type="streak_milestone",
            ).insert()

    return {
        "message": "Task completed",
        "task_id": task_id,
        "all_done": all_done,
        "streak": streak_doc.current_streak,
    }



# GET /daily-assignments/stats  (public — for social proof widget)

@public_router.get("/stats", response_model=PlatformStatsOut)
async def get_platform_stats():
    
    today = date.today().isoformat()
    redis = get_redis()

    completed_count = await _get_platform_completed_today(redis)

    # Total active students = those with a profile (cached 1 hour)
    active_cache_key = "da_stats:active_students"
    active_count = 0
    if redis:
        try:
            cached = await redis.get(active_cache_key)
            if cached:
                active_count = int(cached)
        except Exception:
            pass

    if not active_count:
        active_count = await StudentProfile.find().count()
        if redis:
            try:
                await redis.setex(active_cache_key, 3600, str(active_count))
            except Exception:
                pass

    return PlatformStatsOut(
        completed_today=completed_count,
        total_active_students=active_count,
    )



# POST /companies/me/daily-challenge  (company submits sponsored challenge)

@company_router.post("/daily-challenge", status_code=201)
async def submit_sponsored_challenge(
    payload: SponsoredChallengeIn,
    current_user: User = Depends(get_current_user),
):
    
    if current_user.role != "COMPANY":
        raise HTTPException(status_code=403, detail="Company accounts only")

    company_id = str(current_user.id)
    company_name = current_user.company_name or current_user.full_name

    challenge = CompanySponsoredChallenge(
        company_id=company_id,
        company_name=company_name,
        type=payload.type,
        title=payload.title,
        content_ref=payload.content_ref,
        target_role=payload.target_role,
        points=payload.points,
        scheduled_date=payload.scheduled_date,
        is_active=True,
    )
    await challenge.insert()

    return {
        "message": "Sponsored challenge submitted successfully",
        "challenge_id": str(challenge.id),
        "company": company_name,
        "scheduled_date": payload.scheduled_date or "next available slot",
    }
