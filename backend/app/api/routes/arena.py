
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
    ArenaUserStats,
    ArenaBadge,
    UserBadge,
    AnswerRecord,
    get_level_info,
    calculate_speed_bonus,
    score_spot_bug,
    score_order_it,
    score_stack_it,
)
from app.models.student_profile import StudentProfile
from app.models.skill_gap import StudentSkillLevel
from app.schemas.arena_schema import (
    StartSessionRequest,
    StartSessionResponse,
    ArenaQuestionOut,
    ArenaOptionOut,
    SpotBugPayloadOut,
    SpotBugCardOut,
    SpotBugCardReveal,
    OrderItPayloadOut,
    OrderItItemOut,
    StackItPayloadOut,
    StackItZoneOut,
    StackItComponentOut,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SubmitSpotBugRequest,
    SpotBugAnswerResponse,
    SubmitOrderItRequest,
    OrderItAnswerResponse,
    SubmitStackItRequest,
    StackItAnswerResponse,
    CompleteSessionRequest,
    CompleteSessionResponse,
    ArenaGameResult,
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
    get_or_create_daily_arena_v2,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/arena", tags=["Game Arena"])

SESSION_BUFFER_S = 300
DAILY_COMPLETION_BONUS = 50
PERFECT_ARENA_BONUS = 50
WEAK_SKILL_THRESHOLD = 65.0
WEEKLY_RESET_DAY = 0

GAME_TYPE_LABELS = {
    "spotbug": "Spot the Bug",
    "orderit": "Order the Steps",
    "stackit": "Stack It",
    "quick_fire": "Quick Fire",
    "debug_rush": "Debug Rush",
    "tech_decision": "Tech Decision",
    "daily": "Daily Arena",
}

QUESTIONS_PER_GAME = {
    "quick_fire": 10,
    "debug_rush": 10,
    "tech_decision": 10,
    "spotbug": 1,
    "orderit": 1,
    "stackit": 1,
}


#  Helpers 

def _get_today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _format_time_ms(ms: int) -> str:
    if not ms or ms <= 0:
        return "0s"
    seconds = int(ms / 1000)
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    rem = seconds % 60
    return f"{minutes}m {rem:02d}s"


def _is_expired(expires_at: Optional[datetime]) -> bool:
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > expires_at


def _next_local_midnight_utc() -> datetime:
    """Return the next UTC datetime corresponding to midnight in UTC+5:30 (IST), as a proxy for 'next calendar day'."""
    now_utc = datetime.now(timezone.utc)
    # Use UTC midnight as the reset — simple, universal, consistent.
    tomorrow = (now_utc + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return tomorrow


def _build_question_out(q: ArenaQuestion) -> ArenaQuestionOut:
    """Build a safe outbound question — answer fields stripped."""
    spotbug_out = None
    orderit_out = None
    stackit_out = None

    if q.game_type == "spotbug" and q.spotbug_payload:
        # Strip is_buggy and fix_explanation from cards — revealed only after user calls each card
        spotbug_out = SpotBugPayloadOut(
            cards=[SpotBugCardOut(id=c.id, snippet=c.snippet) for c in q.spotbug_payload.cards]
        )

    elif q.game_type == "orderit" and q.orderit_payload:
        # Strip correct_order
        orderit_out = OrderItPayloadOut(
            items=[OrderItItemOut(id=item.id, label=item.label) for item in q.orderit_payload.items]
        )

    elif q.game_type == "stackit" and q.stackit_payload:
        # Strip correct_zone_id from components
        stackit_out = StackItPayloadOut(
            scenario=q.stackit_payload.scenario,
            zones=[StackItZoneOut(id=z.id, label=z.label) for z in q.stackit_payload.zones],
            components=[
                StackItComponentOut(id=c.id, label=c.label)
                for c in q.stackit_payload.components
            ],
        )

    return ArenaQuestionOut(
        question_id=str(q.id),
        game_type=q.game_type,
        question=q.question,
        skill=q.skill,
        difficulty=q.difficulty,
        time_limit=q.time_limit,
        xp_reward=q.xp_reward,
        spotbug_payload=spotbug_out,
        orderit_payload=orderit_out,
        stackit_payload=stackit_out,
        options=[ArenaOptionOut(key=o.key, text=o.text) for o in q.options] if q.options else None,
        code_snippet=q.code_snippet,
        scenario=q.scenario,
    )


async def _get_student_skills_and_role(student_id: str):
    skills = []
    try:
        skill_levels = await StudentSkillLevel.find(StudentSkillLevel.student_id == student_id).to_list()
        for sl in skill_levels:
            if sl.skill and sl.skill not in skills:
                skills.append(sl.skill)
    except Exception as e:
        logger.warning(f"Failed to fetch student skill levels: {e}")

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
        skills = ["JavaScript", "TypeScript", "Python", "React", "SQL"]
    return skills, target_role


async def _check_and_award_badges(stats: ArenaUserStats, session: ArenaSession) -> List[str]:
    newly_earned = []
    existing = set(stats.badges_earned)
    badges = await ArenaBadge.find(ArenaBadge.is_active == True).to_list()

    for badge in badges:
        if badge.badge_id in existing:
            continue
        earned = False
        bt = badge.requirement_type
        bv = badge.requirement_value

        if bt == "arena_streak" and stats.arena_streak >= bv:
            earned = True
        elif bt in ("spotbug_solved", "debug_rush_solved"):
            gt = "spotbug" if bt == "spotbug_solved" else "debug_rush"
            count = await ArenaSession.find(
                ArenaSession.student_id == stats.student_id,
                ArenaSession.game_type == gt,
                ArenaSession.status == "completed",
            ).count()
            if count >= bv:
                earned = True
        elif bt in ("stackit_solved", "tech_decision_solved"):
            gt = "stackit" if bt == "stackit_solved" else "tech_decision"
            count = await ArenaSession.find(
                ArenaSession.student_id == stats.student_id,
                ArenaSession.game_type == gt,
                ArenaSession.status == "completed",
            ).count()
            if count >= bv:
                earned = True
        elif bt == "orderit_solved":
            count = await ArenaSession.find(
                ArenaSession.student_id == stats.student_id,
                ArenaSession.game_type == "orderit",
                ArenaSession.status == "completed",
            ).count()
            if count >= bv:
                earned = True
        elif bt == "perfect_run" and session.accuracy == 1.0:
            earned = True
        elif bt == "questions_under_5s":
            fast_answers = sum(1 for a in session.answers if a.elapsed_ms <= 5000 and a.is_correct)
            if fast_answers >= bv:
                earned = True

        if earned:
            newly_earned.append(badge.badge_id)
            await UserBadge(student_id=stats.student_id, badge_id=badge.badge_id).insert()

    if newly_earned:
        stats.badges_earned.extend(newly_earned)
    return newly_earned


async def _update_streak(stats: ArenaUserStats, today: str) -> int:
    if stats.last_arena_date == today:
        return stats.arena_streak
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
    q_map = {str(q.id): q for q in questions}
    for answer in session.answers:
        q = q_map.get(answer.question_id)
        if not q:
            continue
        skill = q.skill
        if skill not in stats.skill_scores:
            stats.skill_scores[skill] = {"correct": 0, "total": 0, "score": 0.0}
        stats.skill_scores[skill]["total"] += 1
        if answer.accuracy >= 0.5:  # V2: treat ≥50% accuracy as "correct" for skill score
            stats.skill_scores[skill]["correct"] += 1
        t = stats.skill_scores[skill]["total"]
        c = stats.skill_scores[skill]["correct"]
        stats.skill_scores[skill]["score"] = round(c / t * 100, 1)


async def _ensure_weekly_reset(stats: ArenaUserStats):
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    last_monday = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    reset_at = stats.weekly_xp_reset_at
    if reset_at is not None and reset_at.tzinfo is None:
        reset_at = reset_at.replace(tzinfo=timezone.utc)
    if reset_at is None or reset_at < last_monday:
        stats.weekly_xp = 0
        stats.weekly_xp_reset_at = last_monday


#  GET /v1/arena/home 

@router.get("/home", response_model=ArenaHomeResponse)
async def get_arena_home(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)
    level_info = get_level_info(stats.total_xp)
    today = _get_today_str()

    # Check daily completion
    attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id,
        ArenaAttempt.date_str == today,
    )

    # Check if a daily session is pre-generated for today
    daily_session = await ArenaSession.find_one(
        ArenaSession.student_id == student_id,
        ArenaSession.game_type == "daily",
        ArenaSession.daily_date == today,
    )

    next_reset_at = _next_local_midnight_utc().isoformat()

    daily_out = DailyArenaOut(
        date_str=today,
        total_xp=170,  # approximate: 90 spotbug + 20 orderit + 20 stackit + 50 bonus (shown before generation)
        spotbug_ready=daily_session is not None,
        orderit_ready=daily_session is not None,
        stackit_ready=daily_session is not None,
        already_completed=attempt is not None,
        completed_at=attempt.completed_at.isoformat() if attempt else None,
        time_taken_str=_format_time_ms(attempt.total_time_ms) if attempt else None,
        next_reset_at=next_reset_at,
    )

    # Weekly leaderboard preview (top 5)
    top_stats = await ArenaUserStats.find().sort(-ArenaUserStats.weekly_xp).to_list(5)
    all_stats = await ArenaUserStats.find().sort(-ArenaUserStats.weekly_xp).to_list(None)

    my_weekly_rank = None
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

    today_attempts = await ArenaAttempt.find(ArenaAttempt.date_str == today).to_list(None)
    today_attempts.sort(key=lambda x: (-x.total_xp, x.total_time_ms))
    my_daily_rank = None
    for i, a in enumerate(today_attempts):
        if a.student_id == student_id:
            my_daily_rank = i + 1
            break

    preview = []
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


#  GET /v1/arena/daily 

@router.get("/daily", response_model=DailyArenaOut)
async def get_daily_arena(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    today = _get_today_str()

    attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id,
        ArenaAttempt.date_str == today,
    )

    daily_session = await ArenaSession.find_one(
        ArenaSession.student_id == student_id,
        ArenaSession.game_type == "daily",
        ArenaSession.daily_date == today,
    )

    return DailyArenaOut(
        date_str=today,
        total_xp=170,
        spotbug_ready=daily_session is not None,
        orderit_ready=daily_session is not None,
        stackit_ready=daily_session is not None,
        already_completed=attempt is not None,
        completed_at=attempt.completed_at.isoformat() if attempt else None,
        time_taken_str=_format_time_ms(attempt.total_time_ms) if attempt else None,
        next_reset_at=_next_local_midnight_utc().isoformat(),
    )


#  POST /v1/arena/daily/start 

@router.post("/daily/start", response_model=StartSessionResponse)
async def start_daily_arena(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    today = _get_today_str()

    # Server-side lock: already completed today
    attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id,
        ArenaAttempt.date_str == today,
    )
    if attempt:
        raise HTTPException(
            status_code=400,
            detail="Daily Arena already completed today. Come back after midnight for a new set!",
        )

    # Get skill scores for targeting
    stats = await ArenaUserStats.get_or_create(student_id)
    skill_scores = stats.skill_scores or {}

    # Generate (or return cached) daily session for this student+day
    daily_session, error_msg = await get_or_create_daily_arena_v2(
        student_id=student_id,
        date_str=today,
        skill_scores=skill_scores,
    )

    if error_msg or not daily_session:
        raise HTTPException(
            status_code=503,
            detail=error_msg or "Today's Arena is taking longer than usual — try again shortly.",
        )

    # Fetch the three questions
    from beanie import PydanticObjectId
    questions = []
    for qid in daily_session.question_ids:
        try:
            q = await ArenaQuestion.get(PydanticObjectId(qid))
            if q:
                questions.append(q)
        except Exception:
            pass

    if not questions:
        raise HTTPException(status_code=503, detail="Daily challenge questions not found.")

    return StartSessionResponse(
        session_id=daily_session.session_id,
        game_type="daily",
        questions=[_build_question_out(q) for q in questions],
        expires_at=daily_session.expires_at.isoformat(),
        total_questions=len(questions),
    )


# ─── POST /v1/arena/start (individual game — legacy + spotbug/orderit/stackit) ─

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
            detail=f"You have already completed {label} today! Come back tomorrow.",
        )

    import random

    # V2 games: generate questions on-demand
    if game_type in ("spotbug", "orderit", "stackit"):
        stats = await ArenaUserStats.get_or_create(student_id)
        from app.services.arena_service import (
            generate_spotbug_question,
            generate_orderit_question,
            generate_multiple_orderit_questions,
            generate_stackit_question,
            generate_multiple_stackit_questions,
            _pick_weak_skills,
        )
        weak_skills = _pick_weak_skills(stats.skill_scores or {}, count=1)
        target_skill = weak_skills[0] if weak_skills else "JavaScript Fundamentals"

        questions = []
        if game_type == "orderit":
            questions = await generate_multiple_orderit_questions(
                target_skill, difficulty, count=5, student_id=student_id
            )
            if not questions:
                q_single = await generate_orderit_question(target_skill, difficulty, student_id)
                if q_single:
                    questions = [q_single]
        elif game_type == "stackit":
            questions = await generate_multiple_stackit_questions(
                target_skill, difficulty, count=5, student_id=student_id
            )
            if not questions:
                q_single = await generate_stackit_question(target_skill, difficulty, student_id)
                if q_single:
                    questions = [q_single]
        elif game_type == "spotbug":
            q_single = await generate_spotbug_question(target_skill, difficulty, student_id)
            if q_single:
                questions = [q_single]

        if not questions:
            raise HTTPException(status_code=503, detail=f"Failed to generate {game_type} question.")

        total_time = sum(q.time_limit for q in questions) + SESSION_BUFFER_S
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=total_time)
        session = ArenaSession(
            session_id=str(uuid.uuid4()),
            student_id=student_id,
            game_type=game_type,
            question_ids=[str(q.id) for q in questions],
            expires_at=expires_at,
        )
        await session.insert()
        return StartSessionResponse(
            session_id=session.session_id,
            game_type=game_type,
            questions=[_build_question_out(q) for q in questions],
            expires_at=expires_at.isoformat(),
            total_questions=len(questions),
        )

    # V1 legacy: quick_fire (MCQ)
    n_questions = QUESTIONS_PER_GAME.get(game_type, 10)
    all_qs = await ArenaQuestion.find(
        ArenaQuestion.game_type == game_type,
        ArenaQuestion.is_active == True,
    ).to_list(None)

    student_skills, target_role = await _get_student_skills_and_role(student_id)
    if len(all_qs) < n_questions and game_type == "quick_fire":
        generated = await generate_quick_fire_questions(n_questions, difficulty, student_skills, target_role)
        all_qs.extend(generated)

    if not all_qs:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions for {game_type}")

    selected = random.sample(all_qs, min(n_questions, len(all_qs)))
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


