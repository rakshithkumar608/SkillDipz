from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid
from app.models.interview import DetailedRubric


class MentorProfile(Document):
    user_id: str                                       # Authenticated User._id as string
    mentor_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    full_name: str = ""
    email: str = ""
    profile_photo: Optional[str] = None
    headline: str = ""                                 # e.g., "Senior Distributed Systems Engineer @ Google"
    bio: str = ""
    expertise: List[str] = Field(default_factory=list) # e.g. ["System Design", "Distributed Systems", "Backend"]
    skills: List[str] = Field(default_factory=list)    # e.g. ["Python", "Go", "Kubernetes", "Kafka", "PostgreSQL"]
    experience_years: int = 0
    current_role: str = ""                             # e.g., "Staff Software Engineer"
    company: str = ""                                  # e.g., "Google", "Amazon", "Razorpay"
    education: str = ""                                # e.g., "B.Tech Computer Science, IIT Bombay"
    languages: List[str] = Field(default_factory=list) # e.g. ["English", "Hindi"]
    mentoring_topics: List[str] = Field(default_factory=list) # e.g. ["System Design Mock", "DSA Coding Round", "Resume Review"]
    
    # Status & Metrics
    profile_status: Literal["INCOMPLETE", "ACTIVE", "INACTIVE"] = "INCOMPLETE"
    rating: float = 5.0
    total_reviews: int = 0
    sessions_completed: int = 0
    hourly_rate_inr: int = 0
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "mentor_profiles"


class MentorSlot(Document):
    slot_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentor_id: str
    user_id: str = ""
    mentor_name: str = ""
    
    available_day: str = ""                            # e.g. "2026-08-30" or "Monday"
    start_time: datetime
    end_time: datetime
    duration_mins: int = 45
    is_enabled: bool = True                            # Enable / disable availability toggle
    is_booked: bool = False
    booking_id: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "mentor_slots"


class MentorshipBooking(Document):
    booking_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str = ""
    student_email: str = ""
    mentor_id: str
    mentor_name: str = ""
    mentor_company: str = ""
    slot_id: str
    
    # Session Details
    topic: str = "Technical Mock Interview & Architecture Review"
    target_role: Optional[str] = "Software Development Engineer"
    target_company: Optional[str] = None
    student_notes: Optional[str] = None
    
    scheduled_at: datetime
    duration_mins: int = 45
    duration: int = 45                                 # In minutes
    meeting_url: Optional[str] = None
    
    status: Literal["confirmed", "in_progress", "completed", "cancelled", "pending"] = "confirmed"
    
    # Post-Session Feedback & Recording
    overall_score: Optional[float] = None
    rubric: Optional[DetailedRubric] = None
    mentor_feedback: Optional[str] = None
    student_rating: Optional[int] = None               # 1-5 stars
    student_review: Optional[str] = None
    recording_url: Optional[str] = None
    recording_file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    class Settings:
        name = "mentorship_bookings"
