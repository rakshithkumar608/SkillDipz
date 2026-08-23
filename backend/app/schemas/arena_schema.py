"""
Pydantic request / response schemas for the Arena API.
Correct answers are NEVER included in any response schema.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


# ─── Outbound question (no correct_key) ──────────────────────────────────────

class ArenaOptionOut(BaseModel):
    key: str
    text: str


class ArenaQuestionOut(BaseModel):
    question_id: str
    question: str
    options: List[ArenaOptionOut]
    time_limit: int
    xp_reward: int
    skill: str
    code_snippet: Optional[str] = None
    scenario: Optional[str] = None


# ─── Start session ────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    game_type: Literal["quick_fire", "debug_rush", "tech_decision"]
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None


class StartSessionResponse(BaseModel):
    session_id: str
    game_type: str
    questions: List[ArenaQuestionOut]
    expires_at: str          # ISO datetime string
    total_questions: int


# ─── Submit answer ────────────────────────────────────────────────────────────

class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    answer_key: str          # "A" / "B" / "C" / "D"
    elapsed_ms: int          # client-measured, used for speed bonus (server caps it)


class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    correct_key: str
    explanation: str
    xp_earned: int           # base + speed bonus
    speed_bonus: int


# ─── Complete session ─────────────────────────────────────────────────────────

class CompleteSessionRequest(BaseModel):
    session_id: str


class AnswerSummary(BaseModel):
    question_id: str
    question: str
    skill: str
    submitted_key: str
    correct_key: str
    is_correct: bool
    xp_earned: int
    explanation: str


class CompleteSessionResponse(BaseModel):
    session_id: str
    game_type: str
    total_xp: int
    correct_count: int
    total_questions: int
    accuracy: float
    is_perfect: bool
    total_time_ms: int = 0
    total_time_str: Optional[str] = None
    answers: List[AnswerSummary]
    # Updated user state
    new_total_xp: int
    level_info: Dict[str, Any]
    leveled_up: bool
    old_level: int
    arena_streak: int
    badges_earned: List[str]


# ─── Daily Arena ──────────────────────────────────────────────────────────────

class DailyArenaOut(BaseModel):
    date_str: str
    total_xp: int
    quick_fire_count: int
    debug_rush_count: int
    tech_decision_count: int
    already_completed: bool
    completed_at: Optional[str] = None
    time_taken_str: Optional[str] = None


class StartDailyRequest(BaseModel):
    pass    # just POST — date is server-side


# ─── Arena Home stats ─────────────────────────────────────────────────────────

class SkillScoreOut(BaseModel):
    skill: str
    correct: int
    total: int
    score: float             # 0–100 accuracy


class BadgeOut(BaseModel):
    badge_id: str
    name: str
    description: str
    icon: str
    earned: bool
    earned_at: Optional[str] = None


class ArenaHomeResponse(BaseModel):
    # User stats
    total_xp: int
    weekly_xp: int
    level: int
    xp_in_level: int
    xp_for_next_level: int
    progress_pct: float
    arena_streak: int
    longest_arena_streak: int
    # Daily challenge
    daily: DailyArenaOut
    # Leaderboard preview (top 5 + self)
    leaderboard_preview: List[Dict[str, Any]]
    my_daily_rank: Optional[int] = None
    my_weekly_rank: Optional[int] = None
    my_lifetime_rank: Optional[int] = None
    # Recent performance (last 7 sessions)
    recent_accuracy: float
    total_games_played: int
    # Skill scores
    skill_scores: List[SkillScoreOut]
    # Game modes completed today
    completed_game_types_today: List[str] = []


# ─── Leaderboard ─────────────────────────────────────────────────────────────

class ArenaLeaderboardEntry(BaseModel):
    rank: int
    student_id: str
    name: str
    avatar_initials: str
    level: int
    xp: int
    arena_streak: int
    time_taken_ms: Optional[int] = None
    time_taken_str: Optional[str] = None
    is_me: bool = False


class ArenaLeaderboardResponse(BaseModel):
    scope: Literal["today", "weekly", "lifetime"]
    entries: List[ArenaLeaderboardEntry]
    my_entry: Optional[ArenaLeaderboardEntry]
    total: int


# ─── Skills / Learning recommendations ───────────────────────────────────────

class SkillRecommendation(BaseModel):
    skill: str
    accuracy: float
    is_weak: bool            # < 60% accuracy
    recommended_action: str
    roadmap_link: Optional[str] = None


class SkillsResponse(BaseModel):
    skills: List[SkillRecommendation]
    weakest_skill: Optional[str]


# ─── Admin schemas ────────────────────────────────────────────────────────────

class CreateQuestionRequest(BaseModel):
    game_type: Literal["quick_fire", "debug_rush", "tech_decision"]
    skill: str
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question: str
    options: List[ArenaOptionOut]
    correct_key: str
    explanation: str = ""
    xp_reward: int = 10
    time_limit: int = 30
    code_snippet: Optional[str] = None
    bug_line: Optional[int] = None
    bug_explanation: Optional[str] = None
    scenario: Optional[str] = None


class UpdateQuestionRequest(BaseModel):
    skill: Optional[str] = None
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    question: Optional[str] = None
    options: Optional[List[ArenaOptionOut]] = None
    correct_key: Optional[str] = None
    explanation: Optional[str] = None
    xp_reward: Optional[int] = None
    time_limit: Optional[int] = None
    code_snippet: Optional[str] = None
    bug_line: Optional[int] = None
    bug_explanation: Optional[str] = None
    scenario: Optional[str] = None
    is_active: Optional[bool] = None


class CreateDailyChallengeRequest(BaseModel):
    date_str: str            # "YYYY-MM-DD"
    quick_fire_ids: List[str]
    debug_rush_ids: List[str]
    tech_decision_ids: List[str]


class CreateBadgeRequest(BaseModel):
    badge_id: str
    name: str
    description: str
    requirement_type: str
    requirement_value: int
    icon: str = "🏆"