# ─── POST /v1/arena/answer/spotbug ───────────────────────────────────────────

@router.post("/answer/spotbug", response_model=SpotBugAnswerResponse)
async def submit_spotbug_answer(
    body: SubmitSpotBugRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session or session.student_id != student_id:
        logger.warning(f"SpotBug answer rejected: session not found or student mismatch {body.session_id}")
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        logger.warning(f"SpotBug answer rejected: session status is {session.status}")
        raise HTTPException(status_code=400, detail=f"Session is {session.status}")
    if _is_expired(session.expires_at):
        logger.warning(f"SpotBug answer rejected: session expired at {session.expires_at}")
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")
    if body.question_id not in session.question_ids:
        logger.warning(f"SpotBug answer rejected: question {body.question_id} not in session {session.question_ids}")
        raise HTTPException(status_code=400, detail="Question not in this session")
    if any(a.question_id == body.question_id for a in session.answers):
        logger.warning(f"SpotBug answer rejected: question {body.question_id} already answered")
        raise HTTPException(status_code=400, detail="Question already answered")

    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(body.question_id))
    except Exception as e:
        logger.warning(f"SpotBug question fetch failed for {body.question_id}: {e}")
        raise HTTPException(status_code=404, detail="Question not found")

    if not q or not q.spotbug_payload:
        raise HTTPException(status_code=400, detail="Not a spotbug question")

    # Filter calls to only include valid card IDs
    valid_card_ids = {c.id for c in q.spotbug_payload.cards}
    valid_calls = [c for c in body.calls if c.card_id in valid_card_ids]

    max_elapsed = (q.time_limit + 60) * 1000
    elapsed_ms = min(abs(body.elapsed_ms), max_elapsed)

    calls_raw = [c.model_dump() for c in valid_calls]
    result = score_spot_bug(q, calls_raw)

    record = AnswerRecord(
        question_id=body.question_id,
        game_type="spotbug",
        is_correct=result["accuracy"] >= 0.5,
        accuracy=result["accuracy"],
        elapsed_ms=elapsed_ms,
        xp_earned=result["xp"],
        answered_at=datetime.now(timezone.utc),
        raw_calls=calls_raw,
    )
    session.answers.append(record)
    await session.save()

    # Build card reveals with safe fallback for empty strings
    reveals = [
        SpotBugCardReveal(
            id=c.id,
            is_buggy=c.is_buggy,
            fix_explanation=c.fix_explanation or "",
        )
        for c in q.spotbug_payload.cards
    ]

    return SpotBugAnswerResponse(
        accuracy=result["accuracy"],
        xp_earned=result["xp"],
        correct_count=result["correct"],
        total_cards=result["total"],
        card_reveals=reveals,
        explanation=q.explanation or "",
    )


