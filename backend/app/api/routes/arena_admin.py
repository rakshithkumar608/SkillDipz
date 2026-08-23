"""
Arena Admin Routes — Question/Badge/Daily Challenge management.
Requires admin role.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_current_admin
from app.models.arena import ArenaQuestion, ArenaOption, DailyArena, ArenaBadge
from app.schemas.arena_schema import (
    CreateQuestionRequest,
    UpdateQuestionRequest,
    CreateDailyChallengeRequest,
    CreateBadgeRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/arena", tags=["Arena Admin"])


# ─── Questions ────────────────────────────────────────────────────────────────

@router.post("/questions", status_code=201)
async def create_question(
    body: CreateQuestionRequest,
    admin=Depends(get_current_admin),
):
    q = ArenaQuestion(
        game_type=body.game_type,
        skill=body.skill,
        difficulty=body.difficulty,
        question=body.question,
        options=[ArenaOption(key=o.key, text=o.text) for o in body.options],
        correct_key=body.correct_key,
        explanation=body.explanation,
        xp_reward=body.xp_reward,
        time_limit=body.time_limit,
        code_snippet=body.code_snippet,
        bug_line=body.bug_line,
        bug_explanation=body.bug_explanation,
        scenario=body.scenario,
    )
    await q.insert()
    return {"message": "Question created", "question_id": str(q.id)}


@router.get("/questions")
async def list_questions(
    game_type: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin=Depends(get_current_admin),
):
    query = ArenaQuestion.find()
    if game_type:
        query = ArenaQuestion.find(ArenaQuestion.game_type == game_type)
    if skill:
        query = ArenaQuestion.find(ArenaQuestion.skill == skill)
    if is_active is not None:
        query = ArenaQuestion.find(ArenaQuestion.is_active == is_active)

    total = await query.count()
    questions = await query.skip((page - 1) * limit).limit(limit).to_list()

    return {
        "total": total,
        "page": page,
        "questions": [
            {
                "id": str(q.id),
                "game_type": q.game_type,
                "skill": q.skill,
                "difficulty": q.difficulty,
                "question": q.question[:80] + "..." if len(q.question) > 80 else q.question,
                "correct_key": q.correct_key,
                "xp_reward": q.xp_reward,
                "time_limit": q.time_limit,
                "is_active": q.is_active,
            }
            for q in questions
        ],
    }


@router.get("/questions/{question_id}")
async def get_question(question_id: str, admin=Depends(get_current_admin)):
    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "id": str(q.id),
        "game_type": q.game_type,
        "skill": q.skill,
        "difficulty": q.difficulty,
        "question": q.question,
        "options": [{"key": o.key, "text": o.text} for o in q.options],
        "correct_key": q.correct_key,
        "explanation": q.explanation,
        "xp_reward": q.xp_reward,
        "time_limit": q.time_limit,
        "code_snippet": q.code_snippet,
        "bug_line": q.bug_line,
        "bug_explanation": q.bug_explanation,
        "scenario": q.scenario,
        "is_active": q.is_active,
    }


@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    body: UpdateQuestionRequest,
    admin=Depends(get_current_admin),
):
    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")

    updates = body.model_dump(exclude_none=True)
    if "options" in updates:
        updates["options"] = [ArenaOption(key=o["key"], text=o["text"]) for o in updates["options"]]

    for field, value in updates.items():
        setattr(q, field, value)
    await q.save()
    return {"message": "Question updated"}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, admin=Depends(get_current_admin)):
    from beanie import PydanticObjectId
    try:
        q = await ArenaQuestion.get(PydanticObjectId(question_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found")
    q.is_active = False
    await q.save()
    return {"message": "Question deactivated"}


# ─── Daily Challenge ──────────────────────────────────────────────────────────

@router.post("/daily", status_code=201)
async def create_daily_challenge(
    body: CreateDailyChallengeRequest,
    admin=Depends(get_current_admin),
):
    existing = await DailyArena.find_one(DailyArena.date_str == body.date_str)
    if existing:
        raise HTTPException(status_code=400, detail=f"Daily challenge for {body.date_str} already exists")

    total_xp = (len(body.quick_fire_ids) * 10 + len(body.debug_rush_ids) * 20
                + len(body.tech_decision_ids) * 20 + 50)

    daily = DailyArena(
        date_str=body.date_str,
        quick_fire_ids=body.quick_fire_ids,
        debug_rush_ids=body.debug_rush_ids,
        tech_decision_ids=body.tech_decision_ids,
        total_xp=total_xp,
    )
    await daily.insert()
    return {"message": "Daily challenge created", "total_xp": total_xp}


@router.get("/daily")
async def list_daily_challenges(
    page: int = Query(1, ge=1),
    admin=Depends(get_current_admin),
):
    challenges = await DailyArena.find().sort(-DailyArena.date_str).skip((page - 1) * 10).limit(10).to_list()
    return [
        {
            "id": str(c.id),
            "date_str": c.date_str,
            "quick_fire_count": len(c.quick_fire_ids),
            "debug_rush_count": len(c.debug_rush_ids),
            "tech_decision_count": len(c.tech_decision_ids),
            "total_xp": c.total_xp,
            "is_active": c.is_active,
        }
        for c in challenges
    ]


# ─── Badges ───────────────────────────────────────────────────────────────────

@router.post("/badges", status_code=201)
async def create_badge(body: CreateBadgeRequest, admin=Depends(get_current_admin)):
    existing = await ArenaBadge.find_one(ArenaBadge.badge_id == body.badge_id)
    if existing:
        raise HTTPException(status_code=400, detail="Badge ID already exists")
    badge = ArenaBadge(**body.model_dump())
    await badge.insert()
    return {"message": "Badge created", "badge_id": badge.badge_id}


@router.get("/badges")
async def list_badges(admin=Depends(get_current_admin)):
    badges = await ArenaBadge.find().to_list()
    return [
        {
            "id": str(b.id),
            "badge_id": b.badge_id,
            "name": b.name,
            "description": b.description,
            "requirement_type": b.requirement_type,
            "requirement_value": b.requirement_value,
            "icon": b.icon,
            "is_active": b.is_active,
        }
        for b in badges
    ]


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(admin=Depends(get_current_admin)):
    from app.models.arena import ArenaSession, ArenaUserStats

    total_sessions = await ArenaSession.find().count()
    completed = await ArenaSession.find(ArenaSession.status == "completed").count()
    total_players = await ArenaUserStats.find().count()

    by_game = {}
    for gt in ["quick_fire", "debug_rush", "tech_decision", "daily"]:
        by_game[gt] = await ArenaSession.find(
            ArenaSession.game_type == gt,
            ArenaSession.status == "completed",
        ).count()

    avg_accuracy = 0.0
    completed_sessions = await ArenaSession.find(ArenaSession.status == "completed").to_list(None)
    if completed_sessions:
        avg_accuracy = round(
            sum(s.accuracy for s in completed_sessions) / len(completed_sessions) * 100, 1
        )

    return {
        "total_sessions": total_sessions,
        "completed_sessions": completed,
        "completion_rate": round(completed / total_sessions * 100, 1) if total_sessions else 0,
        "total_players": total_players,
        "games_by_type": by_game,
        "average_accuracy": avg_accuracy,
    }
