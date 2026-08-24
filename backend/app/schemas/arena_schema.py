
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


#  V2 payload schemas (answer fields stripped) 

class SpotBugCardOut(BaseModel):
    id: str
    snippet: str
    # is_buggy and fix_explanation intentionally omitted — sent only after the user calls each card


class SpotBugCardReveal(BaseModel):
    """Sent back after the user makes a call on a card."""
    id: str
    is_buggy: bool
    fix_explanation: str = ""


class SpotBugPayloadOut(BaseModel):
    cards: List[SpotBugCardOut]


class OrderItItemOut(BaseModel):
    id: str
    label: str
    # correct_order is intentionally omitted from this schema


class OrderItPayloadOut(BaseModel):
    items: List[OrderItItemOut]
    # correct_order intentionally NOT included


class StackItZoneOut(BaseModel):
    id: str
    label: str


class StackItComponentOut(BaseModel):
    id: str
    label: str
    # correct_zone_id intentionally NOT included


class StackItPayloadOut(BaseModel):
    scenario: str
    zones: List[StackItZoneOut]
    components: List[StackItComponentOut]


#  Legacy MCQ option 

class ArenaOptionOut(BaseModel):
    key: str
    text: str


#  Outbound question (no answer fields) 

class ArenaQuestionOut(BaseModel):
    question_id: str
    game_type: str
    question: str
    skill: str
    difficulty: str = "medium"
    time_limit: int
    xp_reward: int
    # V2 payloads (only one will be non-null depending on game_type)
    spotbug_payload: Optional[SpotBugPayloadOut] = None
    orderit_payload: Optional[OrderItPayloadOut] = None
    stackit_payload: Optional[StackItPayloadOut] = None
    # Legacy MCQ fields
    options: Optional[List[ArenaOptionOut]] = None
    code_snippet: Optional[str] = None
    scenario: Optional[str] = None


#  Start session 

class StartSessionRequest(BaseModel):
    game_type: Literal[
        "spotbug", "orderit", "stackit",
        "quick_fire", "debug_rush", "tech_decision",  # V1 legacy
    ]
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None


class StartSessionResponse(BaseModel):
    session_id: str
    game_type: str
    questions: List[ArenaQuestionOut]
    expires_at: str
    total_questions: int


#  Submit answer — V2 game types 

class SpotBugCall(BaseModel):
    card_id: str
    user_said_buggy: bool
    time_taken_ms: int = 0


class SubmitSpotBugRequest(BaseModel):
    session_id: str
    question_id: str
    calls: List[SpotBugCall]          # one per card in the queue
    elapsed_ms: int = 0               # total time for the whole game


class SubmitOrderItRequest(BaseModel):
    session_id: str
    question_id: str
    user_order: List[str]             # item ids in the order the user placed them
    elapsed_ms: int = 0


class SubmitStackItRequest(BaseModel):
    session_id: str
    question_id: str
    placements: List[Dict[str, str]]  # [{"component_id": str, "placed_zone_id": str}]
    elapsed_ms: int = 0


#  Submit answer — legacy MCQ 

class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    answer_key: str
    elapsed_ms: int


#  Submit answer responses 

class SpotBugAnswerResponse(BaseModel):
    accuracy: float
    xp_earned: int
    correct_count: int
    total_cards: int
    card_reveals: List[SpotBugCardReveal]   # full truth for all cards
    explanation: str


class OrderItAnswerResponse(BaseModel):
    accuracy: float
    xp_earned: int
    correct_positions: int
    total_items: int
    correct_order: List[str]                # reveal the correct order on submit
    explanation: str


class StackItAnswerResponse(BaseModel):
    accuracy: float
    xp_earned: int
    correct_count: int
    total_components: int
    correct_placements: List[Dict[str, str]]  # [{"component_id": str, "correct_zone_id": str}]
    explanation: str


class SubmitAnswerResponse(BaseModel):
    """Legacy MCQ response shape."""
    is_correct: bool
    correct_key: str
    explanation: str
    xp_earned: int
    speed_bonus: int


#  Complete session 

class CompleteSessionRequest(BaseModel):
    session_id: str


class ArenaGameResult(BaseModel):
    """Per-game breakdown shown on the results screen."""
    game_type: str
    skill: str
    accuracy: float
    xp_earned: int
    question_id: str


