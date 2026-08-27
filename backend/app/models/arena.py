
from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, date, timezone


# ─── Legacy stub — kept so database.py can import and register it ─────────────

class DailyArena(Document):
    """
    V1 shared daily set — superseded by per-user ArenaSession in V2.
    Kept as a Beanie document model so database.py initialisation doesn't break.
    No new documents are written to this collection in V2.
    """
    date_str: str = ""
    quick_fire_ids: List[str] = []
    debug_rush_ids: List[str] = []
    tech_decision_ids: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "daily_arenas"


#  Embedded models (shared) 

class ArenaOption(BaseModel):
    key: str          # "A", "B", "C", "D"  — kept for legacy MCQ game types
    text: str


#  Game-type payloads 

class SpotBugCard(BaseModel):
    id: str
    snippet: str          # code line / statement shown on the card
    is_buggy: bool
    fix_explanation: str  # shown only when is_buggy is True; empty string for clean cards


class SpotBugPayload(BaseModel):
    cards: List[SpotBugCard]   # ~12 cards, mix of buggy and clean


class OrderItItem(BaseModel):
    id: str
    label: str               # human-readable step description


class OrderItPayload(BaseModel):
    items: List[OrderItItem]          # shuffled on the client before display
    correct_order: List[str]          # list of item ids in correct sequence — NEVER sent to client


class StackItZone(BaseModel):
    id: str
    label: str               # e.g. "Correct Action", "Harmful / Irrelevant"


class StackItComponent(BaseModel):
    id: str
    label: str               # e.g. "Add Cache Layer", "Reboot the Server"
    correct_zone_id: str     # which zone this component belongs in — NEVER sent to client


class StackItPayload(BaseModel):
    scenario: str
    zones: List[StackItZone]
    components: List[StackItComponent]


# Arena Question  

class ArenaQuestion(Document):
    game_type: Literal[
        "spotbug", "orderit", "stackit",
        "oddoneout", "guessoutput",          # V1.1 additions (not yet built)
        "quick_fire", "debug_rush", "tech_decision",  # V1 legacy — kept for existing docs
    ]
    skill: str                          # e.g. "React Hooks", "API Design"
    difficulty: Literal["easy", "medium", "hard"] = "medium"

    # Common fields
    question: str
    explanation: str = ""
    xp_reward: int = 20                 # base XP before accuracy/combo scaling
    time_limit: int = 60                # seconds for the whole game (not per card)
    is_active: bool = True

    #  V2 payloads 
    spotbug_payload: Optional[SpotBugPayload] = None
    orderit_payload: Optional[OrderItPayload] = None
    stackit_payload: Optional[StackItPayload] = None

    # Legacy MCQ fields (quick_fire / debug_rush / tech_decision) 
    options: List[ArenaOption] = []
    correct_key: str = ""
    code_snippet: Optional[str] = None
    bug_line: Optional[int] = None
    bug_explanation: Optional[str] = None
    scenario: Optional[str] = None      # used by tech_decision (legacy) and stackit

    #  Generation metadata 
    generated_for: Optional[str] = None          # student_id this was generated for
    targeted_skill_gap: Optional[str] = None     # the weak skill targeted, e.g. "React Hooks"
    generated_at: Optional[datetime] = None
    generation_model: Optional[str] = None       # e.g. "llama-3.3-70b-versatile"

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_questions"


#  Answer record 

class AnswerRecord(BaseModel):
    question_id: str
    # Default "" so V1 documents (written before game_type existed) still load
    game_type: str = ""
    is_correct: bool = False
    accuracy: float = 0.0
    elapsed_ms: int = 0
    xp_earned: int = 0
    answered_at: Optional[datetime] = None
    # Legacy MCQ
    submitted_key: str = ""
    # V2 raw payloads (for audit / anti-cheat logging; not shown to user)
    raw_calls: Optional[List[Dict[str, Any]]] = None        # spotbug
    raw_user_order: Optional[List[str]] = None              # orderit
    raw_placements: Optional[List[Dict[str, Any]]] = None   # stackit


#  Arena Session

