import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_student, get_current_mentor, get_current_admin
from app.models.user import User
from app.models.mentor import MentorProfile, MentorSlot, MentorshipBooking
from app.models.interview import InterviewSession, DetailedRubric
from app.core.event_bus import event_bus
from app.core.ws_manager import ws_manager
from app.services.notification_service import send_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mentorship", tags=["1-to-1 Mentorship"])




class SaveMentorProfileRequest(BaseModel):
    full_name: Optional[str] = None
    profile_photo: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    expertise: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    experience_years: int = Field(default=0, ge=0, le=60)
    current_role: Optional[str] = None
    company: Optional[str] = None
    education: Optional[str] = None
    languages: List[str] = Field(default_factory=list)
    mentoring_topics: List[str] = Field(default_factory=list)
    profile_status: Literal["INCOMPLETE", "ACTIVE", "INACTIVE"] = "ACTIVE"


class CreateAvailabilitySlotRequest(BaseModel):
    available_day: Optional[str] = None                # e.g. "2026-08-30" or "Friday"
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_mins: int = Field(default=45, ge=15, le=180)
    is_enabled: bool = True


class UpdateAvailabilitySlotRequest(BaseModel):
    available_day: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_mins: Optional[int] = Field(None, ge=15, le=180)
    is_enabled: Optional[bool] = None


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


# ─── MENTOR PROFILE MANAGEMENT (Authenticated Mentor) ────────────────────────

@router.get("/profile/me")
async def get_my_mentor_profile(
    current: dict = Depends(get_current_mentor),
):
    """
    Retrieve the authenticated mentor's own profile and availability slots from MongoDB.
    If first login, creates an initial draft profile linked to their user_id.
    """
    user = current["user"]
    user_id = str(user.id)

    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        profile = MentorProfile(
            user_id=user_id,
            full_name=user.full_name,
            email=user.email,
            profile_photo=user.avatar_url,
            profile_status="INCOMPLETE",
        )
        await profile.insert()

    slots = await MentorSlot.find(
        MentorSlot.user_id == user_id
    ).sort(MentorSlot.start_time).to_list(200)

    return {
        "profile": profile,
        "slots": slots,
        "is_complete": profile.profile_status == "ACTIVE",
    }


@router.post("/profile")
async def save_my_mentor_profile(
    body: SaveMentorProfileRequest,
    current: dict = Depends(get_current_mentor),
):
    """
    Save / update mentor profile for the authenticated user.
    All data is persisted in MongoDB Atlas under MentorProfile.
    """
    user = current["user"]
    user_id = str(user.id)

    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        profile = MentorProfile(
            user_id=user_id,
            full_name=body.full_name or user.full_name,
            email=user.email,
        )

    # Sync full name and photo if provided
    if body.full_name:
        profile.full_name = body.full_name.strip()
        user.full_name = profile.full_name
    else:
        profile.full_name = user.full_name

    if body.profile_photo:
        profile.profile_photo = body.profile_photo
        user.avatar_url = body.profile_photo
    await user.save()

    profile.headline = (body.headline or "").strip()
    profile.bio = (body.bio or "").strip()
    profile.expertise = body.expertise
    profile.skills = body.skills
    profile.experience_years = body.experience_years
    profile.current_role = (body.current_role or "").strip()
    profile.company = (body.company or "").strip()
    profile.education = (body.education or "").strip()
    profile.languages = body.languages
    profile.mentoring_topics = body.mentoring_topics
    profile.profile_status = body.profile_status
    profile.updated_at = datetime.now(timezone.utc)

    # Validation: to be ACTIVE, must have minimal career info
    if profile.profile_status == "ACTIVE":
        if not profile.current_role or not profile.company or not profile.bio:
            raise HTTPException(
                status_code=400,
                detail="Please provide your current role, company, and bio before activating your mentor profile.",
            )

    await profile.save()

    return {
        "message": "Mentor profile saved successfully",
        "profile": profile,
        "profile_status": profile.profile_status,
    }


# ─── MENTOR AVAILABILITY SYSTEM (Authenticated Mentor) ───────────────────────