#  POST /v1/arena/answer/orderit 

@router.post("/answer/orderit", response_model=OrderItAnswerResponse)
async def submit_orderit_answer(
    body: SubmitOrderItRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {session.status}")
    if _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")
    if body.question_id not in session.question_ids:
        raise HTTPException(status_code=400, detail="Question not in this session")
    if any(a.question_id == body.question_id for a in session.answers):
        raise HTTPException(status_code=400, detail="Question already answered")

    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(body.question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")

    if not q.orderit_payload:
        raise HTTPException(status_code=400, detail="Not an orderit question")

    # Validate item IDs
    valid_ids = {item.id for item in q.orderit_payload.items}
    for item_id in body.user_order:
        if item_id not in valid_ids:
            raise HTTPException(status_code=400, detail=f"Invalid item id: {item_id}")

    max_elapsed = (q.time_limit + 30) * 1000
    elapsed_ms = min(abs(body.elapsed_ms), max_elapsed)

    result = score_order_it(q, body.user_order)

    record = AnswerRecord(
        question_id=body.question_id,
        game_type="orderit",
        is_correct=result["accuracy"] >= 0.8,
        accuracy=result["accuracy"],
        elapsed_ms=elapsed_ms,
        xp_earned=result["xp"],
        answered_at=datetime.now(timezone.utc),
        raw_user_order=body.user_order,
    )
    session.answers.append(record)
    await session.save()

    return OrderItAnswerResponse(
        accuracy=result["accuracy"],
        xp_earned=result["xp"],
        correct_positions=result["correct_positions"],
        total_items=result["total"],
        correct_order=q.orderit_payload.correct_order,
        explanation=q.explanation,
    )


#  POST /v1/arena/answer/stackit 

@router.post("/answer/stackit", response_model=StackItAnswerResponse)
async def submit_stackit_answer(
    body: SubmitStackItRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {session.status}")
    if _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")
    if body.question_id not in session.question_ids:
        raise HTTPException(status_code=400, detail="Question not in this session")
    if any(a.question_id == body.question_id for a in session.answers):
        raise HTTPException(status_code=400, detail="Question already answered")

    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(body.question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")

    if not q.stackit_payload:
        raise HTTPException(status_code=400, detail="Not a stackit question")

    # Validate component and zone IDs
    valid_component_ids = {c.id for c in q.stackit_payload.components}
    valid_zone_ids = {z.id for z in q.stackit_payload.zones}
    for p in body.placements:
        if p.get("component_id") not in valid_component_ids:
            raise HTTPException(status_code=400, detail=f"Invalid component_id: {p.get('component_id')}")
        if p.get("placed_zone_id") not in valid_zone_ids:
            raise HTTPException(status_code=400, detail=f"Invalid placed_zone_id: {p.get('placed_zone_id')}")

    max_elapsed = (q.time_limit + 30) * 1000
    elapsed_ms = min(abs(body.elapsed_ms), max_elapsed)

    result = score_stack_it(q, body.placements)

    record = AnswerRecord(
        question_id=body.question_id,
        game_type="stackit",
        is_correct=result["accuracy"] >= 0.8,
        accuracy=result["accuracy"],
        elapsed_ms=elapsed_ms,
        xp_earned=result["xp"],
        answered_at=datetime.now(timezone.utc),
        raw_placements=body.placements,
    )
    session.answers.append(record)
    await session.save()

    # Reveal correct placements
    correct_placements = [
        {"component_id": c.id, "correct_zone_id": c.correct_zone_id}
        for c in q.stackit_payload.components
    ]

    return StackItAnswerResponse(
        accuracy=result["accuracy"],
        xp_earned=result["xp"],
        correct_count=result["correct"],
        total_components=result["total"],
        correct_placements=correct_placements,
        explanation=q.explanation,
    )


#  POST /v1/arena/answer (legacy MCQ) 

@router.post("/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    body: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {session.status}")
    if _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")
    if body.question_id not in session.question_ids:
        raise HTTPException(status_code=400, detail="Question not in this session")
    if any(a.question_id == body.question_id for a in session.answers):
        raise HTTPException(status_code=400, detail="Question already answered")

    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(body.question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")

    max_elapsed = q.time_limit * 1000 + 2000
    elapsed_ms = min(abs(body.elapsed_ms), max_elapsed)
    is_correct = body.answer_key.upper() == q.correct_key.upper()
    speed_bonus = calculate_speed_bonus(elapsed_ms, q.time_limit) if is_correct else 0
    xp_earned = (q.xp_reward + speed_bonus) if is_correct else 0

    record = AnswerRecord(
        question_id=body.question_id,
        game_type=q.game_type,
        is_correct=is_correct,
        accuracy=1.0 if is_correct else 0.0,
        elapsed_ms=elapsed_ms,
        xp_earned=xp_earned,
        answered_at=datetime.now(timezone.utc),
        submitted_key=body.answer_key.upper(),
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


#  POST /v1/arena/complete (individual game) 

@router.post("/complete", response_model=CompleteSessionResponse)
async def complete_session(
    body: CompleteSessionRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")
    if session.status == "expired" or _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")

    total_xp = sum(a.xp_earned for a in session.answers)
    total_time_ms = sum(a.elapsed_ms for a in session.answers)
    # For V2 games, use average accuracy across answers
    correct_count = sum(1 for a in session.answers if a.is_correct)
    total_q = len(session.question_ids)
    accuracy = (
        sum(a.accuracy for a in session.answers) / len(session.answers)
        if session.answers else 0.0
    )
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

    # Log to ActivityLog so it appears on My Activity feed & heatmap
    try:
        from app.models.activity_log import ActivityLog
        from app.api.routes.students import sync_student_streak, compute_realtime_score
        game_label = GAME_TYPE_LABELS.get(session.game_type, session.game_type)
        await ActivityLog(
            student_id=student_id,
            type="assessment",
            title=f"Skill Game: {game_label}",
            detail=f"Completed {game_label} · {round(accuracy * 100, 1)}% accuracy · +{total_xp} XP ({correct_count}/{total_q} correct)",
        ).insert()
        await sync_student_streak(student_id)
        await compute_realtime_score(student_id)
    except Exception as e:
        logger.warning(f"Could not log arena session activity: {e}")

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
            game_type=a.game_type,
            accuracy=a.accuracy,
            is_correct=a.is_correct,
            xp_earned=a.xp_earned,
            explanation=q_map[a.question_id].explanation if a.question_id in q_map else "",
            submitted_key=a.submitted_key,
            correct_key=q_map[a.question_id].correct_key if a.question_id in q_map else "",
        )
        for a in session.answers
    ]

    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)
    old_level = get_level_info(stats.total_xp)["level"]
    stats.total_xp += total_xp
    stats.weekly_xp += total_xp
    _update_skill_scores(stats, session, questions)
    new_level_info = get_level_info(stats.total_xp)
    newly_earned = await _check_and_award_badges(stats, session)
    stats.updated_at = datetime.now(timezone.utc)
    await stats.save()

    game_results = [
        ArenaGameResult(
            game_type=a.game_type,
            skill=q_map[a.question_id].skill if a.question_id in q_map else "",
            accuracy=a.accuracy,
            xp_earned=a.xp_earned,
            question_id=a.question_id,
        )
        for a in session.answers
    ]

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
        game_results=game_results,
        new_total_xp=stats.total_xp,
        level_info=new_level_info,
        leveled_up=new_level_info["level"] > old_level,
        old_level=old_level,
        arena_streak=stats.arena_streak,
        badges_earned=newly_earned,
    )


#  POST /v1/arena/daily/complete 

@router.post("/daily/complete", response_model=CompleteSessionResponse)
async def complete_daily_arena(
    body: CompleteSessionRequest,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    today = _get_today_str()

    # Server-side idempotency check
    existing_attempt = await ArenaAttempt.find_one(
        ArenaAttempt.student_id == student_id,
        ArenaAttempt.date_str == today,
    )
    if existing_attempt:
        raise HTTPException(status_code=400, detail="Daily Arena already completed today")

    session = await ArenaSession.find_one(ArenaSession.session_id == body.session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.game_type != "daily":
        raise HTTPException(status_code=400, detail="Not a daily session")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")
    if _is_expired(session.expires_at):
        session.status = "expired"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has expired")

    # Score server-side (sum of per-game answers)
    per_game_xp = sum(a.xp_earned for a in session.answers)
    total_xp = per_game_xp + DAILY_COMPLETION_BONUS
    total_time_ms = sum(a.elapsed_ms for a in session.answers)
    correct_count = sum(1 for a in session.answers if a.is_correct)
    total_q = len(session.question_ids)
    accuracy = (
        sum(a.accuracy for a in session.answers) / len(session.answers)
        if session.answers else 0.0
    )
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

    # Record attempt
    await ArenaAttempt(
        student_id=student_id,
        date_str=today,
        session_ids=[session.session_id],
        total_xp=total_xp,
        accuracy=accuracy,
        total_time_ms=total_time_ms,
    ).insert()

    # Log to ActivityLog so it appears on My Activity feed & heatmap
    try:
        from app.models.activity_log import ActivityLog
        from app.api.routes.students import sync_student_streak, compute_realtime_score
        await ActivityLog(
            student_id=student_id,
            type="assessment",
            title=f"Daily Assessment: Arena Challenge",
            detail=f"Completed Daily Arena ({total_q} games) · {round(accuracy * 100, 1)}% accuracy · +{total_xp} XP",
        ).insert()
        await sync_student_streak(student_id)
        await compute_realtime_score(student_id)
    except Exception as e:
        logger.warning(f"Could not log daily arena activity: {e}")

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
            game_type=a.game_type,
            accuracy=a.accuracy,
            is_correct=a.is_correct,
            xp_earned=a.xp_earned,
            explanation=q_map[a.question_id].explanation if a.question_id in q_map else "",
        )
        for a in session.answers
    ]

    stats = await ArenaUserStats.get_or_create(student_id)
    await _ensure_weekly_reset(stats)
    old_level = get_level_info(stats.total_xp)["level"]
    stats.total_xp += total_xp
    stats.weekly_xp += total_xp
    _update_skill_scores(stats, session, questions)
    await _update_streak(stats, today)
    new_level_info = get_level_info(stats.total_xp)
    newly_earned = await _check_and_award_badges(stats, session)
    stats.updated_at = datetime.now(timezone.utc)
    await stats.save()

    game_results = [
        ArenaGameResult(
            game_type=a.game_type,
            skill=q_map[a.question_id].skill if a.question_id in q_map else "",
            accuracy=a.accuracy,
            xp_earned=a.xp_earned,
            question_id=a.question_id,
        )
        for a in session.answers
    ]

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
        game_results=game_results,
        new_total_xp=stats.total_xp,
        level_info=new_level_info,
        leveled_up=new_level_info["level"] > old_level,
        old_level=old_level,
        arena_streak=stats.arena_streak,
        badges_earned=newly_earned,
        daily_bonus_xp=DAILY_COMPLETION_BONUS,
    )


#  GET /v1/arena/results/{session_id} 

@router.get("/results/{session_id}", response_model=CompleteSessionResponse)
async def get_session_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    session = await ArenaSession.find_one(ArenaSession.session_id == session_id)
    if not session or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="Session not found")
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
            game_type=a.game_type,
            accuracy=a.accuracy,
            is_correct=a.is_correct,
            xp_earned=a.xp_earned,
            explanation=q_map[a.question_id].explanation if a.question_id in q_map else "",
            submitted_key=a.submitted_key,
            correct_key=q_map[a.question_id].correct_key if a.question_id in q_map else "",
        )
        for a in session.answers
    ]

    stats = await ArenaUserStats.get_or_create(student_id)
    level_info = get_level_info(stats.total_xp)

    game_results = [
        ArenaGameResult(
            game_type=a.game_type,
            skill=q_map[a.question_id].skill if a.question_id in q_map else "",
            accuracy=a.accuracy,
            xp_earned=a.xp_earned,
            question_id=a.question_id,
        )
        for a in session.answers
    ]

    return CompleteSessionResponse(
        session_id=session.session_id,
        game_type=session.game_type,
        total_xp=session.total_xp,
        correct_count=session.correct_count,
        total_questions=len(session.question_ids),
        accuracy=round(session.accuracy * 100, 1),
        is_perfect=session.accuracy == 1.0,
        total_time_ms=session.total_time_ms,
        total_time_str=_format_time_ms(session.total_time_ms),
        answers=answer_summaries,
        game_results=game_results,
        new_total_xp=stats.total_xp,
        level_info=level_info,
        leveled_up=False,
        old_level=level_info["level"],
        arena_streak=stats.arena_streak,
        badges_earned=[],
    )


