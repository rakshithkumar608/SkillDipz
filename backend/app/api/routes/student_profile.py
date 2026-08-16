import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.core.ws_manager import ws_manager
from app.models.employability_score import EmployabilityScore, ScoreHistory
from app.models.roadmap import StudentRoadmap
from app.models.skill_gap import StudentSkillLevel
from app.models.student_profile import Certificate, EnrolledCourse, StudentProfile
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/students", tags=["Student Profile"])

# Constants
ALLOWED_RESUME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB
RESUME_DIR = Path("uploads") / "resumes"

PHOTO_DIR = Path("uploads") / "photos"
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE = 2 * 1024 * 1024  # 2 MB


class CertificateOut(BaseModel):
    cert_id: str
    role: str
    score: float
    issued_at: datetime
    pdf_path: Optional[str] = None


class EnrolledCourseOut(BaseModel):
    course_id: str
    title: str
    progress_pct: int
    source: str


class ScoreBreakdownOut(BaseModel):
    """
    Spec field names: coding, conceptual, learning, project, profile
    Mapped from EmployabilityScore components + profile completeness.
    """
    coding: float          # ← assessment_score (code tests + CF)
    conceptual: float      # ← assessment_score (MCQ conceptual)
    learning: float        # ← activity_consistency (roadmap progress)
    project: float         # ← project_strength
    profile: float         # ← completeness_pct (10% weight component)


class CompletenessFieldOut(BaseModel):
    label: str
    weight: int
    done: bool
    action: Optional[str] = None


class ProfileOut(BaseModel):
    student_id: str
    name: str
    email: str
    phone: Optional[str]
    college: Optional[str]
    branch: Optional[str]
    grad_year: Optional[int]
    avatar_url: Optional[str]
    github: Optional[str]
    linkedin: Optional[str]
    cf_handle: Optional[str]
    target_role: Optional[str]
    target_company: Optional[str]
    skills: List[str]
    visibility_setting: str
    resume_uploaded: bool
    resume_url: Optional[str]            # Downloadable URL served by our API
    resume_parsed_at: Optional[datetime]
    resume_parse_summary: Optional[str]
    certificates: List[CertificateOut]
    enrolled_courses: List[EnrolledCourseOut]
    score_breakdown: ScoreBreakdownOut
    completeness_score: int              # 0–10
    completeness_pct: float              # 0–100
    completeness_fields: List[CompletenessFieldOut]


def _mark_cert_pdf_url(cert_id: str, request_base: str = "") -> str:
    return f"/students/certificates/{cert_id}/pdf"


def _build_profile_out(
    profile: StudentProfile,
    score_doc: EmployabilityScore,
    base_url: str = "",
) -> ProfileOut:
    comp = score_doc.components
    completeness_pct = round(profile.completeness_score / 10 * 100, 1)

    # ── Score breakdown mapping (spec: coding/conceptual/learning/project/profile) ──
    coding_val = round(comp.assessment_score * 0.5, 2)
    conceptual_val = round(comp.assessment_score * 0.5, 2)
    breakdown = ScoreBreakdownOut(
        coding=coding_val,
        conceptual=conceptual_val,
        learning=comp.activity_consistency,
        project=comp.project_strength,
        profile=completeness_pct,
    )

    # Completeness Checklist
    def field(label: str, weight: int, done: bool, action: str | None = None):
        return CompletenessFieldOut(label=label, weight=weight, done=done, action=None if done else action)
    fields = [
        field("Education filled", 2,
              bool(profile.college and profile.branch and profile.grad_year),
              "Add education"),
        field("GitHub linked", 2, bool(profile.github), "Add GitHub"),
        field("LinkedIn linked", 2, bool(profile.linkedin), "Add LinkedIn"),
        field("Resume uploaded", 2, bool(
            profile.resume_file_path), "Upload resume"),
        field("Profile photo", 1, bool(
            profile.avatar_url or profile.avatar_file_path), "Add photo"),
        field("Skills list (≥5)", 1, len(
            profile.skills) >= 5, "Add more skills"),
    ]

    # ── Resume download URL ──
    resume_url = (
        f"/students/me/resume/download"
        if profile.resume_file_path
        else None
    )

    return ProfileOut(
        student_id=profile.student_id,
        name=profile.name,
        email=profile.email,
        phone=profile.phone,
        college=profile.college,
        branch=profile.branch,
        grad_year=profile.grad_year,
        avatar_url=profile.avatar_url,
        github=profile.github,
        linkedin=profile.linkedin,
        cf_handle=profile.cf_handle,
        target_role=profile.target_roles or score_doc.target_role,
        target_company=profile.target_company,
        skills=profile.skills,
        visibility_setting=profile.visibility_setting,
        resume_uploaded=bool(profile.resume_file_path),
        resume_url=resume_url,
        resume_parsed_at=profile.resume_parsed_at,
        resume_parse_summary=profile.resume_parse_summary,
        certificates=[
            CertificateOut(
                cert_id=c.cert_id,
                role=c.role,
                score=c.score,
                issued_at=c.issued_at,
                pdf_url=f"/students/me/certificates/{c.cert_id}/pdf"
                if c.pdf_path else None,
            )
            for c in profile.certificate
        ],
        enrolled_courses=[
            EnrolledCourseOut(
                course_id=ec.course_id,
                title=ec.title,
                progress_pct=ec.progress_pct,
                source=ec.source,
            )
            for ec in profile.enrolled_courses
        ],
        score_breakdown=breakdown,
        completeness_score=profile.completeness_score,
        completeness_pct=completeness_pct,
        completeness_fields=fields,
    )