@router.post("/slots", status_code=201)
async def create_availability_slot(
    body: CreateAvailabilitySlotRequest,
    current: dict = Depends(get_current_mentor),
):
    """
    Authenticated mentor adds an availability time slot to MongoDB.
    """
    user = current["user"]
    user_id = str(user.id)

    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Mentor profile not found. Please complete your profile first.",
        )

    now = datetime.now(timezone.utc)
    start = body.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    if start < now:
        raise HTTPException(status_code=400, detail="Start time must be in the future.")

    duration = body.duration_mins or 45
    end = body.end_time or (start + timedelta(minutes=duration))
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time.")

    # Determine day string if omitted
    day_str = body.available_day or start.strftime("%Y-%m-%d")

    slot = MentorSlot(
        mentor_id=profile.mentor_id,
        user_id=user_id,
        mentor_name=profile.full_name or user.full_name,
        available_day=day_str,
        start_time=start,
        end_time=end,
        duration_mins=duration,
        is_enabled=body.is_enabled,
        is_booked=False,
    )
    await slot.insert()

    return {
        "message": "Availability slot created successfully",
        "slot": slot,
    }


@router.get("/slots/my")
async def get_my_availability_slots(
    current: dict = Depends(get_current_mentor),
):
    """
    Retrieve all availability slots for the authenticated mentor.
    """
    user = current["user"]
    user_id = str(user.id)

    slots = await MentorSlot.find(
        MentorSlot.user_id == user_id
    ).sort(MentorSlot.start_time).to_list(300)

    return {"slots": slots, "total": len(slots)}


@router.put("/slots/{slot_id}")
async def update_availability_slot(
    slot_id: str,
    body: UpdateAvailabilitySlotRequest,
    current: dict = Depends(get_current_mentor),
):
    """
    Edit an existing availability slot. Mentor can only modify their own unbooked slots.
    """
    user = current["user"]
    user_id = str(user.id)

    slot = await MentorSlot.find_one(
        MentorSlot.slot_id == slot_id,
        MentorSlot.user_id == user_id,
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found or unauthorized.")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Cannot modify an already booked slot.")

    if body.available_day is not None:
        slot.available_day = body.available_day

    if body.duration_mins is not None:
        slot.duration_mins = body.duration_mins

    if body.start_time is not None:
        start = body.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        slot.start_time = start
        slot.end_time = start + timedelta(minutes=slot.duration_mins)

    if body.end_time is not None:
        end = body.end_time
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end <= slot.start_time:
            raise HTTPException(status_code=400, detail="End time must be after start time.")
        slot.end_time = end

    if body.is_enabled is not None:
        slot.is_enabled = body.is_enabled

    slot.updated_at = datetime.now(timezone.utc)
    await slot.save()

    return {"message": "Availability slot updated successfully", "slot": slot}