#  GET /v1/arena/leaderboard 

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
        attempts = await ArenaAttempt.find(ArenaAttempt.date_str == today).to_list(None)
        attempts.sort(key=lambda x: (-x.total_xp, x.total_time_ms))
        for i, a in enumerate(attempts):
            profile = await StudentProfile.find_one(StudentProfile.student_id == a.student_id)
            stats = await ArenaUserStats.get_or_create(a.student_id)
            name = profile.name if profile else "Student"
            initials = "".join(w[0].upper() for w in name.split()[:2]) if name else "S"
            li = get_level_info(stats.total_xp)
            entry = ArenaLeaderboardEntry(
                rank=i + 1,
                student_id=a.student_id,
                name=name,
                avatar_initials=initials,
                level=li["level"],
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
            li = get_level_info(s.total_xp)
            xp = s.weekly_xp if scope == "weekly" else s.total_xp
            entry = ArenaLeaderboardEntry(
                rank=i + 1,
                student_id=s.student_id,
                name=name,
                avatar_initials=initials,
                level=li["level"],
                xp=xp,
                arena_streak=s.arena_streak,
                is_me=s.student_id == student_id,
            )
            entries.append(entry)
            if s.student_id == student_id:
                my_entry = entry
        total_count = len(all_stats)

    display = entries[:50]
    if my_entry and my_entry not in display:
        display.append(my_entry)

    return ArenaLeaderboardResponse(
        scope=scope,
        entries=display,
        my_entry=my_entry,
        total=total_count,
    )


#  GET /v1/arena/profile 

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


#  GET /v1/arena/skills 

@router.get("/skills", response_model=SkillsResponse)
async def get_skill_breakdown(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    stats = await ArenaUserStats.get_or_create(student_id)

    ROADMAP_LINKS = {
        "JavaScript Fundamentals": "/student/roadmap",
        "React Hooks": "/student/roadmap",
        "API Design": "/student/roadmap",
    }

    skills = []
    weakest = None
    weakest_score = 101.0

    for skill, v in stats.skill_scores.items():
        score = v.get("score", 0.0)
        is_weak = score < WEAK_SKILL_THRESHOLD and v.get("total", 0) >= 3
        action = (
            f"Review {skill} fundamentals"
            if is_weak
            else f"Keep practicing {skill}"
        )
        skills.append(SkillRecommendation(
            skill=skill,
            accuracy=score,
            is_weak=is_weak,
            recommended_action=action,
            roadmap_link=ROADMAP_LINKS.get(skill, "/student/roadmap"),
        ))
        if is_weak and score < weakest_score:
            weakest_score = score
            weakest = skill

    skills.sort(key=lambda x: x.accuracy)
    return SkillsResponse(skills=skills, weakest_skill=weakest)
