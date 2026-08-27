import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_student, get_current_mentor, get_current_admin
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.mentor import MentorProfile, MentorSlot, MentorshipBooking
from app.models.interview import InterviewSession, DetailedRubric
from app.core.event_bus import event_bus
from app.core.ws_manager import ws_manager
from app.services.notification_service import send_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mentorship", tags=["1-to-1 Mentorship"])


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class UpdateMentorProfileRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    company: str = Field(..., min_length=2, max_length=100)
    years_experience: int = Field(..., ge=0, le=50)
    expertise_tags: List[str] = Field(default_factory=list)
    bio: str = Field(..., min_length=10, max_length=1000)
    linkedin_url: Optional[str] = None
    avatar_url: Optional[str] = None
    hourly_rate_inr: Optional[int] = 0
    is_active: bool = True


class CreateSlotRequest(BaseModel):
    start_time: datetime
    duration_mins: int = 45


class BookMentorRequest(BaseModel):
    mentor_id: str
    slot_id: str
    topic: Optional[str] = "1-on-1 Technical Mock Interview & Architecture Review"
    target_role: Optional[str] = "Software Development Engineer"
    target_company: Optional[str] = None
    student_notes: Optional[str] = None


class MentorFeedbackRequest(BaseModel):
    overall_score: float = Field(..., ge=0, le=100)
    mentor_feedback: str = Field(..., min_length=5)
    rubric: Optional[DetailedRubric] = None
    recording_url: Optional[str] = None


class StudentReviewRequest(BaseModel):
    student_rating: int = Field(..., ge=1, le=5)
    student_review: Optional[str] = None


# ─── MENTOR ONBOARDING & PROFILE MANAGEMENT (Authenticated Mentor) ───────────

@router.get("/profile/me")
async def get_my_mentor_profile(
    current: dict = Depends(get_current_mentor),
):
    """Retrieve the logged-in mentor's profile and active slots."""
    user = current["user"]
    user_id = str(user.id)

    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        # Create initial draft profile from User data
        profile = MentorProfile(
            user_id=user_id,
            name=user.full_name,
            email=user.email,
            avatar_url=user.avatar_url,
            is_active=False,
        )
        await profile.insert()

    slots = await MentorSlot.find(
        MentorSlot.mentor_id == profile.mentor_id
    ).sort(-MentorSlot.start_time).to_list(100)

    return {
        "profile": profile,
        "slots": slots,
    }


@router.post("/profile")
async def save_mentor_profile(
    body: UpdateMentorProfileRequest,
    current: dict = Depends(get_current_mentor),
):
    """Complete or update mentor onboarding profile. Saves real data to MongoDB."""
    user = current["user"]
    user_id = str(user.id)

    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        profile = MentorProfile(
            user_id=user_id,
            name=user.full_name,
            email=user.email,
            avatar_url=body.avatar_url or user.avatar_url,
        )

    profile.name = user.full_name
    profile.email = user.email
    if body.avatar_url:
        profile.avatar_url = body.avatar_url
        user.avatar_url = body.avatar_url
        await user.save()

    profile.title = body.title
    profile.company = body.company
    profile.years_experience = body.years_experience
    profile.expertise_tags = body.expertise_tags
    profile.bio = body.bio
    profile.linkedin_url = body.linkedin_url
    profile.hourly_rate_inr = body.hourly_rate_inr or 0
    profile.is_active = body.is_active

    await profile.save()

    return {
        "message": "Mentor profile updated successfully",
        "profile": profile,
    }


# ─── MENTOR AVAILABILITY SLOTS (Authenticated Mentor) ─────────────────────────