@router.patch("/slots/{slot_id}/toggle")
async def toggle_availability_slot(
    slot_id: str,
    current: dict = Depends(get_current_mentor),
):
    """
    Enable / disable an availability slot.
    """
    user = current["user"]
    user_id = str(user.id)

    slot = await MentorSlot.find_one(
        MentorSlot.slot_id == slot_id,
        MentorSlot.user_id == user_id,
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found or unauthorized.")

    slot.is_enabled = not slot.is_enabled
    slot.updated_at = datetime.now(timezone.utc)
    await slot.save()

    return {
        "message": f"Slot {'enabled' if slot.is_enabled else 'disabled'}",
        "is_enabled": slot.is_enabled,
    }


@router.delete("/slots/{slot_id}")
async def delete_availability_slot(
    slot_id: str,
    current: dict = Depends(get_current_mentor),
):
    """
    Delete an availability slot. Mentor can only delete their own unbooked slots.
    """
    user = current["user"]
    user_id = str(user.id)

    slot = await MentorSlot.find_one(
        MentorSlot.slot_id == slot_id,
        MentorSlot.user_id == user_id,
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found or unauthorized.")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Cannot delete an already booked slot.")

    await slot.delete()
    return {"message": "Slot deleted successfully"}


# ─── MENTOR BOOKED SESSIONS & EVALUATION ─────────────────────────────────────

@router.get("/bookings/mentor")
async def get_mentor_bookings(
    current: dict = Depends(get_current_mentor),
):
    """
    Retrieve all sessions booked with the authenticated mentor.
    """
    user = current["user"]
    user_id = str(user.id)
    profile = await MentorProfile.find_one(MentorProfile.user_id == user_id)
    if not profile:
        return {"bookings": [], "total": 0}

    bookings = await MentorshipBooking.find(
        MentorshipBooking.mentor_id == profile.mentor_id
    ).sort(-MentorshipBooking.scheduled_at).to_list(150)

    return {"bookings": bookings, "total": len(bookings)}


@router.post("/bookings/{booking_id}/feedback")
async def submit_mentor_session_feedback(
    booking_id: str,
    body: MentorFeedbackRequest,
    current: dict = Depends(get_current_mentor),
):
    """
    Mentor submits real evaluation and detailed rubric for a student session.
    """
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

    # Update mentor metrics
    profile.sessions_completed += 1
    await profile.save()

    # Award XP & broadcast live update
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


# ─── STUDENT DIRECTORY & BOOKING FLOW (Real MongoDB Queries Only) ─────────────

@router.get("/mentors")
async def list_mentors(
    company: Optional[str] = Query(None),
    expertise: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    weakness_tags: Optional[str] = Query(None),
):
    """
    List only ACTIVE mentors from MongoDB.
    Mentors with status INCOMPLETE or INACTIVE are never returned.
    """
    and_conditions: list = [{"profile_status": "ACTIVE"}]

    if company and company.lower() != "all":
        and_conditions.append({"company": {"$regex": company, "$options": "i"}})

    if expertise:
        and_conditions.append({
            "$or": [
                {"expertise": {"$regex": expertise, "$options": "i"}},
                {"skills": {"$regex": expertise, "$options": "i"}},
                {"mentoring_topics": {"$regex": expertise, "$options": "i"}},
            ]
        })

    if weakness_tags:
        tags = [t.strip() for t in weakness_tags.split(",") if t.strip()]
        if tags:
            tag_or = []
            for tag in tags:
                tag_or.extend([
                    {"expertise": {"$regex": tag, "$options": "i"}},
                    {"skills": {"$regex": tag, "$options": "i"}},
                    {"mentoring_topics": {"$regex": tag, "$options": "i"}},
                ])
            and_conditions.append({"$or": tag_or})

    if search:
        and_conditions.append({
            "$or": [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"company": {"$regex": search, "$options": "i"}},
                {"headline": {"$regex": search, "$options": "i"}},
                {"current_role": {"$regex": search, "$options": "i"}},
                {"expertise": {"$elemMatch": {"$regex": search, "$options": "i"}}},
                {"skills": {"$elemMatch": {"$regex": search, "$options": "i"}}},
                {"mentoring_topics": {"$elemMatch": {"$regex": search, "$options": "i"}}},
            ]
        })

    query = {"$and": and_conditions} if len(and_conditions) > 1 else and_conditions[0]

    mentors = await MentorProfile.find(query).sort(-MentorProfile.rating).to_list(50)
    if not mentors:
        return {"mentors": [], "total": 0}

    # Fetch open, enabled future slots for active mentors
    now = datetime.now(timezone.utc)
    mentor_ids = [m.mentor_id for m in mentors]
    open_slots = await MentorSlot.find(
        {
            "mentor_id": {"$in": mentor_ids},
            "is_booked": False,
            "is_enabled": True,
            "start_time": {"$gte": now},
        }
    ).sort(MentorSlot.start_time).to_list(300)

    slots_by_mentor: dict = {}
    for s in open_slots:
        slots_by_mentor.setdefault(s.mentor_id, []).append({
            "slot_id": s.slot_id,
            "available_day": s.available_day,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "duration_mins": s.duration_mins,
            "is_enabled": s.is_enabled,
        })

    result = []
    for m in mentors:
        m_slots = slots_by_mentor.get(m.mentor_id, [])
        result.append({
            "mentor_id": m.mentor_id,
            "name": m.full_name,
            "title": m.current_role or m.headline,
            "headline": m.headline,
            "company": m.company,
            "avatar_url": m.profile_photo,
            "years_experience": m.experience_years,
            "expertise_tags": m.expertise or m.skills,
            "skills": m.skills,
            "bio": m.bio,
            "education": m.education,
            "languages": m.languages,
            "mentoring_topics": m.mentoring_topics,
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
    """Retrieve full active mentor profile and open calendar slots."""
    mentor = await MentorProfile.find_one(
        MentorProfile.mentor_id == mentor_id,
        MentorProfile.profile_status == "ACTIVE",
    )
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found or not active.")

    now = datetime.now(timezone.utc)
    slots = await MentorSlot.find(
        {
            "mentor_id": mentor_id,
            "is_booked": False,
            "is_enabled": True,
            "start_time": {"$gte": now},
        }
    ).sort(MentorSlot.start_time).to_list(50)

    return {
        "mentor": mentor,
        "slots": [
            {
                "slot_id": s.slot_id,
                "available_day": s.available_day,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "duration_mins": s.duration_mins,
                "is_enabled": s.is_enabled,
            }
            for s in slots
        ],
    }


@router.post("/book", status_code=201)
async def book_mentor_slot(
    body: BookMentorRequest,
    current_student: dict = Depends(get_current_student),
):
    """Student books a real available mentor slot in MongoDB."""
    student_id = current_student["student_id"]
    user = current_student.get("user")

    mentor = await MentorProfile.find_one(
        MentorProfile.mentor_id == body.mentor_id,
        MentorProfile.profile_status == "ACTIVE",
    )
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found or not active.")

    slot = await MentorSlot.find_one(
        MentorSlot.slot_id == body.slot_id,
        MentorSlot.mentor_id == body.mentor_id,
    )
    if not slot or slot.is_booked or not slot.is_enabled:
        raise HTTPException(status_code=400, detail="This time slot is no longer available.")

    now = datetime.now(timezone.utc)
    start_utc = slot.start_time if slot.start_time.tzinfo else slot.start_time.replace(tzinfo=timezone.utc)
    if start_utc < now:
        raise HTTPException(status_code=400, detail="Selected time slot has already passed and cannot be booked.")

    # Prevent mentor double booking
    existing_mentor_booking = await MentorshipBooking.find_one({
        "mentor_id": mentor.mentor_id,
        "scheduled_at": slot.start_time,
        "status": {"$in": ["confirmed", "in_progress"]},
    })
    if existing_mentor_booking:
        slot.is_booked = True
        await slot.save()
        raise HTTPException(status_code=400, detail="This mentor slot has already been booked.")

    # Prevent student double booking
    existing_student_booking = await MentorshipBooking.find_one({
        "student_id": student_id,
        "scheduled_at": slot.start_time,
        "status": {"$in": ["confirmed", "in_progress"]},
    })
    if existing_student_booking:
        raise HTTPException(
            status_code=400,
            detail="You already have a mentoring session booked at this exact time."
        )

    student_name = user.full_name if user and user.full_name else "Student"
    student_email = user.email if user and user.email else ""

    meeting_channel_id = f"sd-mentor-{str(uuid.uuid4())[:8]}"
    meeting_url = f"/student/mock-interview?session={meeting_channel_id}&mode=mentor"

    booking = MentorshipBooking(
        student_id=student_id,
        student_name=student_name,
        student_email=student_email,
        mentor_id=mentor.mentor_id,
        mentor_name=mentor.full_name,
        mentor_company=mentor.company,
        slot_id=slot.slot_id,
        topic=body.topic or "1-on-1 Technical Mock Interview",
        target_role=body.target_role or "Software Development Engineer",
        target_company=body.target_company or mentor.company,
        student_notes=body.student_notes,
        scheduled_at=slot.start_time,
        duration_mins=slot.duration_mins,
        duration=slot.duration_mins,
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
        interviewer_name=mentor.full_name,
        mentor_id=mentor.mentor_id,
        mentor_name=mentor.full_name,
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
        title=f"1-to-1 Mentorship Confirmed with {mentor.full_name}",
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
        "mentor_name": mentor.full_name,
        "meeting_url": meeting_url,
    }


@router.get("/my-bookings")
async def get_my_bookings(
    current_student: dict = Depends(get_current_student),
):
    """Retrieve student's bookings from MongoDB."""
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

    # Recalculate mentor rating
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