class AnswerSummary(BaseModel):
    question_id: str
    question: str
    skill: str
    game_type: str = ""
    # Legacy MCQ fields
    submitted_key: str = ""
    correct_key: str = ""
    is_correct: bool = False
    # V2 fields
    accuracy: float = 0.0
    xp_earned: int = 0
    explanation: str = ""


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
    game_results: List[ArenaGameResult] = []   # V2: per-game breakdown
    # Updated user state
    new_total_xp: int
    level_info: Dict[str, Any]
    leveled_up: bool
    old_level: int
    arena_streak: int
    badges_earned: List[str]
    daily_bonus_xp: int = 0


#  Daily Arena 

class DailyArenaOut(BaseModel):
    date_str: str
    total_xp: int
    spotbug_ready: bool = False
    orderit_ready: bool = False
    stackit_ready: bool = False
    already_completed: bool = False
    completed_at: Optional[str] = None
    time_taken_str: Optional[str] = None
    next_reset_at: Optional[str] = None     # ISO datetime of next local midnight reset


#  Arena Home 

class SkillScoreOut(BaseModel):
    skill: str
    correct: int
    total: int
    score: float


class BadgeOut(BaseModel):
    badge_id: str
    name: str
    description: str
    icon: str
    earned: bool
    earned_at: Optional[str] = None


class ArenaHomeResponse(BaseModel):
    total_xp: int
    weekly_xp: int
    level: int
    xp_in_level: int
    xp_for_next_level: int
    progress_pct: float
    arena_streak: int
    longest_arena_streak: int
    daily: DailyArenaOut
    leaderboard_preview: List[Dict[str, Any]]
    my_daily_rank: Optional[int] = None
    my_weekly_rank: Optional[int] = None
    my_lifetime_rank: Optional[int] = None
    recent_accuracy: float
    total_games_played: int
    skill_scores: List[SkillScoreOut]
    completed_game_types_today: List[str] = []


#  Leaderboard 

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


#  Skills / Learning recommendations 

class SkillRecommendation(BaseModel):
    skill: str
    accuracy: float
    is_weak: bool
    recommended_action: str
    roadmap_link: Optional[str] = None


class SkillsResponse(BaseModel):
    skills: List[SkillRecommendation]
    weakest_skill: Optional[str]


#  Admin schemas 

class CreateQuestionRequest(BaseModel):
    game_type: Literal[
        "spotbug", "orderit", "stackit",
        "quick_fire", "debug_rush", "tech_decision",
    ]
    skill: str
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question: str
    explanation: str = ""
    xp_reward: int = 20
    time_limit: int = 60
    # V2 payloads (one required depending on game_type)
    spotbug_payload: Optional[Dict[str, Any]] = None
    orderit_payload: Optional[Dict[str, Any]] = None
    stackit_payload: Optional[Dict[str, Any]] = None
    # Legacy MCQ
    options: Optional[List[ArenaOptionOut]] = None
    correct_key: Optional[str] = None
    code_snippet: Optional[str] = None
    bug_line: Optional[int] = None
    bug_explanation: Optional[str] = None
    scenario: Optional[str] = None


class UpdateQuestionRequest(BaseModel):
    skill: Optional[str] = None
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    question: Optional[str] = None
    explanation: Optional[str] = None
    xp_reward: Optional[int] = None
    time_limit: Optional[int] = None
    is_active: Optional[bool] = None
    spotbug_payload: Optional[Dict[str, Any]] = None
    orderit_payload: Optional[Dict[str, Any]] = None
    stackit_payload: Optional[Dict[str, Any]] = None
    options: Optional[List[ArenaOptionOut]] = None
    correct_key: Optional[str] = None
    code_snippet: Optional[str] = None
    bug_line: Optional[int] = None
    bug_explanation: Optional[str] = None
    scenario: Optional[str] = None


class CreateBadgeRequest(BaseModel):
    badge_id: str
    name: str
    description: str
    requirement_type: str
    requirement_value: int
    icon: str = "🏆"


class CreateDailyChallengeRequest(BaseModel):
    """Legacy — kept for admin panel backward compat."""
    date_str: str
    quick_fire_ids: List[str] = []
    debug_rush_ids: List[str] = []
    tech_decision_ids: List[str] = []