@router.post("/slots", status_code=201)
async def create_mentor_slot(
    body: CreateSlotRequest,
    current: dict = Depends(get_current_mentor),
):
    """Mentor adds a real availability slot to MongoDB."""
    user = current["user"]
    user_id = str(user.id)

    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile or not profile.is_active:
        raise HTTPException(
            status_code=400,
            detail="Please complete and activate your Mentor Profile before publishing availability slots.",
        )

    now = datetime.now(timezone.utc)
    slot_start = body.start_time
    if slot_start.tzinfo is None:
        slot_start = slot_start.replace(tzinfo=timezone.utc)

    if slot_start < now:
        raise HTTPException(status_code=400, detail="Slot start time must be in the future.")

    slot = MentorSlot(
        mentor_id=profile.mentor_id,
        mentor_name=profile.name,
        start_time=slot_start,
        end_time=slot_start + timedelta(minutes=body.duration_mins),
        duration_mins=body.duration_mins,
        is_booked=False,
    )
    await slot.insert()

    return {
        "message": "Availability slot created successfully",
        "slot": slot,
    }


@router.get("/slots/my")
async def get_my_slots(
    current: dict = Depends(get_current_mentor),
):
    """Retrieve all slots created by the logged-in mentor."""
    user = current["user"]
    user_id = str(user.id)
    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        return {"slots": [], "total": 0}

    slots = await MentorSlot.find(
        MentorSlot.mentor_id == profile.mentor_id
    ).sort(MentorSlot.start_time).to_list(200)

    return {"slots": slots, "total": len(slots)}


