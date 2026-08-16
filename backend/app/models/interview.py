from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, timezone
import uuid


class ProctoringReport(BaseModel):
    snapshots_s3_keys: List[str] = []
    violations: List[Dict[str, Any]] = []
    face_detection_alerts: List[Dict[str, Any]] = []


class InterviewViolation(BaseModel):
    type: Literal[
        "tab_switch",
        "fullscreen_exit",
        "copy_attempt",
        "window_blur",
        "keyboard_shortcut",
        "context_menu",
        "no_face_detected",
        "multiple_faces",
        "screen_recording_attempt",
    ]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Optional[str] = None


class InterviewSession(Document):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    company_id: Optional[str] = None         
    job_id: Optional[str] = None            
    company_name: Optional[str] = None

    mode: Literal["company", "ai"] = "ai"
    interview_type: str = "technical"

    # Scheduling (Mode A)
    scheduled_at: Optional[datetime] = None
    duration_mins: int = 45
    interviewer_name: Optional[str] = None   
    video_call_url: Optional[str] = None     # Optional Google Meet / Zoom link or internal WebRTC channel

    # Proctoring
    proctoring_enabled: bool = True
    violations: List[InterviewViolation] = []
    tab_switch_count: int = 0
    fullscreen_exit_count: int = 0

    # AI Interview (Mode B)
    company_key: Optional[str] = None        # e.g. "razorpay"
    target_company_name: Optional[str] = None
    conversation: List[Dict[str, str]] = []  # [{role:"ai"|"user", content:...}]
    question_count: int = 0

    # Session state
    status: Literal[
        "scheduled",
        "waiting",      # within 5 min window, joinable
        "in_progress",
        "completed",
        "terminated",   # proctoring violation
        "cancelled",
    ] = "scheduled"

    joined_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    # Results (filled by company interviewer or AI)
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    coding_score: Optional[float] = None
    overall_score: Optional[float] = None
    feedback: Optional[str] = None
    proctoring_report: Optional[ProctoringReport] = None

    # AI transcript (Mode B)
    transcript: Optional[str] = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "interview_sessions"