async def _sync_completeness_to_score(
    student_id: str,
    completeness_pct: float,
):
    score_doc = await EmployabilityScore.get_or_create(student_id)
    score_doc.components.resume_quality = completeness_pct
    new_overall = score_doc.compute_overall()
    score_doc.overall_score = new_overall
    score_doc.last_updated = datetime.now(timezone.utc)
    score_doc.history.append(ScoreHistory(score=new_overall))
    score_doc.history = score_doc.history[-7:]
    await score_doc.save()

    # Push real-time WS event so the overview gauge updates instantly
    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": score_doc.components.model_dump(),
            "last_updated": score_doc.last_updated.isoformat(),
        },
    )
    return score_doc


#  GET /students/me/profile

@router.get("/me/profile", response_model=ProfileOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)

    profile = await StudentProfile.get_or_create(
        student_id, email=current_user.email, name=current_user.full_name
    )

    # Keep basic fields in sync with User document (source of truth)
    profile.name = current_user.full_name
    profile.email = current_user.email
    if current_user.college and not profile.college:
        profile.college = current_user.college
    if current_user.phone and not profile.phone:
        profile.phone = current_user.phone

    profile.completeness_score = profile.compute_completeness()
    await profile.save()

    score_doc = await EmployabilityScore.get_or_create(student_id)
    return _build_profile_out(profile, score_doc)

# PUT /students/me/profile


