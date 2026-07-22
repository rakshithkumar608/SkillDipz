from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone


class Certificate(BaseModel):
    cert_id: str
    role: str
    score: float
    issued_at: datetime
    pdf_path: Optional[str] = None


class EnrolledCourse(BaseModel):
    course_id: str
    title: str
    progress_pct: int = 0
    source: str


class StudentProfile(Document):
    student_id: str

    name: str = ""
    email: str = ""
    phone: Optional[str] = None
    college: Optional[str] = None
    branch: Optional[str] = None
    grad_year: Optional[int] = None
    avatar_url: Optional[str] = None
    avatar_file_path: Optional[str] = None

    # Social / external
    github: Optional[str] = None
    linkedin: Optional[str] = None
    cf_handle: Optional[str] = None

    # Career
    target_roles: Optional[str] = None
    target_company: Optional[str] = None

    # Resume
    resume_file_path: Optional[str] = None
    skills: List[str] = []
    resume_parsed_at: Optional[datetime] = None
    resume_parse_summary: Optional[str] = None

    # Visibality
    visibility_setting: str = "public"

    # Earned Certificates
    certificate: List[Certificate] = []

    # Enrolled courses
    enrolled_courses: List[EnrolledCourse] = []

    # Completeness (0-10 pts)
    completeness_score: int = 0

    update_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "student_profiles"

    @classmethod
    async def get_or_create(
        cls, student_id: str, email: str = "", name: str = ""
    ) -> "StudentProfile":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id, email=email, name=name)
            await doc.intsert()
        return doc

    def compute_completeness(self) -> int:
        """
        Spec:
          Education filled (college + branch + grad_year) → +2 pts
          GitHub linked                                   → +2 pts
          LinkedIn linked                                 → +2 pts
          Resume uploaded                                 → +2 pts
          Profile photo                                   → +1 pt
          Skills list (≥5 skills)                         → +1 pt
          Max = 10 pts
        """
        pts = 0
        if self.college and self.branch and self.grad_year:
            pts += 2
        if self.github:
            pts += 2
        if self.linkedin:
            pts += 2
        if self.resume_file_path:
            pts += 2
        if self.avatar_url or self.avatar_file_path:
            pts += 1
        if len(self.skills) >= 5:
            pts += 1
        return pts