class ArenaSession(Document):
    session_id: str                         # UUID
    student_id: str
    game_type: Literal[
        "spotbug", "orderit", "stackit", "daily",
        "quick_fire", "debug_rush", "tech_decision",  # V1 legacy
    ]
    question_ids: List[str]                 # ordered list of ArenaQuestion IDs
    answers: List[AnswerRecord] = []
    status: Literal["active", "completed", "expired"] = "active"

    # Computed on completion
    total_xp: int = 0
    correct_count: int = 0
    accuracy: float = 0.0
    total_time_ms: int = 0

    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    completed_at: Optional[datetime] = None

    # Daily Arena fields
    daily_date: Optional[str] = None        # "YYYY-MM-DD" — for per-user daily sessions

    class Settings:
        name = "arena_sessions"


#  Daily Arena completion record

class ArenaAttempt(Document):
    student_id: str
    date_str: str                           # "YYYY-MM-DD"
    session_ids: List[str] = []
    total_xp: int = 0
    accuracy: float = 0.0
    total_time_ms: int = 0
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_attempts"


#  Per-student arena stats

class SkillScoreEntry(BaseModel):
    correct: int = 0
    total: int = 0
    score: float = 0.0                      # accuracy 0–100


class ArenaUserStats(Document):
    student_id: str

    # XP & Level
    total_xp: int = 0
    weekly_xp: int = 0
    weekly_xp_reset_at: Optional[datetime] = None

    # Streak
    arena_streak: int = 0
    longest_arena_streak: int = 0
    last_arena_date: Optional[str] = None   # "YYYY-MM-DD"

    # Skill breakdown  {"React Hooks": {"correct": 8, "total": 12, "score": 66.7}}
    skill_scores: Dict[str, Any] = {}

    # Badges earned
    badges_earned: List[str] = []

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_user_stats"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "ArenaUserStats":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc


#  Badge definitions

class ArenaBadge(Document):
    badge_id: str
    name: str
    description: str
    requirement_type: Literal[
        "questions_under_5s",
        "arena_streak",
        "spotbug_solved",
        "stackit_solved",
        "orderit_solved",
        "perfect_run",
        "weekly_champion",
        # V1 legacy — kept so existing badge records don't break
        "debug_rush_solved",
        "tech_decision_solved",
    ]
    requirement_value: int
    icon: str = "🏆"
    is_active: bool = True

    class Settings:
        name = "arena_badges"


class UserBadge(Document):
    student_id: str
    badge_id: str
    earned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_user_badges"


#  Level helper

def get_level_info(total_xp: int) -> dict:
    """
    Returns level, xp earned in current level, xp needed for next level, % progress.
    Level 1 starts at 0 XP. Each level requires 30% more XP than the previous.
    """
    level = 1
    remaining = total_xp
    xp_for_current = 100

    while remaining >= xp_for_current:
        remaining -= xp_for_current
        level += 1
        xp_for_current = int(xp_for_current * 1.3)

    return {
        "level": level,
        "xp_in_level": remaining,
        "xp_for_next_level": xp_for_current,
        "progress_pct": round(remaining / xp_for_current * 100, 1),
    }


def get_career_tier(overall_score: float, total_xp: int) -> dict:
    """
    Calculates unified Career Readiness Tier based on Employability Score and Total XP.
    """
    lvl_info = get_level_info(total_xp)
    level = lvl_info["level"]

    if overall_score >= 90.0 and total_xp >= 7000:
        tier_name = "Top 1% Elite Engineer"
        badge = "👑"
        color = "from-amber-400 to-yellow-500"
        border_color = "border-amber-400/40"
        tier_level = 5
        min_score = 90
        next_target = "Max Level Achieved - Top Corporate Priority Placement"
    elif overall_score >= 75.0 and total_xp >= 3500:
        tier_name = "Industry Ready Pro"
        badge = "💎"
        color = "from-emerald-400 to-teal-500"
        border_color = "border-emerald-400/40"
        tier_level = 4
        min_score = 75
        next_target = "Aim for 90+ Score & 7,000 XP for Top 1% Elite Tier"
    elif overall_score >= 60.0 and total_xp >= 1500:
        tier_name = "Skilled Practitioner"
        badge = "⚡"
        color = "from-sky-400 to-indigo-500"
        border_color = "border-sky-400/40"
        tier_level = 3
        min_score = 60
        next_target = "Aim for 75+ Score & 3,500 XP for Industry Ready Tier"
    elif overall_score >= 40.0 and total_xp >= 500:
        tier_name = "Emerging Talent"
        badge = "🚀"
        color = "from-violet-400 to-purple-500"
        border_color = "border-violet-400/40"
        tier_level = 2
        min_score = 40
        next_target = "Aim for 60+ Score & 1,500 XP for Skilled Practitioner Tier"
    else:
        tier_name = "Novice Explorer"
        badge = "🌱"
        color = "from-slate-400 to-slate-500"
        border_color = "border-slate-500/40"
        tier_level = 1
        min_score = 0
        next_target = "Aim for 40+ Score & 500 XP to reach Emerging Talent"

    return {
        "tier_name": tier_name,
        "tier_level": tier_level,
        "badge": badge,
        "color": color,
        "border_color": border_color,
        "level": level,
        "total_xp": total_xp,
        "overall_score": overall_score,
        "min_score": min_score,
        "next_target": next_target,
        "level_info": lvl_info,
    }


