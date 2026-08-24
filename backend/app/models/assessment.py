from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime, timezone

class MCQOption(BaseModel):
  key: str
  text: str
  
  
class MCQQuestion(BaseModel):
  question_id: str
  question: str
  options: List[MCQOption]
  correct_key: str
  explanation: Optional[str] = None
  skill_tag: str
  source: str = "admin"
  
class AssessmentQuestion(Document):
  role: str
  topic_id: str
  topic_title: str
  difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
  skill_tag: str
  question: str
  options: List[MCQOption]
  correct_key: str
  explanation: Optional[str] = None
  is_active: bool = True
  created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
  
  class Settings:
    name = "assessment_questions"
    

class AssessmentTopic(Document):
    topic_id: str
    title: str
    role: str
    skill_tags: List[str] = []      
    quizapi_tags: List[str] = []
    difficulty: Literal["Beginner","Intermediate", "Advanced"] = "Intermediate"
    question_count: int = 10
    time_limit_mins: int = 15
    is_active: bool = True
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "assessment_topics"


class AssessmentSession(Document):
    session_id: str
    student_id: str
    topic_id: str
    topic_title: str
    role: str
    questions: List[MCQQuestion]
    answers: dict = {}             
    status: Literal["in_progress", "submitted", "timed_out"] = "in_progress"
    score: Optional[float] = None
    score_pct: Optional[float] = None
    correct_count: Optional[int] = None
    skills_verified: List[str] = []
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))
    submitted_at: Optional[datetime] = None
    expires_at: datetime           

    class Settings:
        name = "assessment_sessions"


class AssessmentResult(Document):
    student_id: str
    topic_id: str
    topic_title: str
    role: str
    score: float
    score_pct: float
    correct_count: int
    total_questions: int
    skills_verified: List[str]
    skill_tags: List[str]
    taken_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))
    next_retake_allowed_at: datetime    # taken_at + 24h

    class Settings:
        name = "assessment_results"


class CFBookmark(Document):
    student_id: str
    cf_problem_id: str
    contest_id: int
    index: str
    name: str
    rating: Optional[int] = None
    tags: List[str] = []
    bookmarked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "cf_bookmarks"

class CFSolvedProblem(Document):
    student_id: str
    cf_problem_id: str
    contest_id: int
    index: str
    name: str
    rating: Optional[int] = None
    cf_submission_id: str
    cf_handle: str
    solved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "cf_solved_problems"


class CodingExample(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None


class CodingTestCase(BaseModel):
    input: List[Any] = []
    expected: Any


class CodingQuestion(Document):
    """Real LeetCode-style coding practice questions stored in MongoDB and served based on Skill Gap."""
    question_id: str
    title: str
    difficulty: Literal["EASY", "MEDIUM", "HARD"] = "EASY"
    topics: List[str] = []
    skill_tags: List[str] = []
    concept: Optional[str] = None
    description: str
    examples: List[CodingExample] = []
    constraints: List[str] = []
    function_signature: str
    starter_code: str
    starter_code_templates: dict = {}
    hints: List[str] = []
    acceptance_rate: float = 75.0
    test_cases: List[CodingTestCase] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "coding_questions"


class CodingSolvedProblem(Document):
    """Tracks coding questions solved by students in the Code Practice Arena."""
    student_id: str
    question_id: str
    title: str
    difficulty: str
    topics: List[str] = []
    solved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "coding_solved_problems"