class ProfileUpdatePayload(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    branch: Optional[str] = None
    grad_year: Optional[int] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    cf_handle: Optional[str] = None
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    visibility_setting: Optional[str] = None


@router.put("/me/profile", response_model=ProfileOut)
async def update_my_profile(
    body: ProfileUpdatePayload,
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    profile = await StudentProfile.get_or_create(
        student_id, email=current_user.email, name=current_user.full_name
    )

    if body.name is not None:
        profile.name = body.name
        current_user.full_name = body.name
        await current_user.save()
    if body.phone is not None:
        profile.phone = body.phone
        current_user.phone = body.phone
        await current_user.save()
    if body.college is not None:
        profile.college = body.college
    if body.branch is not None:
        profile.branch = body.branch
    if body.grad_year is not None:
        profile.grad_year = body.grad_year
    if body.github is not None:
        profile.github = body.github
    if body.linkedin is not None:
        profile.linkedin = body.linkedin
    if body.target_role is not None:
        profile.target_roles = body.target_role
        score_doc = await EmployabilityScore.get_or_create(student_id)
        score_doc.target_role = body.target_role
        await score_doc.save()
    if body.target_company is not None:
        profile.target_company = body.target_company
        from app.core.redis_client import get_redis
        rc = get_redis()
        if rc:
            await rc.delete(f"matched_companies:{student_id}")
    if body.visibility_setting is not None:
        if body.visibility_setting not in ("public", "companies_only", "private"):
            raise HTTPException(
                status_code=400, detail="Invalid visibility_setting.")
        profile.visibility_setting = body.visibility_setting

    # ── Codeforces handle change → fetch + credit solved problems ──
    if body.cf_handle is not None and body.cf_handle != profile.cf_handle:
        profile.cf_handle = body.cf_handle
        if body.cf_handle:
            await _sync_codeforces(student_id, body.cf_handle, profile)

    # ── Recompute completeness → sync to EmployabilityScore ──
    profile.completeness_score = profile.compute_completeness()
    completeness_pct = round(profile.completeness_score / 10 * 100, 1)
    profile.update_at = datetime.now(timezone.utc)
    await profile.save()

    score_doc = await _sync_completeness_to_score(student_id, completeness_pct)

    # Push profile_updated WS event
    await ws_manager.broadcast(
        student_id,
        "profile_updated",
        {
            "completeness_pct": completeness_pct,
            "completeness_score": profile.completeness_score,
        },
    )

    return _build_profile_out(profile, score_doc)


# Codeforces sync helper

async def _sync_codeforces(
    student_id: str, cf_handle: str, profile: StudentProfile
):
    try:
        url = (
            f"https://codeforces.com/api/user.status"
            f"?handle={cf_handle}&from=1&count=500"
        )
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(url)

        if resp.status_code != 200:
            logger.warning(
                f"CF API returned {resp.status_code} for {cf_handle}")
            return

        data = resp.json()
        if data.get("status") != "OK":
            logger.warning(f"CF API error: {data.get('comment')}")
            return

            solved_problems: dict[str, set[str]] = {}
        for sub in data.get("result", []):
            if sub.get("verdict") == "OK":
                prob = sub.get("problem", {})
                pid = f"{prob.get('contestId', '')}{prob.get('index', '')}"
                tags = {t.lower() for t in prob.get("tags", [])}
                solved_problems[pid] = tags

        all_tags: set[str] = set()
        for tags in solved_problems.values():
            all_tags.update(tags)

        for tag in all_tags:
            existing = await StudentSkillLevel.find_one(
                StudentSkillLevel.student_id == student_id,
                StudentSkillLevel.skill == tag,
            )
            if not existing:
                await StudentSkillLevel(
                    student_id=student_id, skill=tag,
                    current_level=2, source="codeforces"
                ).insert()
            elif existing.current_level < 2:
                existing.current_level = 2
                existing.source = "codeforces"
                await existing.save()

        existing_lower = {s.lower() for s in profile.skills}
        for tag in all_tags:
            if tag not in existing_lower:
                profile.skills.append(tag)
                existing_lower.add(tag)

        solved_count = len(solved_problems)
        coding_score = min(100.0, round(solved_count * 0.5, 1))

        score_doc = await EmployabilityScore.get_or_create(student_id)
        score_doc.components.assessment_score = max(
            score_doc.components.assessment_score, coding_score
        )
        new_overall = score_doc.compute_overall()
        score_doc.overall_score = new_overall
        score_doc.last_updated = datetime.now(timezone.utc)
        score_doc.history.append(ScoreHistory(score=new_overall))
        score_doc.history = score_doc.history[-7:]
        await score_doc.save()

        await ws_manager.broadcast(
            student_id,
            "score_update",
            {
                "overall_score": new_overall,
                "components": score_doc.components.model_dump(),
                "last_updated": score_doc.last_updated.isoformat(),
                "trigger": "codeforces_sync",
                "cf_problems_solved": solved_count,
            },
        )

        logger.info(
            f"CF sync done for {cf_handle}: "
            f"{solved_count} problems, {len(all_tags)} tags → score {coding_score}"
        )

    except Exception as e:
        logger.error(f"Codeforces sync error for {cf_handle}: {e}")


# PUT /students/me/resume (NLP parse + WS push)

class ResumeAnalysisOut(BaseModel):
    message: str
    file_name: str
    resume_uploaded: bool
    skills_extracted: List[str]
    parse_summary: str
    completeness_pct: float


@router.put("/me/resume", response_model=ResumeAnalysisOut)
async def upload_and_analyze_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Spec: PUT /students/me/resume (multipart)
    → Save file → NLP re-parse → update skills
    → Recompute completeness → sync to EmployabilityScore → WS push
    """
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF or Word (.doc / .docx) files are accepted.",
        )

    contents = await file.read()
    if len(contents) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 5 MB.")

    ext = Path(file.filename or "resume").suffix.lower() or ".pdf"
    safe_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    dest = RESUME_DIR / safe_name
    dest.write_bytes(contents)
    logger.info(f"Resume saved: {dest}")

    student_id = str(current_user.id)

    extracted_skills: list[str] = []
    parse_summary = "Resume uploaded successfully."
    try:
        if ext == ".pdf":
            extracted_skills, parse_summary = _parse_pdf_skills(contents)
        else:
            extracted_skills, parse_summary = _parse_docx_skills(contents)
    except Exception as e:
        logger.warning(f"NLP parse failed: {e}")
        parse_summary = "Resume uploaded. Skill extraction will retry shortly."

    roadmap = await StudentRoadmap.get_or_create(student_id)
    roadmap.resume_uploaded = True
    roadmap.resume_file_path = str(dest)
    # Reset phases so the roadmap is rebuilt fresh from the new resume's skills
    roadmap.phases = []
    roadmap.last_regenerated = None
    roadmap.progress_pct = 0
    roadmap.completed_skills = 0
    roadmap.total_skills = 0
    roadmap.next_skill = None
    await roadmap.save()

    profile = await StudentProfile.get_or_create(
        student_id, email=current_user.email, name=current_user.full_name
    )
    profile.resume_file_path = str(dest)
    profile.resume_parsed_at = datetime.now(timezone.utc)
    profile.resume_parse_summary = parse_summary

    # Replace skills entirely — wipe old resume skills so new resume is the source of truth
    await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id,
        StudentSkillLevel.source == "resume",
    ).delete()
    profile.skills = list(extracted_skills)  # replace, not append

    for sk in extracted_skills:
        await StudentSkillLevel(
            student_id=student_id, skill=sk.lower(),
            current_level=1, source="resume"
        ).insert()

    profile.completeness_score = profile.compute_completeness()
    completeness_pct = round(profile.completeness_score / 10 * 100, 1)
    await profile.save()

    score_doc = await _sync_completeness_to_score(student_id, completeness_pct)

    await ws_manager.broadcast(
        student_id,
        "resume_analyzed",
        {
            "skills_extracted": extracted_skills,
            "completeness_pct": completeness_pct,
            "parse_summary": parse_summary,
            "new_overall_score": score_doc.overall_score,
        },
    )

    return ResumeAnalysisOut(
        message="Resume uploaded and analyzed successfully.",
        file_name=safe_name,
        resume_uploaded=True,
        skills_extracted=extracted_skills,
        parse_summary=parse_summary,
        completeness_pct=completeness_pct,
    )


#  GET /students/me/resume/download

@router.get("/me/resume/download")
async def download_my_resume(current_user: User = Depends(get_current_user)):
    """Serve the student's uploaded resume file for download."""
    student_id = str(current_user.id)
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)

    if not profile or not profile.resume_file_path:
        raise HTTPException(status_code=404, detail="No resume uploaded.")

    file_path = Path(profile.resume_file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail="Resume file not found on disk.")

    return FileResponse(
        path=str(file_path),
        filename=f"resume_{current_user.full_name.replace(' ', '_')}{file_path.suffix}",
        media_type="application/octet-stream",
    )


# GET /students/me/certificates/:cert_id/pdf

@router.get("/me/certificates/{cert_id}/pdf")
async def download_certificate_pdf(
    cert_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Spec: GET /certificates/:id/pdf → S3 signed URL
    For local dev: serves from disk. Swap pdf_path for S3 key in production.
    """
    student_id = str(current_user.id)
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    cert = next((c for c in profile.certificates if c.cert_id == cert_id), None)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    if not cert.pdf_path:
        raise HTTPException(
            status_code=404, detail="Certificate PDF not available yet.")

    pdf_file = Path(cert.pdf_path)
    if not pdf_file.exists():
        raise HTTPException(
            status_code=404, detail="Certificate file not found.")

    return FileResponse(
        path=str(pdf_file),
        filename=f"certificate_{cert_id}.pdf",
        media_type="application/pdf",
    )


#  PUT /students/me/profile/photo

class PhotoUploadOut(BaseModel):
    message: str
    avatar_url: str
    completeness_pct: float


@router.put("/me/profile/photo", response_model=PhotoUploadOut)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a profile photo (JPEG / PNG / WebP, max 2 MB)."""
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=400, detail="Only JPEG, PNG, or WebP images accepted.")

    contents = await file.read()
    if len(contents) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=400, detail="Image must be under 2 MB.")

    ext = Path(file.filename or "photo").suffix.lower() or ".jpg"
    safe_name = f"{current_user.id}_photo_{uuid.uuid4().hex}{ext}"
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    dest = PHOTO_DIR / safe_name
    dest.write_bytes(contents)

    student_id = str(current_user.id)
    profile = await StudentProfile.get_or_create(
        student_id, email=current_user.email, name=current_user.full_name
    )
    profile.avatar_file_path = str(dest)
    profile.avatar_url = f"/uploads/photos/{safe_name}"

    profile.completeness_score = profile.compute_completeness()
    completeness_pct = round(profile.completeness_score / 10 * 100, 1)
    await profile.save()

    await _sync_completeness_to_score(student_id, completeness_pct)

    await ws_manager.broadcast(
        student_id,
        "profile_updated",
        {"completeness_pct": completeness_pct, "avatar_url": profile.avatar_url},
    )

    return PhotoUploadOut(
        message="Photo uploaded successfully.",
        avatar_url=profile.avatar_url,
        completeness_pct=completeness_pct,
    )

