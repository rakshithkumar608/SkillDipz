"""
Arena models — Game Arena feature
Separate from existing AssessmentQuestion / AssessmentSession (MCQ skill tests).
"""
from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, date, timezone


# ─── Embedded models ─────────────────────────────────────────────────────────

class ArenaOption(BaseModel):
    key: str          # "A", "B", "C", "D"
    text: str


# ─── Arena Question (stored in DB, correct_key NEVER sent to frontend) ───────

class ArenaQuestion(Document):
    game_type: Literal["quick_fire", "debug_rush", "tech_decision"]
    skill: str                          # "javascript", "python", "react", "sql", etc.
    difficulty: Literal["easy", "medium", "hard"] = "medium"

    # Common fields
    question: str
    options: List[ArenaOption]
    correct_key: str                    # "A" / "B" / "C" / "D"
    explanation: str = ""
    xp_reward: int = 10                 # base XP for correct answer
    time_limit: int = 30                # seconds per question
    is_active: bool = True

    # Debug Rush extras
    code_snippet: Optional[str] = None  # the broken code
    bug_line: Optional[int] = None      # 1-indexed line that contains the bug
    bug_explanation: Optional[str] = None

    # Tech Decision extras
    scenario: Optional[str] = None      # longer scenario text shown above options

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_questions"


# ─── Arena Session (one game run) ─────────────────────────────────────────────

class AnswerRecord(BaseModel):
    question_id: str
    submitted_key: str
    is_correct: bool
    elapsed_ms: int
    xp_earned: int
    answered_at: datetime


class ArenaSession(Document):
    session_id: str                         # UUID
    student_id: str
    game_type: Literal["quick_fire", "debug_rush", "tech_decision", "daily"]
    question_ids: List[str]                 # ordered list of ArenaQuestion IDs
    answers: List[AnswerRecord] = []
    status: Literal["active", "completed", "expired"] = "active"

    # Computed on completion
    total_xp: int = 0
    correct_count: int = 0
    accuracy: float = 0.0                   # 0.0–1.0
    total_time_ms: int = 0                  # total elapsed time in milliseconds

    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime                    # started_at + time_limit_per_q * n + buffer
    completed_at: Optional[datetime] = None

    # For Daily Arena: links to individual sub-sessions
    sub_session_ids: List[str] = []
    daily_date: Optional[str] = None        # "YYYY-MM-DD"

    class Settings:
        name = "arena_sessions"


# ─── Daily Arena configuration ────────────────────────────────────────────────

class DailyArena(Document):
    date_str: str                           # "YYYY-MM-DD"
    quick_fire_ids: List[str] = []          # ArenaQuestion IDs
    debug_rush_ids: List[str] = []
    tech_decision_ids: List[str] = []
    total_xp: int = 150
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_daily_challenges"


# ─── Daily Arena completion record (one per student per day) ──────────────────

class ArenaAttempt(Document):
    student_id: str
    date_str: str                           # "YYYY-MM-DD"
    session_ids: List[str] = []
    total_xp: int = 0
    accuracy: float = 0.0
    total_time_ms: int = 0                  # total time taken to complete the daily arena
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arena_attempts"


# ─── Per-student arena stats (XP, level, streak, skill scores) ───────────────

class SkillScoreEntry(BaseModel):
    correct: int = 0
    total: int = 0
    score: float = 0.0                      # accuracy 0–100


class ArenaUserStats(Document):
    student_id: str

    # XP & Level
    total_xp: int = 0
    weekly_xp: int = 0
    weekly_xp_reset_at: Optional[datetime] = None   # date of last Monday reset

    # Streak (Arena-specific — not the general StudentStreak)
    arena_streak: int = 0
    longest_arena_streak: int = 0
    last_arena_date: Optional[str] = None   # "YYYY-MM-DD"

    # Skill breakdown  {"javascript": {"correct": 10, "total": 15, "score": 66.7}}
    skill_scores: Dict[str, Any] = {}

    # Badges earned  ["speed_demon", "7_day_warrior", ...]
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


# ─── Badge definitions ────────────────────────────────────────────────────────

class ArenaBadge(Document):
    badge_id: str                           # "speed_demon", "7_day_warrior", etc.
    name: str
    description: str
    requirement_type: Literal[
        "questions_under_5s",               # Answer N questions < 5 s
        "arena_streak",                     # Maintain N-day streak
        "debug_rush_solved",                # Solve N Debug Rush challenges
        "tech_decision_solved",             # Solve N Tech Decision challenges
        "perfect_run",                      # 100% accuracy in one Arena
        "weekly_champion",                  # Finish #1 on weekly leaderboard
    ]
    requirement_value: int                  # threshold number
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


# ─── Level helper (pure function, not a model) ───────────────────────────────

def get_level_info(total_xp: int) -> dict:
    """
    Returns level, xp earned in current level, xp needed for next level, % progress.
    Level 1 starts at 0 XP. Each level requires 30% more XP than the previous.
    """
    level = 1
    remaining = total_xp
    xp_for_current = 100  # XP needed to pass level 1 → 2

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


def calculate_speed_bonus(elapsed_ms: int, time_limit_s: int) -> int:
    """
    Returns speed bonus XP (0–15).
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
