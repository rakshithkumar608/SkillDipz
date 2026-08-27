from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, timezone
import uuid


class FeedbackScores(BaseModel):
    communication: float = Field(..., ge=0, le=100)
    technical_knowledge: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=100)
    problem_solving: float = Field(..., ge=0, le=100)
    answer_quality: float = Field(..., ge=0, le=100)
    professionalism: float = Field(..., ge=0, le=100)


class InterviewFeedback(Document):
    feedback_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str                          # session_id
    student_id: str
    reviewer_id: str                           # Authenticated user ID (Company/Interviewer)
    reviewer_name: str
    reviewer_role: str = "INTERVIEWER"         # COMPANY / INTERVIEWER / MENTOR
    
    scores: FeedbackScores
    overall_score: float = Field(..., ge=0, le=100)

    strengths: str
    improvements: str
    recommendations: str
    detailed_feedback: str

    status: Literal["PENDING", "SUBMITTED"] = "PENDING"

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    submitted_at: Optional[datetime] = None

    class Settings:
        name = "interview_feedback"


class InterviewTimestampFeedback(Document):
    feedback_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str                          # session_id
    student_id: str
    reviewer_id: str                           # Authenticated reviewer user ID
    reviewer_name: str
    reviewer_role: str = "INTERVIEWER"         # COMPANY / INTERVIEWER / MENTOR

    timestamp_seconds: float = Field(..., ge=0)
    formatted_timestamp: str                   # e.g. "02:14"
    category: Literal[
        "Communication",
        "Technical",
        "Confidence",
        "Problem Solving",
        "Answer Quality",
        "Body Language",
        "Positive",
        "Improvement",
    ]
    comment: str

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "interview_timestamp_feedback"