#  NLP Helpers

TECH_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "React", "Next.js", "Node.js",
    "FastAPI", "Django", "Flask", "Spring Boot", "Express", "SQL", "PostgreSQL",
    "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure",
    "Git", "REST API", "GraphQL", "Microservices", "CI/CD", "Linux", "Nginx",
    "C++", "C#", ".NET", "Go", "Rust", "Kotlin", "Swift", "Flutter", "React Native",
    "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy", "Spark",
    "Kafka", "RabbitMQ", "Elasticsearch", "Terraform", "Ansible", "Jenkins",
    "HTML", "CSS", "Tailwind", "Material UI", "Figma", "System Design",
    "Data Structures", "Algorithms", "Machine Learning", "Deep Learning",
    "Vue", "Angular", "PHP", "Laravel", "Ruby", "Rails", "Scala",
    "Jetpack Compose", "SwiftUI", "Firebase", "Supabase", "Prisma",
    "OpenAI", "LangChain", "Hugging Face", "BERT", "GPT",
]

# Skills that need a special regex (not simple word boundaries)
_SPECIAL_SKILL_PATTERNS: dict[str, str] = {
    "C++":     r"c\+\+",
    "C#":      r"c#",
    ".NET":    r"\.net",
    "CI/CD":   r"ci/cd",
    "REST API": r"rest\s+api",
    "Node.js": r"node\.js",
    "Next.js": r"next\.js",
    "React.js": r"react\.js",
    "Vue.js":  r"vue\.js",
    "Express.js": r"express\.js",
    "Scikit-learn": r"scikit[- ]learn",
    "React Native": r"react\s+native",
    "Spring Boot": r"spring\s+boot",
    "Material UI": r"material\s+ui",
    "Data Structures": r"data\s+structures",
    "Deep Learning": r"deep\s+learning",
    "Machine Learning": r"machine\s+learning",
    "System Design": r"system\s+design",
    "Jetpack Compose": r"jetpack\s+compose",
    "Hugging Face": r"hugging\s+face",
    "LangChain": r"langchain",
    "OpenAI": r"openai",
}


