"""
Arena API Routes
All XP, scoring, and streak logic is calculated SERVER-SIDE.
The frontend never sends scores — it only sends answers.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.arena import (
    ArenaQuestion,
    ArenaSession,
    ArenaAttempt,
    DailyArena,
    ArenaUserStats,
    ArenaBadge,
    UserBadge,
    AnswerRecord,
    get_level_info,
    calculate_speed_bonus,
)
from app.models.student_profile import StudentProfile
from app.models.skill_gap import StudentSkillLevel
from app.schemas.arena_schema import (
    StartSessionRequest,
    StartSessionResponse,
    ArenaQuestionOut,
    ArenaOptionOut,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    CompleteSessionRequest,
    CompleteSessionResponse,
    AnswerSummary,
    ArenaHomeResponse,
    DailyArenaOut,
    ArenaLeaderboardResponse,
    ArenaLeaderboardEntry,
    SkillsResponse,
    SkillRecommendation,
    SkillScoreOut,
)

from app.services.arena_service import (
    generate_quick_fire_questions,
    generate_debug_rush_questions,
    generate_tech_decision_questions,
    get_or_create_daily_arena,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/arena", tags=["Game Arena"])

# Questions per game mode (10 questions each as requested)
QUESTIONS_PER_GAME = {
    "quick_fire": 10,
    "debug_rush": 10,
    "tech_decision": 10,
}

# Session timeout buffer (extra seconds beyond total question time)
SESSION_BUFFER_S = 120

# Daily Arena bonus XP
DAILY_COMPLETION_BONUS = 50
PERFECT_ARENA_BONUS = 50

# Weak skill threshold
WEAK_SKILL_THRESHOLD = 60.0  # accuracy below this is "weak"

# Weekly leaderboard resets on Monday UTC midnight
WEEKLY_RESET_DAY = 0  # Monday


def _get_today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _format_time_ms(ms: int) -> str:
    if not ms or ms <= 0:
        return "0s"
    seconds = int(ms / 1000)
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    rem_seconds = seconds % 60
    return f"{minutes}m {rem_seconds:02d}s"


def _is_expired(expires_at: Optional[datetime]) -> bool:
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > expires_at


async def _get_student_skills_and_role(student_id: str):
    skills = []
    # 1. From StudentSkillLevel
    try:
        skill_levels = await StudentSkillLevel.find(StudentSkillLevel.student_id == student_id).to_list()
        for sl in skill_levels:
            if sl.skill and sl.skill not in skills:
                skills.append(sl.skill)
    except Exception as e:
        logger.warning(f"Failed to fetch student skill levels: {e}")

    # 2. From StudentProfile
    target_role = None
    try:
        profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
        if profile:
            target_role = profile.target_roles
            if profile.skills:
                for s in profile.skills:
                    if s and s not in skills:
                        skills.append(s)
    except Exception as e:
        logger.warning(f"Failed to fetch student profile: {e}")

    if not skills:
        skills = ["JavaScript", "TypeScript", "Python", "React", "SQL", "Backend", "System Design"]

    return skills, target_role


def _build_question_out(q: ArenaQuestion) -> ArenaQuestionOut:
    return ArenaQuestionOut(
        question_id=str(q.id),
        question=q.question,
        options=[ArenaOptionOut(key=o.key, text=o.text) for o in q.options],
        time_limit=q.time_limit,
        xp_reward=q.xp_reward,
        skill=q.skill,
        code_snippet=q.code_snippet,
        scenario=q.scenario,
    )


async def _check_and_award_badges(stats: ArenaUserStats, session: ArenaSession) -> List[str]:
    """Check if any new badges should be awarded. Returns list of newly earned badge_ids."""
    newly_earned = []
    existing = set(stats.badges_earned)

    # Load all active badges once
    badges = await ArenaBadge.find(ArenaBadge.is_active == True).to_list()

    for badge in badges:
        if badge.badge_id in existing:
            continue

        earned = False
        bt = badge.requirement_type
        bv = badge.requirement_value

        if bt == "arena_streak" and stats.arena_streak >= bv:
            earned = True
        elif bt == "debug_rush_solved":
            count = await ArenaSession.find(
                ArenaSession.student_id == stats.student_id,
                ArenaSession.game_type == "debug_rush",
                ArenaSession.status == "completed",
            ).count()
            if count >= bv:
                earned = True
        elif bt == "tech_decision_solved":
            count = await ArenaSession.find(
                ArenaSession.student_id == stats.student_id,
                ArenaSession.game_type == "tech_decision",
                ArenaSession.status == "completed",
            ).count()
            if count >= bv:
                earned = True
        elif bt == "perfect_run" and session.accuracy == 1.0:
            earned = True
        elif bt == "questions_under_5s":
            fast_answers = sum(
                1 for a in session.answers if a.elapsed_ms <= 5000 and a.is_correct
            )
            # We'd need cumulative count — for now just check this session
            if fast_answers >= bv:
                earned = True

        if earned:
            newly_earned.append(badge.badge_id)
            await UserBadge(
                student_id=stats.student_id,
                badge_id=badge.badge_id,
            ).insert()

    if newly_earned:
        stats.badges_earned.extend(newly_earned)

    return newly_earned


async def _update_streak(stats: ArenaUserStats, today: str) -> int:
    """
    Update arena streak. Returns updated streak count.
    - Same day: no change
    - Consecutive day: streak + 1
    - Gap > 1 day: reset to 1
    """
    if stats.last_arena_date == today:
        return stats.arena_streak  # already completed today

    if stats.last_arena_date is not None:
        last = datetime.strptime(stats.last_arena_date, "%Y-%m-%d").date()
        today_d = datetime.strptime(today, "%Y-%m-%d").date()
        delta = (today_d - last).days
        if delta == 1:
            stats.arena_streak += 1
        elif delta > 1:
            stats.arena_streak = 1
    else:
        stats.arena_streak = 1

    if stats.arena_streak > stats.longest_arena_streak:
        stats.longest_arena_streak = stats.arena_streak

    stats.last_arena_date = today
    return stats.arena_streak


def _update_skill_scores(stats: ArenaUserStats, session: ArenaSession, questions: List[ArenaQuestion]):
    """Update per-skill accuracy in ArenaUserStats."""
    q_map = {str(q.id): q for q in questions}
    for answer in session.answers:
        q = q_map.get(answer.question_id)
        if not q:
            continue
        skill = q.skill
        if skill not in stats.skill_scores:
            stats.skill_scores[skill] = {"correct": 0, "total": 0, "score": 0.0}
        stats.skill_scores[skill]["total"] += 1
        if answer.is_correct:
            stats.skill_scores[skill]["correct"] += 1
        total = stats.skill_scores[skill]["total"]
        correct = stats.skill_scores[skill]["correct"]
        stats.skill_scores[skill]["score"] = round(correct / total * 100, 1)


async def _ensure_weekly_reset(stats: ArenaUserStats):
    """Reset weekly XP every Monday UTC."""
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    last_monday = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    # MongoDB returns naive datetimes — normalize to UTC-aware before comparing
    reset_at = stats.weekly_xp_reset_at
    if reset_at is not None and reset_at.tzinfo is None:
        reset_at = reset_at.replace(tzinfo=timezone.utc)

    if reset_at is None or reset_at < last_monday:
        stats.weekly_xp = 0
        stats.weekly_xp_reset_at = last_monday


# ─── GET /v1/arena/home ───────────────────────────────────────────────────────

@router.get("/home", response_model=ArenaHomeResponse)
async def get_arena_home(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)

    level_info = get_level_info(stats.total_xp)
    today = _get_today_str()

    # Daily challenge via Groq AI
    daily_doc = await get_or_create_daily_arena(today)
    if not daily_doc:
        daily_doc = await DailyArena.find_one(DailyArena.date_str == today, DailyArena.is_active == True)

    attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id,
        ArenaAttempt.date_str == today,
    )
    daily_out = DailyArenaOut(
        date_str=today,
        total_xp=daily_doc.total_xp,
        quick_fire_count=len(daily_doc.quick_fire_ids),
        debug_rush_count=len(daily_doc.debug_rush_ids),
        tech_decision_count=len(daily_doc.tech_decision_ids),
        already_completed=attempt is not None,
        completed_at=attempt.completed_at.isoformat() if attempt else None,
        time_taken_str=_format_time_ms(attempt.total_time_ms) if attempt else None,
    )

    # Today's daily rank (sorted by XP desc, time taken asc)
    today_attempts = await ArenaAttempt.find(ArenaAttempt.date_str == today).to_list(None)
    today_attempts.sort(key=lambda x: (-x.total_xp, x.total_time_ms))
    my_daily_rank = None
    for i, a in enumerate(today_attempts):
        if a.student_id == student_id:
            my_daily_rank = i + 1
            break

    # Leaderboard preview (weekly, top 5)
    top_stats = await ArenaUserStats.find().sort(-ArenaUserStats.weekly_xp).to_list(5)
    preview = []
    my_weekly_rank = None
    all_stats = await ArenaUserStats.find().sort(-ArenaUserStats.weekly_xp).to_list(None)
    for i, s in enumerate(all_stats):
        if s.student_id == student_id:
            my_weekly_rank = i + 1
            break

    all_lifetime = await ArenaUserStats.find().sort(-ArenaUserStats.total_xp).to_list(None)
    my_lifetime_rank = None
    for i, s in enumerate(all_lifetime):
        if s.student_id == student_id:
            my_lifetime_rank = i + 1
            break

    for i, s in enumerate(top_stats):
        profile = await StudentProfile.find_one(StudentProfile.student_id == s.student_id)
        name = profile.name if profile else "Student"
        initials = "".join(w[0].upper() for w in name.split()[:2]) if name else "S"
        li = get_level_info(s.total_xp)
        preview.append({
            "rank": i + 1,
            "student_id": s.student_id,
            "name": name,
            "avatar_initials": initials,
            "level": li["level"],
            "weekly_xp": s.weekly_xp,
            "arena_streak": s.arena_streak,
            "is_me": s.student_id == student_id,
        })

    # Recent accuracy (last 7 sessions)
    recent = await ArenaSession.find(
        ArenaSession.student_id == student_id,
        ArenaSession.status == "completed",
    ).sort(-ArenaSession.completed_at).to_list(7)
    recent_accuracy = (
        round(sum(s.accuracy for s in recent) / len(recent) * 100, 1) if recent else 0.0
    )
    total_games = await ArenaSession.find(
        ArenaSession.student_id == student_id,
        ArenaSession.status == "completed",
    ).count()

    skill_scores_out = [
        SkillScoreOut(
            skill=skill,
            correct=v.get("correct", 0),
            total=v.get("total", 0),
            score=v.get("score", 0.0),
        )
        for skill, v in stats.skill_scores.items()
    ]

    # Game modes completed today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_sessions = await ArenaSession.find(
        ArenaSession.student_id == student_id,
        ArenaSession.status == "completed",
        ArenaSession.completed_at >= today_start,
    ).to_list(None)
    completed_today = list(set(s.game_type for s in today_sessions if s.game_type))

    await stats.save()

    return ArenaHomeResponse(
        total_xp=stats.total_xp,
        weekly_xp=stats.weekly_xp,
        level=level_info["level"],
        xp_in_level=level_info["xp_in_level"],
        xp_for_next_level=level_info["xp_for_next_level"],
        progress_pct=level_info["progress_pct"],
        arena_streak=stats.arena_streak,
        longest_arena_streak=stats.longest_arena_streak,
        daily=daily_out,
        leaderboard_preview=preview,
        my_daily_rank=my_daily_rank,
        my_weekly_rank=my_weekly_rank,
        my_lifetime_rank=my_lifetime_rank,
        recent_accuracy=recent_accuracy,
        total_games_played=total_games,
        skill_scores=skill_scores_out,
        completed_game_types_today=completed_today,
    )


# ─── GET /v1/arena/daily ──────────────────────────────────────────────────────

@router.get("/daily", response_model=DailyArenaOut)
async def get_daily_arena(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    today = _get_today_str()
    daily_doc = await get_or_create_daily_arena(today)
    if not daily_doc:
        raise HTTPException(status_code=404, detail="No daily challenge configured for today")
    attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id, ArenaAttempt.date_str == today
    )
    return DailyArenaOut(
        date_str=today,
        total_xp=daily_doc.total_xp,
        quick_fire_count=len(daily_doc.quick_fire_ids),
        debug_rush_count=len(daily_doc.debug_rush_ids),
        tech_decision_count=len(daily_doc.tech_decision_ids),
        already_completed=attempt is not None,
        completed_at=attempt.completed_at.isoformat() if attempt else None,
    )


# ─── POST /v1/arena/start ─────────────────────────────────────────────────────

@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    body: StartSessionRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    game_type = body.game_type
    difficulty = body.difficulty or "medium"

    # Enforce 1 completed game per day per mode
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing_today = await ArenaSession.find_one(
        ArenaSession.student_id == student_id,
        ArenaSession.game_type == game_type,
        ArenaSession.status == "completed",
        ArenaSession.completed_at >= today_start,
    )
    if existing_today:
        label = GAME_TYPE_LABELS.get(game_type, game_type)
        raise HTTPException(
            status_code=400,
            detail=f"You have already completed {label} today! Each game mode can be played once per day. Come back tomorrow for a new challenge!",
        )

    n_questions = QUESTIONS_PER_GAME.get(game_type, 10)

    # Fetch active questions for this game type
    import random
    query = ArenaQuestion.find(
        ArenaQuestion.game_type == game_type,
        ArenaQuestion.is_active == True,
    )
    if body.difficulty:
        query = ArenaQuestion.find(
            ArenaQuestion.game_type == game_type,
            ArenaQuestion.difficulty == body.difficulty,
            ArenaQuestion.is_active == True,
        )

    all_qs = await query.to_list(None)

    student_skills, target_role = await _get_student_skills_and_role(student_id)

    # If fewer than 10 questions in DB, generate 10 fresh ones via Groq AI based on student's skill gaps
    if len(all_qs) < n_questions:
        logger.info(f"Generating {n_questions} {game_type} questions via Groq AI for skills: {student_skills}...")
        generated = []
        if game_type == "quick_fire":
            generated = await generate_quick_fire_questions(count=n_questions, difficulty=difficulty, skills=student_skills, role=target_role)
        elif game_type == "debug_rush":
            generated = await generate_debug_rush_questions(count=n_questions, difficulty=difficulty, skills=student_skills, role=target_role)
        elif game_type == "tech_decision":
            generated = await generate_tech_decision_questions(count=n_questions, difficulty=difficulty, skills=student_skills, role=target_role)

        if generated:
            all_qs.extend(generated)

    if not all_qs:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions for {game_type}")

    selected = random.sample(all_qs, min(n_questions, len(all_qs)))

    # Calculate session expiry: sum of all time limits + buffer
    total_time = sum(q.time_limit for q in selected) + SESSION_BUFFER_S
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=total_time)

    session = ArenaSession(
        session_id=str(uuid.uuid4()),
        student_id=student_id,
        game_type=game_type,
        question_ids=[str(q.id) for q in selected],
        expires_at=expires_at,
    )
    await session.insert()

    return StartSessionResponse(
        session_id=session.session_id,
        game_type=game_type,
        questions=[_build_question_out(q) for q in selected],
        expires_at=expires_at.isoformat(),
        total_questions=len(selected),
    )


# ─── POST /v1/arena/answer ────────────────────────────────────────────────────

@router.post("/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    body: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)

    # Validate session
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != student_id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {session.status}")
    if _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")

    # Validate question belongs to this session
    if body.question_id not in session.question_ids:
        raise HTTPException(status_code=400, detail="Question not in this session")

    # Prevent double-answering
    already_answered = [a.question_id for a in session.answers]
    if body.question_id in already_answered:
        raise HTTPException(status_code=400, detail="Question already answered")

    # Fetch question (with correct_key)
    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(body.question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")

    # Validate and cap elapsed_ms (prevent fake fast times)
    max_elapsed = q.time_limit * 1000 + 2000  # time_limit + 2s tolerance
    elapsed_ms = min(abs(body.elapsed_ms), max_elapsed)

    is_correct = body.answer_key.upper() == q.correct_key.upper()
    speed_bonus = calculate_speed_bonus(elapsed_ms, q.time_limit) if is_correct else 0
    xp_earned = (q.xp_reward + speed_bonus) if is_correct else 0

    record = AnswerRecord(
        question_id=body.question_id,
        submitted_key=body.answer_key.upper(),
        is_correct=is_correct,
        elapsed_ms=elapsed_ms,
        xp_earned=xp_earned,
        answered_at=datetime.now(timezone.utc),
    )
    session.answers.append(record)
    await session.save()

    return SubmitAnswerResponse(
        is_correct=is_correct,
        correct_key=q.correct_key,
        explanation=q.explanation,
        xp_earned=xp_earned,
        speed_bonus=speed_bonus,
    )


# ─── POST /v1/arena/complete ──────────────────────────────────────────────────

@router.post("/complete", response_model=CompleteSessionResponse)
async def complete_session(
    body: CompleteSessionRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)

    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != student_id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")
    if session.status == "expired" or _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")

    # Compute final scores and time server-side
    total_xp = sum(a.xp_earned for a in session.answers)
    total_time_ms = sum(a.elapsed_ms for a in session.answers)
    correct_count = sum(1 for a in session.answers if a.is_correct)
    total_q = len(session.question_ids)
    accuracy = correct_count / total_q if total_q > 0 else 0.0
    is_perfect = accuracy == 1.0

    if is_perfect:
        total_xp += PERFECT_ARENA_BONUS

    session.total_xp = total_xp
    session.total_time_ms = total_time_ms
    session.correct_count = correct_count
    session.accuracy = accuracy
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    await session.save()

    # Load all questions for the full answer summary
    from beanie import PydanticObjectId
    questions = []
    for qid in session.question_ids:
        try:
            q = await ArenaQuestion.get(PydanticObjectId(qid))
            if q:
                questions.append(q)
        except Exception:
            pass

    q_map = {str(q.id): q for q in questions}
    answer_summaries = []
    for a in session.answers:
        q = q_map.get(a.question_id)
        answer_summaries.append(AnswerSummary(
            question_id=a.question_id,
            question=q.question if q else "",
            skill=q.skill if q else "",
            submitted_key=a.submitted_key,
            correct_key=q.correct_key if q else "",
            is_correct=a.is_correct,
            xp_earned=a.xp_earned,
            explanation=q.explanation if q else "",
        ))

    # Update user stats
    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)
    old_level_info = get_level_info(stats.total_xp)
    old_level = old_level_info["level"]

    stats.total_xp += total_xp
    stats.weekly_xp += total_xp
    _update_skill_scores(stats, session, questions)

    # Update streak only for completed daily arenas
    today = _get_today_str()
    if session.game_type == "daily":
        await _update_streak(stats, today)

    new_level_info = get_level_info(stats.total_xp)
    leveled_up = new_level_info["level"] > old_level

    newly_earned = await _check_and_award_badges(stats, session)
    stats.updated_at = datetime.now(timezone.utc)
    await stats.save()

    return CompleteSessionResponse(
        session_id=session.session_id,
        game_type=session.game_type,
        total_xp=total_xp,
        correct_count=correct_count,
        total_questions=total_q,
        accuracy=round(accuracy * 100, 1),
        is_perfect=is_perfect,
        total_time_ms=total_time_ms,
        total_time_str=_format_time_ms(total_time_ms),
        answers=answer_summaries,
        new_total_xp=stats.total_xp,
        level_info=new_level_info,
        leveled_up=leveled_up,
        old_level=old_level,
        arena_streak=stats.arena_streak,
        badges_earned=newly_earned,
    )


# ─── POST /v1/arena/daily/start ──────────────────────────────────────────────

@router.post("/daily/start", response_model=StartSessionResponse)
async def start_daily_arena(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    today = _get_today_str()

    # Check already completed
    attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id, ArenaAttempt.date_str == today
    )
    if attempt:
        raise HTTPException(status_code=400, detail="Daily Arena already completed today")

    student_skills, target_role = await _get_student_skills_and_role(student_id)
    daily_doc = await get_or_create_daily_arena(today, skills=student_skills, role=target_role)
    if not daily_doc:
        raise HTTPException(status_code=404, detail="No daily challenge for today")

    # Collect all question IDs (QF + DR + TD)
    all_ids = (
        daily_doc.quick_fire_ids
        + daily_doc.debug_rush_ids
        + daily_doc.tech_decision_ids
    )

    from beanie import PydanticObjectId
    questions = []
    for qid in all_ids:
        try:
            q = await ArenaQuestion.get(PydanticObjectId(qid))
            if q:
                questions.append(q)
        except Exception:
            pass

    if not questions:
        raise HTTPException(status_code=404, detail="Daily challenge questions not found")

    total_time = sum(q.time_limit for q in questions) + SESSION_BUFFER_S
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=total_time)

    session = ArenaSession(
        session_id=str(uuid.uuid4()),
        student_id=student_id,
        game_type="daily",
        question_ids=[str(q.id) for q in questions],
        expires_at=expires_at,
        daily_date=today,
    )
    await session.insert()

    return StartSessionResponse(
        session_id=session.session_id,
        game_type="daily",
        questions=[_build_question_out(q) for q in questions],
        expires_at=expires_at.isoformat(),
        total_questions=len(questions),
    )


# ─── POST /v1/arena/daily/complete ───────────────────────────────────────────

@router.post("/daily/complete", response_model=CompleteSessionResponse)
async def complete_daily_arena(
    body: CompleteSessionRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    today = _get_today_str()

    # Check already completed
    existing_attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id, ArenaAttempt.date_str == today
    )
    if existing_attempt:
        raise HTTPException(status_code=400, detail="Daily Arena already completed today")

    # Reuse the regular complete endpoint logic, then add daily bonus
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != student_id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.game_type != "daily":
        raise HTTPException(status_code=400, detail="Not a daily session")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")
    if _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")

    # Score and time server-side
    total_xp = sum(a.xp_earned for a in session.answers) + DAILY_COMPLETION_BONUS
    total_time_ms = sum(a.elapsed_ms for a in session.answers)
    correct_count = sum(1 for a in session.answers if a.is_correct)
    total_q = len(session.question_ids)
    accuracy = correct_count / total_q if total_q > 0 else 0.0
    is_perfect = accuracy == 1.0
    if is_perfect:
        total_xp += PERFECT_ARENA_BONUS

    session.total_xp = total_xp
    session.total_time_ms = total_time_ms
    session.correct_count = correct_count
    session.accuracy = accuracy
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    await session.save()

    # Record attempt with timing (for daily leaderboard ranking based on speed)
    await ArenaAttempt(
        student_id=student_id,
        date_str=today,
        session_ids=[session.session_id],
        total_xp=total_xp,
        accuracy=accuracy,
        total_time_ms=total_time_ms,
    ).insert()

    from beanie import PydanticObjectId
    questions = []
    for qid in session.question_ids:
        try:
            q = await ArenaQuestion.get(PydanticObjectId(qid))
            if q:
                questions.append(q)
        except Exception:
            pass

    q_map = {str(q.id): q for q in questions}
    answer_summaries = [
        AnswerSummary(
            question_id=a.question_id,
            question=q_map[a.question_id].question if a.question_id in q_map else "",
            skill=q_map[a.question_id].skill if a.question_id in q_map else "",
            submitted_key=a.submitted_key,
            correct_key=q_map[a.question_id].correct_key if a.question_id in q_map else "",
            is_correct=a.is_correct,
            xp_earned=a.xp_earned,
            explanation=q_map[a.question_id].explanation if a.question_id in q_map else "",
        )
        for a in session.answers
    ]

    # Update stats + streak
    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)
    old_level_info = get_level_info(stats.total_xp)
    old_level = old_level_info["level"]

    stats.total_xp += total_xp
    stats.weekly_xp += total_xp
    _update_skill_scores(stats, session, questions)
    await _update_streak(stats, today)

    new_level_info = get_level_info(stats.total_xp)
    newly_earned = await _check_and_award_badges(stats, session)
    stats.updated_at = datetime.now(timezone.utc)
    await stats.save()

    return CompleteSessionResponse(
        session_id=session.session_id,
        game_type="daily",
        total_xp=total_xp,
        correct_count=correct_count,
        total_questions=total_q,
        accuracy=round(accuracy * 100, 1),
        is_perfect=is_perfect,
        total_time_ms=total_time_ms,
        total_time_str=_format_time_ms(total_time_ms),
        answers=answer_summaries,
        new_total_xp=stats.total_xp,
        level_info=new_level_info,
        leveled_up=new_level_info["level"] > old_level,
        old_level=old_level,
        arena_streak=stats.arena_streak,
        badges_earned=newly_earned,
    )


# ─── GET /v1/arena/results/{session_id} ──────────────────────────────────────

@router.get("/results/{session_id}", response_model=CompleteSessionResponse)
async def get_session_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != student_id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session not yet completed")

    from beanie import PydanticObjectId
    questions = []
    for qid in session.question_ids:
        try:
            q = await ArenaQuestion.get(PydanticObjectId(qid))
            if q:
                questions.append(q)
        except Exception:
            pass

    q_map = {str(q.id): q for q in questions}
    answer_summaries = [
        AnswerSummary(
            question_id=a.question_id,
            question=q_map[a.question_id].question if a.question_id in q_map else "",
            skill=q_map[a.question_id].skill if a.question_id in q_map else "",
            submitted_key=a.submitted_key,
            correct_key=q_map[a.question_id].correct_key if a.question_id in q_map else "",
            is_correct=a.is_correct,
            xp_earned=a.xp_earned,
            explanation=q_map[a.question_id].explanation if a.question_id in q_map else "",
        )
        for a in session.answers
    ]

    stats = await ArenaUserStats.get_or_create(student_id)
    level_info = get_level_info(stats.total_xp)

    return CompleteSessionResponse(
        session_id=session.session_id,
        game_type=session.game_type,
        total_xp=session.total_xp,
        correct_count=session.correct_count,
        total_questions=len(session.question_ids),
        accuracy=round(session.accuracy * 100, 1),
        is_perfect=session.accuracy == 1.0,
        answers=answer_summaries,
        new_total_xp=stats.total_xp,
        level_info=level_info,
        leveled_up=False,
        old_level=level_info["level"],
        arena_streak=stats.arena_streak,
        badges_earned=[],
    )


# ─── GET /v1/arena/leaderboard ────────────────────────────────────────────────

@router.get("/leaderboard", response_model=ArenaLeaderboardResponse)
async def get_arena_leaderboard(
    scope: str = Query("today", regex="^(today|weekly|lifetime)$"),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    today = _get_today_str()

    entries = []
    my_entry = None

    if scope == "today":
        # Rank by score (descending) and time taken (ascending - fastest first)
        attempts = await ArenaAttempt.find(ArenaAttempt.date_str == today).to_list(None)
        attempts.sort(key=lambda x: (-x.total_xp, x.total_time_ms))

        for i, a in enumerate(attempts):
            profile = await StudentProfile.find_one(StudentProfile.student_id == a.student_id)
            stats = await ArenaUserStats.get_or_create(a.student_id)
            name = profile.name if profile else "Student"
            initials = "".join(w[0].upper() for w in name.split()[:2]) if name else "S"
            level_info = get_level_info(stats.total_xp)

            entry = ArenaLeaderboardEntry(
                rank=i + 1,
                student_id=a.student_id,
                name=name,
                avatar_initials=initials,
                level=level_info["level"],
                xp=a.total_xp,
                arena_streak=stats.arena_streak,
                time_taken_ms=a.total_time_ms,
                time_taken_str=_format_time_ms(a.total_time_ms),
                is_me=a.student_id == student_id,
            )
            entries.append(entry)
            if a.student_id == student_id:
                my_entry = entry

        total_count = len(attempts)
    else:
        sort_field = ArenaUserStats.weekly_xp if scope == "weekly" else ArenaUserStats.total_xp
        all_stats = await ArenaUserStats.find().sort(-sort_field).to_list(None)

        for i, s in enumerate(all_stats):
            profile = await StudentProfile.find_one(StudentProfile.student_id == s.student_id)
            name = profile.name if profile else "Student"
            initials = "".join(w[0].upper() for w in name.split()[:2]) if name else "S"
            level_info = get_level_info(s.total_xp)
            xp = s.weekly_xp if scope == "weekly" else s.total_xp

            entry = ArenaLeaderboardEntry(
                rank=i + 1,
                student_id=s.student_id,
                name=name,
                avatar_initials=initials,
                level=level_info["level"],
                xp=xp,
                arena_streak=s.arena_streak,
                is_me=s.student_id == student_id,
            )
            entries.append(entry)
            if s.student_id == student_id:
                my_entry = entry

        total_count = len(all_stats)

    # Keep top 50 + always include the current user
    display = entries[:50]
    if my_entry and my_entry not in display:
        display.append(my_entry)

    return ArenaLeaderboardResponse(
        scope=scope,
        entries=display,
        my_entry=my_entry,
        total=total_count,
    )


# ─── GET /v1/arena/profile ────────────────────────────────────────────────────

@router.get("/profile")
async def get_arena_profile(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)
    level_info = get_level_info(stats.total_xp)

    all_badges = await ArenaBadge.find(ArenaBadge.is_active == True).to_list()
    user_badges = await UserBadge.find(UserBadge.student_id == student_id).to_list()
    earned_ids = {ub.badge_id: ub.earned_at for ub in user_badges}

    badges_out = [
        {
            "badge_id": b.badge_id,
            "name": b.name,
            "description": b.description,
            "icon": b.icon,
            "earned": b.badge_id in earned_ids,
            "earned_at": earned_ids[b.badge_id].isoformat() if b.badge_id in earned_ids else None,
        }
        for b in all_badges
    ]

    await stats.save()

    return {
        "total_xp": stats.total_xp,
        "weekly_xp": stats.weekly_xp,
        "level": level_info["level"],
        "xp_in_level": level_info["xp_in_level"],
        "xp_for_next_level": level_info["xp_for_next_level"],
        "progress_pct": level_info["progress_pct"],
        "arena_streak": stats.arena_streak,
        "longest_arena_streak": stats.longest_arena_streak,
        "last_arena_date": stats.last_arena_date,
        "skill_scores": stats.skill_scores,
        "badges": badges_out,
    }


# ─── GET /v1/arena/skills ────────────────────────────────────────────────────

@router.get("/skills", response_model=SkillsResponse)
async def get_skill_breakdown(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    stats = await ArenaUserStats.get_or_create(student_id)

    ROADMAP_LINKS = {
        "javascript": "/student/roadmap",
        "python": "/student/roadmap",
        "react": "/student/roadmap",
        "sql": "/student/roadmap",
        "system_design": "/student/roadmap",
        "backend": "/student/roadmap",
        "devops": "/student/roadmap",
    }

    skills = []
    weakest = None
    weakest_score = 101.0

    for skill, v in stats.skill_scores.items():
        score = v.get("score", 0.0)
        is_weak = score < WEAK_SKILL_THRESHOLD and v.get("total", 0) >= 3
        action = (
            f"Review {skill.replace('_', ' ').title()} fundamentals"
            if is_weak
            else f"Keep practicing {skill.replace('_', ' ').title()}"
        )
        skills.append(SkillRecommendation(
            skill=skill,
            accuracy=score,
            is_weak=is_weak,
            recommended_action=action,
            roadmap_link=ROADMAP_LINKS.get(skill),
        ))
        if is_weak and score < weakest_score:
            weakest_score = score
            weakest = skill

    skills.sort(key=lambda x: x.accuracy)

    return SkillsResponse(skills=skills, weakest_skill=weakest)