def calculate_speed_bonus(elapsed_ms: int, time_limit_s: int) -> int:
    """
    Returns speed bonus XP (0–15) for legacy MCQ game types.
    Under 25% of time limit → +15
    Under 50%              → +10
    Under 75%              → +5
    Otherwise              → +0
    """
    ratio = elapsed_ms / (time_limit_s * 1000)
    if ratio < 0.25:
        return 15
    if ratio < 0.50:
        return 10
    if ratio < 0.75:
        return 5
    return 0


#  V2 Scoring functions (run server-side, never client-side)    

def score_spot_bug(question: ArenaQuestion, calls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    calls: [{"card_id": str, "user_said_buggy": bool, "time_taken_ms": int}]
    Returns {"accuracy": float, "xp": int, "correct": int, "total": int}
    """
    if not question.spotbug_payload:
        return {"accuracy": 0.0, "xp": 0, "correct": 0, "total": 0}

    card_map = {c.id: c for c in question.spotbug_payload.cards}
    correct = 0
    combo = 0
    xp = 0
    total = len(calls)

    for call in calls:
        card = card_map.get(call.get("card_id"))
        if not card:
            combo = 0
            continue
        is_correct = call.get("user_said_buggy") == card.is_buggy
        if is_correct:
            correct += 1
            combo += 1
            combo_bonus = min((combo - 3) * 2, 20) if combo > 3 else 0
            xp += 8 + combo_bonus
        else:
            combo = 0

    accuracy = correct / total if total > 0 else 0.0
    return {"accuracy": accuracy, "xp": round(xp), "correct": correct, "total": total}


def score_order_it(question: ArenaQuestion, user_order: List[str]) -> Dict[str, Any]:
    """
    user_order: array of item ids in the order the user placed them.
    Returns {"accuracy": float, "xp": int, "correct_positions": int, "total": int}
    """
    if not question.orderit_payload:
        return {"accuracy": 0.0, "xp": 0, "correct_positions": 0, "total": 0}

    correct_order = question.orderit_payload.correct_order
    total = len(correct_order)
    correct_positions = sum(
        1 for i, item_id in enumerate(user_order)
        if i < total and item_id == correct_order[i]
    )
    accuracy = correct_positions / total if total > 0 else 0.0
    is_fully_correct = accuracy == 1.0

    xp = (
        question.xp_reward
        if is_fully_correct
        else round(question.xp_reward * accuracy * 0.5)
    )
    return {
        "accuracy": accuracy,
        "xp": xp,
        "correct_positions": correct_positions,
        "total": total,
    }


def score_stack_it(question: ArenaQuestion, placements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    placements: [{"component_id": str, "placed_zone_id": str}]
    Returns {"accuracy": float, "xp": int, "correct": int, "total": int}
    """
    if not question.stackit_payload:
        return {"accuracy": 0.0, "xp": 0, "correct": 0, "total": 0}

    component_map = {c.id: c for c in question.stackit_payload.components}
    total = len(question.stackit_payload.components)
    correct = 0

    for placement in placements:
        component = component_map.get(placement.get("component_id"))
        if component and component.correct_zone_id == placement.get("placed_zone_id"):
            correct += 1

    accuracy = correct / total if total > 0 else 0.0
    difficulty_multiplier = {"easy": 1, "medium": 1.5, "hard": 2}.get(question.difficulty, 1)

    return {
        "accuracy": accuracy,
        "xp": round(question.xp_reward * accuracy * difficulty_multiplier),
        "correct": correct,
        "total": total,
    }