def _parse_pdf_skills(content: bytes) -> tuple[list[str], str]:
    """Extract skills from PDF bytes using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        full_text = "".join(page.get_text() for page in doc)
        doc.close()
        return _extract_skills_from_text(full_text)
    except ImportError:
        text = content.decode("latin-1", errors="ignore")
        return _extract_skills_from_text(text)


def _parse_docx_skills(content: bytes) -> tuple[list[str], str]:
    """Extract skills from DOCX bytes using python-docx."""
    try:
        import io
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(content))
        full_text = "\n".join(p.text for p in doc.paragraphs)
        return _extract_skills_from_text(full_text)
    except ImportError:
        text = content.decode("latin-1", errors="ignore")
        return _extract_skills_from_text(text)


def _extract_skills_from_text(text: str) -> tuple[list[str], str]:
    """Word-boundary match of known tech skills against resume text."""
    found: list[str] = []
    text_lower = text.lower()
    for skill in TECH_SKILLS:
        # Use special pattern if defined, otherwise word boundaries
        if skill in _SPECIAL_SKILL_PATTERNS:
            pattern = _SPECIAL_SKILL_PATTERNS[skill]
        else:
            pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill)

    summary = (
        f"Extracted {len(found)} technical skills: "
        f"{', '.join(found[:8])}{'...' if len(found) > 8 else ''}."
        if found
        else "No known technical skills detected. Please add your skills manually."
    )
    return found, summary