@router.delete("/slots/{slot_id}")
async def delete_mentor_slot(
    slot_id: str,
    current: dict = Depends(get_current_mentor),
):
    """Delete an unbooked availability slot."""
    user = current["user"]
    user_id = str(user.id)
    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Mentor profile not found")

    slot = await MentorSlot.find_one(
        MentorSlot.slot_id == slot_id,
        MentorSlot.mentor_id == profile.mentor_id,
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Cannot delete a slot that has already been booked.")

    await slot.delete()
    return {"message": "Slot deleted successfully"}


# ─── MENTOR BOOKINGS & SESSIONS (Authenticated Mentor) ────────────────────────

@router.get("/bookings/mentor")
async def get_mentor_bookings(
    current: dict = Depends(get_current_mentor),
):
    """Retrieve all sessions booked with the logged-in mentor."""
    user = current["user"]
    user_id = str(user.id)
    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        return {"bookings": [], "total": 0}

    bookings = await MentorshipBooking.find(
        MentorshipBooking.mentor_id == profile.mentor_id
    ).sort(-MentorshipBooking.scheduled_at).to_list(100)

    return {"bookings": bookings, "total": len(bookings)}


@router.post("/bookings/{booking_id}/feedback")
async def submit_mentor_session_feedback(
    booking_id: str,
    body: MentorFeedbackRequest,
    current: dict = Depends(get_current_mentor),
):
    """Mentor grades student performance with real rubric and overall score."""
    user = current["user"]
    user_id = str(user.id)
    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Mentor profile not found")

    booking = await MentorshipBooking.find_one(
        MentorshipBooking.booking_id == booking_id,
        MentorshipBooking.mentor_id == profile.mentor_id,
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = "completed"
    booking.completed_at = datetime.now(timezone.utc)
    booking.overall_score = body.overall_score
    booking.mentor_feedback = body.mentor_feedback
    booking.rubric = body.rubric
    if body.recording_url:
        booking.recording_url = body.recording_url
    await booking.save()

    # Update parallel InterviewSession
    session = await InterviewSession.find_one(InterviewSession.session_id == booking_id)
    if session:
        session.status = "completed"
        session.ended_at = booking.completed_at
        session.overall_score = body.overall_score
        session.feedback = body.mentor_feedback
        session.rubric = body.rubric
        if body.recording_url:
            session.recording_url = body.recording_url
        await session.save()

    # Increment mentor completed session counter
    profile.sessions_completed += 1
    await profile.save()

    # Dispatch event bus trigger: awards XP, updates student score & pushes WS notification
    await event_bus.publish("interview.completed", {
        "session_id": booking_id,
        "student_id": booking.student_id,
        "overall_score": body.overall_score,
        "feedback": body.mentor_feedback,
        "mode": "mentor",
        "company_name": booking.mentor_company,
        "rubric": body.rubric.model_dump() if body.rubric else None,
    })

    return {
        "message": "Feedback submitted successfully and student notified.",
        "booking_id": booking_id,
        "overall_score": booking.overall_score,
    }


# ─── STUDENT DIRECTORY & BOOKING FLOW (Real MongoDB Queries) ──────────────────

@router.get("/mentors")
async def list_mentors(
    company: Optional[str] = Query(None),
    expertise: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    List only REAL, active mentors from MongoDB.
    Returns an empty array if no mentors have registered yet.
    """
    query: dict = {"is_active": True}
    if company and company.lower() != "all":
        query["company"] = {"$regex": company, "$options": "i"}
    if expertise:
        query["expertise_tags"] = {"$in": [expertise]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
            {"expertise_tags": {"$elemMatch": {"$regex": search, "$options": "i"}}},
        ]

    mentors = await MentorProfile.find(query).sort(-MentorProfile.rating).to_list(50)
    if not mentors:
        return {"mentors": [], "total": 0}

    # Fetch open, unbooked future slots for these active mentors
    now = datetime.now(timezone.utc)
    mentor_ids = [m.mentor_id for m in mentors]
    open_slots = await MentorSlot.find(
        {
            "mentor_id": {"$in": mentor_ids},
            "is_booked": False,
            "start_time": {"$gte": now},
        }
    ).sort(MentorSlot.start_time).to_list(200)

    slots_by_mentor: dict = {}
    for s in open_slots:
        slots_by_mentor.setdefault(s.mentor_id, []).append({
            "slot_id": s.slot_id,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "duration_mins": s.duration_mins,
        })

    result = []
    for m in mentors:
        m_slots = slots_by_mentor.get(m.mentor_id, [])
        result.append({
            "mentor_id": m.mentor_id,
            "name": m.name,
            "title": m.title,
            "company": m.company,
            "avatar_url": m.avatar_url,
            "years_experience": m.years_experience,
            "expertise_tags": m.expertise_tags,
            "bio": m.bio,
            "linkedin_url": m.linkedin_url,
            "rating": m.rating,
            "total_reviews": m.total_reviews,
            "sessions_completed": m.sessions_completed,
            "available_slots_count": len(m_slots),
            "next_available_slot": m_slots[0]["start_time"] if m_slots else None,
            "slots": m_slots,
        })

    return {"mentors": result, "total": len(result)}


@router.get("/mentors/{mentor_id}")
async def get_mentor_detail(mentor_id: str):
    """Retrieve full mentor profile and open calendar booking slots from MongoDB."""
    mentor = await MentorProfile.find_one(
        MentorProfile.mentor_id == mentor_id,
        MentorProfile.is_active == True,
    )
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found or inactive.")

    now = datetime.now(timezone.utc)
    slots = await MentorSlot.find(
        {
            "mentor_id": mentor_id,
            "is_booked": False,
            "start_time": {"$gte": now},
        }
    ).sort(MentorSlot.start_time).to_list(50)

    return {
        "mentor": mentor,
        "slots": [
            {
                "slot_id": s.slot_id,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "duration_mins": s.duration_mins,
            }
            for s in slots
        ],
    }


@router.post("/book", status_code=201)
async def book_mentor_slot(
    body: BookMentorRequest,
    current_student: dict = Depends(get_current_student),
):
    """Student books a real mentor slot in MongoDB."""
    student_id = current_student["student_id"]
    user = current_student.get("user")

    mentor = await MentorProfile.find_one(
        MentorProfile.mentor_id == body.mentor_id,
        MentorProfile.is_active == True,
    )
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found or not active.")

    slot = await MentorSlot.find_one(
        MentorSlot.slot_id == body.slot_id,
        MentorSlot.mentor_id == body.mentor_id,
    )
    if not slot or slot.is_booked:
        raise HTTPException(status_code=400, detail="This time slot is no longer available.")

    student_name = user.full_name if user and user.full_name else "Student"
    student_email = user.email if user and user.email else ""

    meeting_channel_id = f"sd-mentor-{str(uuid.uuid4())[:8]}"
    meeting_url = f"/student/mock-interview?session={meeting_channel_id}&mode=mentor"

    booking = MentorshipBooking(
        student_id=student_id,
        student_name=student_name,
        student_email=student_email,
        mentor_id=mentor.mentor_id,
        mentor_name=mentor.name,
        mentor_company=mentor.company,
        slot_id=slot.slot_id,
        topic=body.topic or "1-on-1 Technical Mock Interview",
        target_role=body.target_role or "Software Development Engineer",
        target_company=body.target_company or mentor.company,
        student_notes=body.student_notes,
        scheduled_at=slot.start_time,
        duration_mins=slot.duration_mins,
        meeting_url=meeting_url,
        status="confirmed",
    )
    await booking.insert()

    # Mark slot as booked in MongoDB
    slot.is_booked = True
    slot.booking_id = booking.booking_id
    await slot.save()

    # Create linked InterviewSession in database
    session = InterviewSession(
        session_id=booking.booking_id,
        student_id=student_id,
        mode="mentor",
        interview_type="mentor_1on1",
        company_name=mentor.company,
        interviewer_name=mentor.name,
        mentor_id=mentor.mentor_id,
        mentor_name=mentor.name,
        booking_id=booking.booking_id,
        scheduled_at=slot.start_time,
        duration_mins=slot.duration_mins,
        video_call_url=meeting_url,
        proctoring_enabled=True,
        status="scheduled",
    )
    await session.insert()

    # Notify student
    sched_formatted = slot.start_time.strftime("%b %d, %I:%M %p UTC")
    await send_notification(
        student_id=student_id,
        title=f"1-to-1 Mentorship Confirmed with {mentor.name}",
        body=f"Your session '{booking.topic}' is confirmed for {sched_formatted}.",
        action_url="/student/mock-interview",
        notification_type="mentorship_confirmed",
    )

    # Notify mentor
    await send_notification(
        student_id=mentor.user_id,
        title=f"New Mentorship Session Booked by {student_name}",
        body=f"{student_name} booked '{booking.topic}' for {sched_formatted}.",
        action_url="/mentor/dashboard",
        notification_type="mentorship_booked",
    )

    return {
        "message": "Mentorship session successfully booked!",
        "booking_id": booking.booking_id,
        "scheduled_at": slot.start_time.isoformat(),
        "mentor_name": mentor.name,
        "meeting_url": meeting_url,
    }


@router.get("/my-bookings")
async def get_my_bookings(
    current_student: dict = Depends(get_current_student),
):
    """Retrieve student's real bookings from MongoDB."""
    student_id = current_student["student_id"]
    bookings = await MentorshipBooking.find(
        MentorshipBooking.student_id == student_id
    ).sort(-MentorshipBooking.scheduled_at).to_list(100)

    return {"bookings": bookings, "total": len(bookings)}


@router.post("/bookings/{booking_id}/review")
async def review_mentor_session(
    booking_id: str,
    body: StudentReviewRequest,
    current_student: dict = Depends(get_current_student),
):
    """Student submits a rating and review for a completed mentor session."""
    student_id = current_student["student_id"]
    booking = await MentorshipBooking.find_one(
        MentorshipBooking.booking_id == booking_id,
        MentorshipBooking.student_id == student_id,
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.student_rating = body.student_rating
    booking.student_review = body.student_review
    await booking.save()

    # Recalculate mentor rating in MongoDB
    mentor = await MentorProfile.find_one(MentorProfile.mentor_id == booking.mentor_id)
    if mentor:
        all_reviews = await MentorshipBooking.find(
            {
                "mentor_id": booking.mentor_id,
                "student_rating": {"$ne": None},
            }
        ).to_list()
        if all_reviews:
            ratings = [r.student_rating for r in all_reviews if r.student_rating is not None]
            mentor.rating = round(sum(ratings) / len(ratings), 2)
            mentor.total_reviews = len(ratings)
            await mentor.save()

    return {"message": "Review submitted successfully"}
