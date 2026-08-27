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

    class Config:
        json_schema_extra = {
            "example": {
                "interview_id": "sd-session-1234",
                "student_id": "usr-student-456",
                "reviewer_id": "usr-reviewer-789",
                "reviewer_name": "Senior Tech Lead",
                "reviewer_role": "COMPANY",
                "scores": {
                    "communication": 85.0,
                    "technical_knowledge": 90.0,
                    "confidence": 80.0,
                    "problem_solving": 88.0,
                    "answer_quality": 84.0,
                    "professionalism": 92.0,
                },
                "overall_score": 86.5,
                "strengths": "Strong mastery of async architecture and clean code principles.",
                "improvements": "Needs deeper understanding of Redis clustering and cache stampede prevention.",
                "recommendations": "Practice system design for distributed locks and rate limiting algorithms.",
                "detailed_feedback": "Candidate demonstrated solid problem solving and articulated edge cases very clearly.",
                "status": "SUBMITTED",
            }
        }
