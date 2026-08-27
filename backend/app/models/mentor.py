from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid
from app.models.interview import DetailedRubric


class MentorProfile(Document):
    user_id: str                                       # Real User._id as string
    mentor_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    avatar_url: Optional[str] = None
    title: str = ""                                    # e.g., "Staff Backend Architect"
    company: str = ""                                  # e.g., "Amazon", "Razorpay"
    company_logo: Optional[str] = None
    years_experience: int = 0
    expertise_tags: List[str] = []                     # e.g. ["System Design", "DSA", "Backend"]
    bio: str = ""
    linkedin_url: Optional[str] = None
    rating: float = 5.0
    total_reviews: int = 0
    sessions_completed: int = 0
    hourly_rate_inr: int = 0                           # 0 for platform sponsored / credits
    is_active: bool = False                            # False until mentor completes onboarding
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "mentor_profiles"


class MentorSlot(Document):
    slot_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentor_id: str
    mentor_name: str = ""
    start_time: datetime
    end_time: datetime
    duration_mins: int = 45
    is_booked: bool = False
    booking_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    meeting_url: Optional[str] = None
    
    status: Literal["confirmed", "in_progress", "completed", "cancelled"] = "confirmed"
    
    # Post-Session Feedback & Recording
    overall_score: Optional[float] = None
    rubric: Optional[DetailedRubric] = None
    mentor_feedback: Optional[str] = None
    student_rating: Optional[int] = None               # 1-5 stars
    student_review: Optional[str] = None
    recording_url: Optional[str] = None
    recording_file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    class Settings:
        name = "mentorship_bookings"
