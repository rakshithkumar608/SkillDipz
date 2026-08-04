# Feature 8 — Projects (Full Implementation Spec & Code)

> **Rule:** Do NOT touch the main codebase directly. Apply every change described
> below once you are ready. All code is production-ready with zero mock data.
>
> **All Spec Requirements & Extra Features Included:**
> 1. **Company Side**: Project brief upload (`POST /companies/me/projects`), Resource attachments, View submissions (`GET /companies/me/projects/:id/submissions`).
> 2. **Student Side**: Matched project feed (`GET /projects/me`), Project detail view with resource downloads, Submission flow (`POST /projects/:id/submit`).
> 3. **NLP Evaluation**: Async worker parsing GitHub README & repository structure via GitHub API, scoring evidence, verifying skills, updating `EmployabilityScore` (15% project component), real-time WebSocket push & push notifications.
> 4. **Group Collaboration (Extra requested)**: Students can create/join a group of up to 5 members with shareable invite codes. Submissions link all team members and are viewable by companies.
> 5. **Community Feed & Peer Suggestions (Extra requested)**: Students can view public project submissions, inspect GitHub repos, and leave suggestions/comments.
> 6. **Modular Clean Frontend Structure**: Split into focused, reusable components in `frontend/src/components/projects/`.

---

## Architecture & Data Flow

```
╔═════════════════════════════════════════════════════════════════════════════════════════════╗
║                                   PROJECT FLOW & ARCHITECTURE                               ║
║                                                                                             ║
║  [Company Portal] ──POST /companies/me/projects──> [CompanyProject Collection]               ║
║                                                            │                                ║
║                                                 [Event Bus: project.posted]                 ║
║                                                            │                                ║
║                                                            ▼                                ║
║  [Student Portal] <──GET /projects/me──────────── [Notification Push to Students]           ║
║        │                                                                                    ║
║        ├── Group Formation: [ProjectGroup Collection] (Max 5 members with Invite Code)     ║
║        │                                                                                    ║
║        └── Submit Repo: ──POST /projects/:id/submit──> [StudentProjectSubmission]          ║
║                                                                  │                          ║
║                                                     [Event Bus: project.submitted]          ║
║                                                                  │                          ║
║                                                                  ▼                          ║
║                                                      [NLP Evaluation Worker]                ║
║                                                      ├── Fetch GitHub README & File Tree    ║
║                                                      ├── Verify Required Skills             ║
║                                                      └── Calculate Evidence Score (0-100%)  ║
║                                                                  │                          ║
║                                                                  ▼                          ║
║                                                       [AI Employability Score]              ║
║                                                       ├── Update project_strength (15%)     ║
║                                                       ├── Push WS Score Gauge Animation     ║
║                                                       └── Push Notification to Student & Co ║
║                                                                                             ║
║  [Community Feed] ──View & Peer Suggestion──> [ProjectComment Collection]                    ║
╚═════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Backend Implementation

### 1. NEW FILE `backend/app/models/project.py`

```python
# FILE: backend/app/models/project.py

from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone


class ProjectResource(BaseModel):
    name: str
    url: str   # S3 URL or public document URL


class GroupMember(BaseModel):
    student_id: str
    name: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Company Project Brief ───────────────────────────────────────────────────

class CompanyProject(Document):
    company_id: str
    company_name: str
    company_logo_emoji: Optional[str] = None

    title: str
    description: str
    target_roles: List[str] = []        # e.g. ["backend", "fullstack"]
    required_skills: List[str] = []
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    deliverables: List[str] = []
    deadline_days: int = 14             # Days allowed for completion
    resources: List[ProjectResource] = []

    visibility: Literal["all_students", "shortlisted_only"] = "all_students"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "company_projects"


# ─── Project Group (Up to 5 Students) ────────────────────────────────────────

class ProjectGroup(Document):
    project_id: str                         # FK -> CompanyProject ID string
    created_by: str                         # student_id of creator
    name: str                               # Team/Group Name
    members: List[GroupMember] = []         # Max 5 members
    invite_code: str                        # 8-char unique join code
    is_open: bool = True                    # Auto-closes at 5 members
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "project_groups"


# ─── Student Submission Document ─────────────────────────────────────────────

class StudentProjectSubmission(Document):
    project_id: str                         # FK -> CompanyProject ID string
    student_id: str                         # Primary submitter ID

    # Group collaboration info (Optional)
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    group_members: List[GroupMember] = []

    github_url: str
    demo_url: Optional[str] = None
    notes: Optional[str] = None

    # Asynchronous NLP Evaluation Results
    nlp_score: Optional[float] = None       # Evidence score (0.0 - 1.0)
    verified_skills: List[str] = []
    quality_signals: List[str] = []
    evaluation_status: Literal["pending", "evaluated", "failed"] = "pending"

    # Community visibility
    is_public: bool = True

    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    evaluated_at: Optional[datetime] = None

    class Settings:
        name = "project_submissions"


# ─── Peer Suggestion / Comment ───────────────────────────────────────────────

class ProjectComment(Document):
    submission_id: str                      # FK -> StudentProjectSubmission ID string
    author_id: str                          # student_id who commented
    author_name: str
    body: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "project_comments"
```

---

### 2. NEW FILE `backend/app/schemas/project_schema.py`

```python
# FILE: backend/app/schemas/project_schema.py

from pydantic import BaseModel
from typing import Optional, List, Literal


class CreateProjectRequest(BaseModel):
    title: str
    description: str
    target_roles: List[str] = []
    required_skills: List[str] = []
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    deliverables: List[str] = []
    deadline_days: int = 14
    visibility: Literal["all_students", "shortlisted_only"] = "all_students"
    resources: List[dict] = []


class ProjectCardOut(BaseModel):
    project_id: str
    company_name: str
    company_logo_emoji: Optional[str]
    title: str
    description: str
    difficulty: str
    deadline_days: int
    required_skills: List[str]
    deliverables: List[str]
    resources: List[dict]
    status: Literal["available", "submitted", "evaluated"]
    my_submission: Optional[dict] = None


class SubmitProjectRequest(BaseModel):
    github_url: str
    demo_url: Optional[str] = None
    notes: Optional[str] = None
    is_public: bool = True
    group_id: Optional[str] = None


class CreateGroupRequest(BaseModel):
    project_id: str
    group_name: str


class JoinGroupRequest(BaseModel):
    invite_code: str


class CommunitySubmissionOut(BaseModel):
    submission_id: str
    project_id: str
    project_title: str
    company_name: str
    student_id: str
    student_name: str
    github_url: str
    demo_url: Optional[str]
    notes: Optional[str]
    nlp_score: Optional[float]
    verified_skills: List[str]
    is_group: bool
    group_name: Optional[str]
    submitted_at: str
    comment_count: int


class AddCommentRequest(BaseModel):
    body: str


class CommentOut(BaseModel):
    comment_id: str
    author_id: str
    author_name: str
    body: str
    created_at: str


class CompanySubmissionOut(BaseModel):
    submission_id: str
    student_id: str
    student_name: str
    github_url: str
    demo_url: Optional[str]
    submitted_at: str
    evaluation_status: str
    nlp_score: Optional[float]
    verified_skills: List[str]
    is_group: bool
    group_name: Optional[str]
    group_members: List[dict] = []
```

---

### 3. NEW FILE `backend/app/api/routes/projects.py`

```python
# FILE: backend/app/api/routes/projects.py

import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_current_company
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.project import (
    CompanyProject,
    ProjectGroup,
    StudentProjectSubmission,
    ProjectComment,
    GroupMember,
    ProjectResource,
)
from app.models.student_profile import StudentProfile
from app.schemas.project_schema import (
    CreateProjectRequest,
    ProjectCardOut,
    SubmitProjectRequest,
    CreateGroupRequest,
    JoinGroupRequest,
    CommunitySubmissionOut,
    AddCommentRequest,
    CommentOut,
    CompanySubmissionOut,
)
from app.core.event_bus import event_bus
from app.services.notification_service import send_notification

logger = logging.getLogger(__name__)

student_router = APIRouter(prefix="/projects", tags=["Projects — Student"])
company_router = APIRouter(prefix="/companies/me/projects", tags=["Projects — Company"])


# ═══════════════════════════════════════════════════════════════════════════════
#  COMPANY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@company_router.post("")
async def create_project(
    body: CreateProjectRequest,
    current_company: dict = Depends(get_current_company),
):
    """Company posts a project brief."""
    from app.models.target_company import CompanyProfile
    company_id = current_company["company_id"]
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company or not company.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company must be verified to post projects.",
        )

    resources = [ProjectResource(name=r["name"], url=r["url"]) for r in body.resources]

    project = CompanyProject(
        company_id=company_id,
        company_name=company.name,
        company_logo_emoji=getattr(company, "logo_emoji", "🏢"),
        title=body.title,
        description=body.description,
        target_roles=body.target_roles,
        required_skills=body.required_skills,
        difficulty=body.difficulty,
        deliverables=body.deliverables,
        deadline_days=body.deadline_days,
        visibility=body.visibility,
        resources=resources,
    )
    await project.insert()

    # Dispatch event to notify students
    await event_bus.publish("project.posted", {
        "project_id": str(project.id),
        "company_id": company_id,
        "company_name": company.name,
        "title": body.title,
        "target_roles": body.target_roles,
    })

    return {"message": "Project brief posted successfully.", "project_id": str(project.id)}


@company_router.get("/{project_id}/submissions", response_model=List[CompanySubmissionOut])
async def get_project_submissions(
    project_id: str,
    current_company: dict = Depends(get_current_company),
):
    """Company retrieves all submissions (solo & group) for a project."""
    from beanie import PydanticObjectId
    project = await CompanyProject.get(PydanticObjectId(project_id))
    if not project or project.company_id != current_company["company_id"]:
        raise HTTPException(status_code=404, detail="Project not found.")

    submissions = await StudentProjectSubmission.find(
        StudentProjectSubmission.project_id == project_id
    ).to_list()

    out = []
    for sub in submissions:
        profile = await StudentProfile.find_one(StudentProfile.student_id == sub.student_id)
        student_name = profile.name if profile else sub.student_id
        out.append(
            CompanySubmissionOut(
                submission_id=str(sub.id),
                student_id=sub.student_id,
                student_name=student_name,
                github_url=sub.github_url,
                demo_url=sub.demo_url,
                submitted_at=sub.submitted_at.isoformat(),
                evaluation_status=sub.evaluation_status,
                nlp_score=sub.nlp_score,
                verified_skills=sub.verified_skills,
                is_group=bool(sub.group_id),
                group_name=sub.group_name,
                group_members=[{"student_id": m.student_id, "name": m.name} for m in sub.group_members],
            )
        )
    return out


# ═══════════════════════════════════════════════════════════════════════════════
#  STUDENT ENDPOINTS — Project Briefs & Submissions
# ═══════════════════════════════════════════════════════════════════════════════

@student_router.get("/me", response_model=List[ProjectCardOut])
async def get_my_projects(
    current_user: User = Depends(get_current_user),
):
    """Student fetches role-matched projects with submission status."""
    student_id = str(current_user.id)
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    student_role = (profile.target_roles or "").lower() if profile else ""

    all_projects = await CompanyProject.find(CompanyProject.is_active == True).to_list()  # noqa: E712

    # Filter projects by target role matching
    relevant = []
    for proj in all_projects:
        if not proj.target_roles:
            relevant.append(proj)
        elif student_role and any(student_role in r.lower() for r in proj.target_roles):
            relevant.append(proj)
        elif not student_role:
            relevant.append(proj)

    # Map existing student submissions
    my_subs = await StudentProjectSubmission.find(
        StudentProjectSubmission.student_id == student_id
    ).to_list()
    sub_map = {s.project_id: s for s in my_subs}

    cards = []
    for proj in relevant:
        proj_id = str(proj.id)
        sub = sub_map.get(proj_id)
        if sub:
            s_status = "evaluated" if sub.evaluation_status == "evaluated" else "submitted"
            my_sub = {
                "github_url": sub.github_url,
                "demo_url": sub.demo_url,
                "submitted_at": sub.submitted_at.isoformat(),
                "nlp_score": sub.nlp_score,
                "evaluation_status": sub.evaluation_status,
            }
        else:
            s_status = "available"
            my_sub = None

        cards.append(
            ProjectCardOut(
                project_id=proj_id,
                company_name=proj.company_name,
                company_logo_emoji=proj.company_logo_emoji,
                title=proj.title,
                description=proj.description,
                difficulty=proj.difficulty,
                deadline_days=proj.deadline_days,
                required_skills=proj.required_skills,
                deliverables=proj.deliverables,
                resources=[{"name": r.name, "url": r.url} for r in proj.resources],
                status=s_status,
                my_submission=my_sub,
            )
        )
    return cards


@student_router.post("/{project_id}/submit")
async def submit_project(
    project_id: str,
    body: SubmitProjectRequest,
    current_user: User = Depends(get_current_user),
):
    """Student submits a project (Solo or Group) with GitHub repo URL."""
    from beanie import PydanticObjectId
    student_id = str(current_user.id)

    project = await CompanyProject.get(PydanticObjectId(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project brief not found.")

    existing = await StudentProjectSubmission.find_one(
        StudentProjectSubmission.project_id == project_id,
        StudentProjectSubmission.student_id == student_id,
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this project.")

    # Resolve group details if submitted as a team
    group_id = body.group_id
    group_name = None
    group_members = []
    if group_id:
        group = await ProjectGroup.find_one(ProjectGroup.invite_code == group_id)
        if not group or str(group.project_id) != project_id:
            raise HTTPException(status_code=404, detail="Invalid group for this project.")
        group_name = group.name
        group_members = group.members

    submission = StudentProjectSubmission(
        project_id=project_id,
        student_id=student_id,
        group_id=group_id,
        group_name=group_name,
        group_members=group_members,
        github_url=body.github_url,
        demo_url=body.demo_url,
        notes=body.notes,
        is_public=body.is_public,
    )
    await submission.insert()

    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    student_name = profile.name if profile else "A student"

    # Dispatch event for async NLP evaluation
    await event_bus.publish("project.submitted", {
        "submission_id": str(submission.id),
        "project_id": project_id,
        "student_id": student_id,
        "student_name": student_name,
        "github_url": body.github_url,
        "required_skills": project.required_skills,
        "company_id": project.company_id,
        "company_name": project.company_name,
        "project_title": project.title,
    })

    return {
        "message": "Project submitted successfully. NLP evaluation in progress.",
        "submission_id": str(submission.id),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  STUDENT ENDPOINTS — Community Feed & Peer Reviews
# ═══════════════════════════════════════════════════════════════════════════════

@student_router.get("/community", response_model=List[CommunitySubmissionOut])
async def get_community_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """Retrieve public project submissions for peer inspection and suggestions."""
    skip = (page - 1) * limit
    submissions = (
        await StudentProjectSubmission.find(StudentProjectSubmission.is_public == True)  # noqa: E712
        .sort(-StudentProjectSubmission.submitted_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )

    out = []
    for sub in submissions:
        from beanie import PydanticObjectId
        project = await CompanyProject.get(PydanticObjectId(sub.project_id))
        profile = await StudentProfile.find_one(StudentProfile.student_id == sub.student_id)
        comment_count = await ProjectComment.find(ProjectComment.submission_id == str(sub.id)).count()

        out.append(
            CommunitySubmissionOut(
                submission_id=str(sub.id),
                project_id=sub.project_id,
                project_title=project.title if project else "Project Brief",
                company_name=project.company_name if project else "Company",
                student_id=sub.student_id,
                student_name=profile.name if profile else "Student",
                github_url=sub.github_url,
                demo_url=sub.demo_url,
                notes=sub.notes,
                nlp_score=sub.nlp_score,
                verified_skills=sub.verified_skills,
                is_group=bool(sub.group_id),
                group_name=sub.group_name,
                submitted_at=sub.submitted_at.isoformat(),
                comment_count=comment_count,
            )
        )
    return out


@student_router.get("/{project_id}/submissions/{submission_id}/comments", response_model=List[CommentOut])
async def get_comments(
    submission_id: str,
    current_user: User = Depends(get_current_user),
):
    """Fetch comments/suggestions for a specific project submission."""
    comments = (
        await ProjectComment.find(ProjectComment.submission_id == submission_id)
        .sort(ProjectComment.created_at)
        .to_list()
    )
    return [
        CommentOut(
            comment_id=str(c.id),
            author_id=c.author_id,
            author_name=c.author_name,
            body=c.body,
            created_at=c.created_at.isoformat(),
        )
        for c in comments
    ]


@student_router.post("/{project_id}/submissions/{submission_id}/comments")
async def add_comment(
    submission_id: str,
    body: AddCommentRequest,
    current_user: User = Depends(get_current_user),
):
    """Post a peer suggestion on a student's public project submission."""
    student_id = str(current_user.id)
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    author_name = profile.name if profile else "Student"

    comment = ProjectComment(
        submission_id=submission_id,
        author_id=student_id,
        author_name=author_name,
        body=body.body,
    )
    await comment.insert()

    # Notify submission owner of peer suggestion
    from beanie import PydanticObjectId
    sub = await StudentProjectSubmission.get(PydanticObjectId(submission_id))
    if sub and sub.student_id != student_id:
        await send_notification(
            student_id=sub.student_id,
            title="New suggestion on your project",
            body=f"{author_name} left a suggestion: \"{body.body[:60]}...\"" if len(body.body) > 60 else f"{author_name} left a suggestion: \"{body.body}\"",
            action_url="/student/projects",
            notification_type="general",
        )

    return {"message": "Suggestion posted.", "comment_id": str(comment.id)}


# ═══════════════════════════════════════════════════════════════════════════════
#  STUDENT ENDPOINTS — Group Collaboration (Up to 5 Members)
# ═══════════════════════════════════════════════════════════════════════════════

@student_router.post("/groups/create")
async def create_group(
    body: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
):
    """Form a project group (Max 5 people) for team planning & submission."""
    student_id = str(current_user.id)
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    name = profile.name if profile else "Student"

    invite_code = uuid.uuid4().hex[:8].upper()

    group = ProjectGroup(
        project_id=body.project_id,
        created_by=student_id,
        name=body.group_name,
        members=[GroupMember(student_id=student_id, name=name)],
        invite_code=invite_code,
        is_open=True,
    )
    await group.insert()
    return {
        "message": "Group created successfully.",
        "group_id": str(group.id),
        "invite_code": invite_code,
    }


@student_router.post("/groups/join")
async def join_group(
    body: JoinGroupRequest,
    current_user: User = Depends(get_current_user),
):
    """Join an existing project group using a team invite code."""
    student_id = str(current_user.id)
    group = await ProjectGroup.find_one(ProjectGroup.invite_code == body.invite_code)
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code.")
    if not group.is_open:
        raise HTTPException(status_code=400, detail="Group is closed or full.")
    if any(m.student_id == student_id for m in group.members):
        raise HTTPException(status_code=400, detail="You are already in this group.")
    if len(group.members) >= 5:
        group.is_open = False
        await group.save()
        raise HTTPException(status_code=400, detail="Group is full (maximum 5 members allowed).")

    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    name = profile.name if profile else "Student"

    group.members.append(GroupMember(student_id=student_id, name=name))
    if len(group.members) >= 5:
        group.is_open = False
    await group.save()

    # Notify group leader
    await send_notification(
        student_id=group.created_by,
        title="Teammate joined your group",
        body=f"{name} joined your project group \"{group.name}\".",
        action_url="/student/projects",
        notification_type="general",
    )

    return {
        "message": f"Successfully joined group '{group.name}'.",
        "group_id": str(group.id),
        "member_count": len(group.members),
    }


@student_router.get("/groups/{invite_code}")
async def get_group_details(
    invite_code: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve group details and member roster by invite code."""
    group = await ProjectGroup.find_one(ProjectGroup.invite_code == invite_code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    return {
        "group_id": str(group.id),
        "name": group.name,
        "project_id": group.project_id,
        "invite_code": group.invite_code,
        "is_open": group.is_open,
        "members": [{"student_id": m.student_id, "name": m.name} for m in group.members],
    }
```

---

### 4. MODIFY `backend/app/core/event_bus.py`

Add NLP evaluation execution and event listeners.

```python
# ADD TO: backend/app/core/event_bus.py

async def _handle_project_posted(payload: dict) -> None:
    """Notify students when a new company project brief is published."""
    from app.models.student_profile import StudentProfile
    from app.services.notification_service import send_notification

    target_roles = payload.get("target_roles", [])
    company_name = payload.get("company_name", "A company")
    project_title = payload.get("title", "New Project")

    all_profiles = await StudentProfile.find_all().to_list()
    for profile in all_profiles:
        student_role = (profile.target_roles or "").lower()
        if target_roles and student_role:
            if not any(student_role in r.lower() for r in target_roles):
                continue
        await send_notification(
            student_id=profile.student_id,
            title=f"New Project Brief from {company_name}",
            body=f"{company_name} uploaded: \"{project_title}\". View project brief!",
            action_url="/student/projects",
            notification_type="general",
        )


async def _handle_project_submitted(payload: dict) -> None:
    """Trigger async NLP evaluation worker on project submission."""
    import asyncio
    asyncio.create_task(_run_nlp_evaluation(payload))


async def _run_nlp_evaluation(payload: dict) -> None:
    """
    Real NLP Evaluation Worker:
    Fetches GitHub README and directory structure via GitHub API,
    cross-references required_skills, computes quality signals, and updates score.
    """
    import httpx
    from app.models.project import StudentProjectSubmission
    from beanie import PydanticObjectId
    from datetime import datetime, timezone

    submission_id = payload.get("submission_id")
    github_url = payload.get("github_url", "")
    required_skills = payload.get("required_skills", [])

    if not submission_id or not github_url:
        return

    try:
        parts = github_url.rstrip("/").replace("https://github.com/", "").split("/")
        if len(parts) < 2:
            raise ValueError("Invalid GitHub URL format")
        owner, repo = parts[0], parts[1]

        verified_skills = []
        quality_signals = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch repository README
            readme_res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={"Accept": "application/vnd.github.raw"},
            )
            readme_text = readme_res.text.lower() if readme_res.status_code == 200 else ""

            # Fetch file tree
            tree_res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=0",
            )
            file_names = ""
            if tree_res.status_code == 200:
                tree = tree_res.json()
                file_names = " ".join(item["path"].lower() for item in tree.get("tree", []))

        combined_evidence = readme_text + " " + file_names

        for skill in required_skills:
            if skill.lower() in combined_evidence:
                verified_skills.append(skill)

        if len(readme_text) > 250:
            quality_signals.append("Comprehensive README")
        if "docker" in combined_evidence or "dockerfile" in file_names:
            quality_signals.append("Docker Configuration")
        if ".github" in file_names or "ci" in file_names:
            quality_signals.append("CI/CD Pipeline")
        if "test" in file_names or "spec" in file_names:
            quality_signals.append("Automated Test Suite")

        skill_match = len(verified_skills) / len(required_skills) if required_skills else 0.5
        quality_bonus = min(0.2, len(quality_signals) * 0.05)
        evidence_score = round(min(1.0, skill_match * 0.8 + quality_bonus), 2)

        sub = await StudentProjectSubmission.get(PydanticObjectId(submission_id))
        if sub:
            sub.nlp_score = evidence_score
            sub.verified_skills = verified_skills
            sub.quality_signals = quality_signals
            sub.evaluation_status = "evaluated"
            sub.evaluated_at = datetime.now(timezone.utc)
            await sub.save()

            await event_bus.publish("project.evaluated", {
                "submission_id": submission_id,
                "student_id": sub.student_id,
                "project_id": sub.project_id,
                "nlp_score": evidence_score,
                "verified_skills": verified_skills,
                "quality_signals": quality_signals,
            })

    except Exception as e:
        logger.error(f"NLP Evaluation failed for {submission_id}: {e}")
        sub = await StudentProjectSubmission.get(PydanticObjectId(submission_id))
        if sub:
            sub.evaluation_status = "failed"
            await sub.save()


async def _handle_project_evaluated(payload: dict) -> None:
    """Update Employability Score (15% project_strength) and notify student & company."""
    from app.models.employability_score import EmployabilityScore, ScoreHistory
    from app.models.project import CompanyProject
    from app.services.notification_service import send_notification
    from app.core.ws_manager import ws_manager
    from beanie import PydanticObjectId
    from datetime import datetime, timezone

    student_id = payload.get("student_id")
    nlp_score = payload.get("nlp_score", 0.0)
    project_id = payload.get("project_id", "")
    verified_skills = payload.get("verified_skills", [])

    if not student_id:
        return

    # Update Employability Score
    score_doc = await EmployabilityScore.get_or_create(student_id)
    new_strength = min(100.0, max(score_doc.components.project_strength, nlp_score * 100))
    score_doc.components.project_strength = new_strength
    new_overall = score_doc.compute_overall()
    score_doc.overall_score = new_overall
    score_doc.last_updated = datetime.now(timezone.utc)
    score_doc.history.append(ScoreHistory(score=new_overall))
    score_doc.history = score_doc.history[-7:]
    await score_doc.save()

    # Broadcast WebSocket update for real-time gauge animation
    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": score_doc.components.model_dump(),
            "last_updated": score_doc.last_updated.isoformat(),
        },
    )

    pct = int(nlp_score * 100)
    await send_notification(
        student_id=student_id,
        title=f"Your project scored {pct}%!",
        body=f"NLP Verified Skills: {', '.join(verified_skills[:3])}. Employability score updated!",
        action_url="/student/projects",
        notification_type="score_update",
    )

    # Notify Company
    try:
        project = await CompanyProject.get(PydanticObjectId(project_id))
        if project:
            from app.models.student_profile import StudentProfile
            profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
            student_name = profile.name if profile else "A student"
            await send_notification(
                student_id=project.company_id,
                title="New Project Submission Received",
                body=f"{student_name} submitted '{project.title}' (Score: {pct}%).",
                action_url=f"/company/projects/{project_id}/submissions",
                notification_type="general",
            )
    except Exception as e:
        logger.warning(f"Company notification error: {e}")


def register_target_company_handlers():
    # Existing event subscriptions...
    event_bus.subscribe("project.posted", _handle_project_posted)
    event_bus.subscribe("project.submitted", _handle_project_submitted)
    event_bus.subscribe("project.evaluated", _handle_project_evaluated)
```

---

### 5. MODIFY `backend/app/core/database.py`

Register models & indexes.

```python
# In backend/app/core/database.py imports:
from app.models.project import (
    CompanyProject,
    ProjectGroup,
    StudentProjectSubmission,
    ProjectComment,
)

# In connect_db() document_models array:
# CompanyProject,
# ProjectGroup,
# StudentProjectSubmission,
# ProjectComment,

# Index initialization:
await CompanyProject.get_motor_collection().create_index([("target_roles", 1), ("is_active", 1)])
await ProjectGroup.get_motor_collection().create_index("invite_code", unique=True)
await StudentProjectSubmission.get_motor_collection().create_index([("student_id", 1), ("project_id", 1)], unique=True)
await StudentProjectSubmission.get_motor_collection().create_index([("is_public", 1), ("submitted_at", -1)])
await ProjectComment.get_motor_collection().create_index([("submission_id", 1), ("created_at", 1)])
```

---

### 6. MODIFY `backend/main.py`

```python
from app.api.routes.projects import student_router as projects_student_router
from app.api.routes.projects import company_router as projects_company_router

app.include_router(projects_student_router, prefix="/v1")
app.include_router(projects_company_router, prefix="/v1")
```

---

## Frontend Implementation (Modular Component Architecture)

### 7. NEW FILE `frontend/src/lib/projectsApi.ts`

```typescript
// FILE: frontend/src/lib/projectsApi.ts

import api from "@/lib/api";

export interface ProjectResource {
  name: string;
  url: string;
}

export interface MySubmission {
  github_url: string;
  demo_url?: string;
  submitted_at: string;
  nlp_score: number | null;
  evaluation_status: string;
}

export interface ProjectCard {
  project_id: string;
  company_name: string;
  company_logo_emoji: string | null;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  deadline_days: number;
  required_skills: string[];
  deliverables: string[];
  resources: ProjectResource[];
  status: "available" | "submitted" | "evaluated";
  my_submission: MySubmission | null;
}

export interface CommunitySubmission {
  submission_id: string;
  project_id: string;
  project_title: string;
  company_name: string;
  student_id: string;
  student_name: string;
  github_url: string;
  demo_url: string | null;
  notes: string | null;
  nlp_score: number | null;
  verified_skills: string[];
  is_group: boolean;
  group_name: string | null;
  submitted_at: string;
  comment_count: number;
}

export interface Comment {
  comment_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface SubmitProjectPayload {
  github_url: string;
  demo_url?: string;
  notes?: string;
  is_public?: boolean;
  group_id?: string;
}

export const getMyProjects = async (): Promise<ProjectCard[]> => {
  const { data } = await api.get<ProjectCard[]>("/projects/me");
  return data;
};

export const submitProject = async (
  projectId: string,
  payload: SubmitProjectPayload
): Promise<{ message: string; submission_id: string }> => {
  const { data } = await api.post(`/projects/${projectId}/submit`, payload);
  return data;
};

export const getCommunityFeed = async (page = 1, limit = 20): Promise<CommunitySubmission[]> => {
  const { data } = await api.get<CommunitySubmission[]>(`/projects/community?page=${page}&limit=${limit}`);
  return data;
};

export const getComments = async (submissionId: string): Promise<Comment[]> => {
  const { data } = await api.get<Comment[]>(`/projects/sub/submissions/${submissionId}/comments`);
  return data;
};

export const addComment = async (submissionId: string, body: string): Promise<{ message: string; comment_id: string }> => {
  const { data } = await api.post(`/projects/sub/submissions/${submissionId}/comments`, { body });
  return data;
};

export const createGroup = async (payload: { project_id: string; group_name: string }): Promise<{ invite_code: string }> => {
  const { data } = await api.post("/projects/groups/create", payload);
  return data;
};

export const joinGroup = async (inviteCode: string): Promise<{ message: string }> => {
  const { data } = await api.post("/projects/groups/join", { invite_code: inviteCode });
  return data;
};
```

---

### 8. NEW COMPONENT `frontend/src/components/projects/GroupPanel.tsx`

```tsx
// FILE: frontend/src/components/projects/GroupPanel.tsx

"use client";

import { useState } from "react";
import { createGroup, joinGroup } from "@/lib/projectsApi";
import { Loader2, Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";

interface GroupPanelProps {
  projectId: string;
}

export default function GroupPanel({ projectId }: GroupPanelProps) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    setLoading(true);
    try {
      const res = await createGroup({ project_id: projectId, group_name: groupName });
      setCreatedCode(res.invite_code);
      toast.success("Group created! Share the code with your teammates.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create group.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const res = await joinGroup(inviteCode.trim().toUpperCase());
      toast.success(res.message);
      setMode("idle");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to join group.");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
        <Users className="w-3.5 h-3.5" /> Group Work (Up to 5 Students)
      </div>

      {createdCode ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Invite Code (Share with team):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-sky-400 font-mono text-sm tracking-widest">
              {createdCode}
            </code>
            <button
              onClick={copyCode}
              className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : mode === "idle" ? (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setMode("create")}
            className="flex-1 py-1.5 text-xs font-medium text-slate-300 border border-white/[0.08] rounded-lg hover:bg-white/[0.05] transition-all"
          >
            + Create Group
          </button>
          <button
            onClick={() => setMode("join")}
            className="flex-1 py-1.5 text-xs font-medium text-slate-300 border border-white/[0.08] rounded-lg hover:bg-white/[0.05] transition-all"
          >
            Join Group
          </button>
        </div>
      ) : mode === "create" ? (
        <div className="space-y-2">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Team Name (e.g. Fullstack Squad)"
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("idle")}
              className="flex-1 py-1 text-xs text-slate-500 border border-white/[0.06] rounded-lg hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !groupName.trim()}
              className="flex-1 py-1 text-xs font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/25 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Create"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Enter 8-digit code"
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("idle")}
              className="flex-1 py-1 text-xs text-slate-500 border border-white/[0.06] rounded-lg hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleJoin}
              disabled={loading || !inviteCode.trim()}
              className="flex-1 py-1 text-xs font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/25 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Join"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 9. NEW COMPONENT `frontend/src/components/projects/SubmitProjectModal.tsx`

```tsx
// FILE: frontend/src/components/projects/SubmitProjectModal.tsx

"use client";

import { useState } from "react";
import { submitProject, ProjectCard } from "@/lib/projectsApi";
import { Github, Globe, Send, X, Loader2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface SubmitModalProps {
  project: ProjectCard;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SubmitProjectModal({ project, onClose, onSubmitted }: SubmitModalProps) {
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!githubUrl.startsWith("https://github.com/")) {
      toast.error("Please enter a valid GitHub repository URL.");
      return;
    }
    setLoading(true);
    try {
      await submitProject(project.project_id, {
        github_url: githubUrl,
        demo_url: demoUrl || undefined,
        notes: notes || undefined,
        is_public: isPublic,
        group_id: groupId || undefined,
      });
      toast.success("Project submitted! NLP evaluation started.");
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Submit Project</h2>
            <p className="text-xs text-slate-400">{project.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">GitHub Repository URL *</label>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repository"
                className="w-full pl-9 pr-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Deployed Demo URL (Optional)</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://your-app.railway.app"
                className="w-full pl-9 pr-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Implementation Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key design patterns, JWT auth, validation, database schema..."
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Group Code (If working as a team)</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={groupId}
                onChange={(e) => setGroupId(e.target.value.toUpperCase())}
                placeholder="8-digit group code"
                className="w-full pl-9 pr-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-sky-500"
            />
            <span className="text-xs text-slate-400">Share with peer community feed for review & suggestions</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !githubUrl}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold hover:bg-sky-500/30 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

---

### 10. NEW COMPONENT `frontend/src/components/projects/ProjectDetailModal.tsx`

```tsx
// FILE: frontend/src/components/projects/ProjectDetailModal.tsx

"use client";

import { ProjectCard } from "@/lib/projectsApi";
import GroupPanel from "./GroupPanel";
import { X, Clock, Download, CheckCircle2, ShieldCheck, Send } from "lucide-react";
import { motion } from "framer-motion";

interface DetailModalProps {
  project: ProjectCard;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ProjectDetailModal({ project, onClose, onSubmit }: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl space-y-5 scrollbar-thin"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-sky-400 font-medium">{project.company_name}</span>
            <h2 className="text-xl font-bold text-white mt-0.5">{project.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</h4>
            <p className="leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/[0.05]">{project.description}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Deliverables</h4>
            <div className="space-y-1.5">
              {project.deliverables.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {project.required_skills.map((skill) => (
                <span key={skill} className="px-2.5 py-1 text-xs bg-white/[0.05] border border-white/[0.08] text-slate-200 rounded-lg">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {project.resources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Starter Resources & Documentation</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.resources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-sky-400 hover:bg-sky-500/10 transition-all"
                  >
                    <Download className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{res.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Group Formation */}
          {project.status === "available" && <GroupPanel projectId={project.project_id} />}
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 text-sm hover:text-white">
            Close
          </button>
          {project.status === "available" && (
            <button
              onClick={() => {
                onClose();
                onSubmit();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold hover:bg-sky-500/30"
            >
              <Send className="w-4 h-4" /> Submit Solution
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
```

---

### 11. NEW COMPONENT `frontend/src/components/projects/CommentSection.tsx`

```tsx
// FILE: frontend/src/components/projects/CommentSection.tsx

"use client";

import { useEffect, useState } from "react";
import { getComments, addComment, Comment } from "@/lib/projectsApi";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface CommentSectionProps {
  submissionId: string;
}

export default function CommentSection({ submissionId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    try {
      const data = await getComments(submissionId);
      setComments(data);
    } catch {
      toast.error("Could not load comments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [submissionId]);

  const handlePost = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await addComment(submissionId, text.trim());
      setText("");
      await fetchAll();
      toast.success("Suggestion submitted!");
    } catch {
      toast.error("Failed to submit suggestion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-3 border-t border-white/[0.06] space-y-3">
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-sky-500 mx-auto" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-1">No suggestions yet. Share your feedback!</p>
      ) : (
        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.comment_id} className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[9px] font-bold">
                {c.author_name[0]}
              </div>
              <div className="flex-1 text-xs">
                <span className="font-semibold text-slate-300">{c.author_name}</span>{" "}
                <span className="text-[10px] text-slate-600">· {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                <p className="text-slate-400 mt-0.5">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
          placeholder="Write suggestion / code feedback..."
          className="flex-1 px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
        />
        <button
          onClick={handlePost}
          disabled={submitting || !text.trim()}
          className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-400 hover:bg-sky-500/25 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
```

---

### 12. NEW COMPONENT `frontend/src/components/projects/CommunityFeedCard.tsx`

```tsx
// FILE: frontend/src/components/projects/CommunityFeedCard.tsx

"use client";

import { useState } from "react";
import { CommunitySubmission } from "@/lib/projectsApi";
import CommentSection from "./CommentSection";
import { Github, Globe, Star, Users, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommunityCardProps {
  submission: CommunitySubmission;
}

export default function CommunityFeedCard({ submission }: CommunityCardProps) {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-white/[0.06] rounded-2xl p-4 space-y-3 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 mb-0.5 truncate">{submission.company_name} — {submission.project_title}</p>
          <p className="text-sm font-semibold text-white truncate">{submission.student_name}</p>
          {submission.is_group && submission.group_name && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-400 mt-0.5">
              <Users className="w-3 h-3" /> Team: {submission.group_name}
            </span>
          )}
        </div>
        {submission.nlp_score != null && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Star className="w-3 h-3" />
            <span className="text-xs font-semibold">{Math.round(submission.nlp_score * 100)}%</span>
          </div>
        )}
      </div>

      {submission.verified_skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {submission.verified_skills.map((skill) => (
            <span key={skill} className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              ✓ {skill}
            </span>
          ))}
        </div>
      )}

      {submission.notes && <p className="text-xs text-slate-400 line-clamp-2">{submission.notes}</p>}

      <div className="flex items-center gap-3 pt-1 text-xs">
        <a href={submission.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-300 hover:text-white">
          <Github className="w-3.5 h-3.5" /> Repository
        </a>
        {submission.demo_url && (
          <a href={submission.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
            <Globe className="w-3.5 h-3.5" /> Live Demo
          </a>
        )}
        <span className="flex-1" />
        <button onClick={() => setShowComments((p) => !p)} className="flex items-center gap-1 text-slate-400 hover:text-sky-400">
          <MessageCircle className="w-3.5 h-3.5" /> {submission.comment_count > 0 && submission.comment_count} Suggestions
        </button>
      </div>

      {showComments && <CommentSection submissionId={submission.submission_id} />}
    </div>
  );
}
```

---

### 13. NEW COMPONENT `frontend/src/components/projects/ProjectCard.tsx`

```tsx
// FILE: frontend/src/components/projects/ProjectCard.tsx

"use client";

import { ProjectCard as ProjectCardType } from "@/lib/projectsApi";
import { Clock, Send, Eye, CheckCircle2, Sparkles } from "lucide-react";

interface ProjectCardProps {
  project: ProjectCardType;
  onViewDetails: () => void;
  onSubmit: () => void;
}

export default function ProjectCard({ project, onViewDetails, onSubmit }: ProjectCardProps) {
  return (
    <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{project.company_logo_emoji ?? "🏢"}</span>
            <span className="text-xs text-slate-400">{project.company_name}</span>
          </div>
          <h3 className="font-semibold text-white text-base">{project.title}</h3>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
          {project.difficulty}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" /> {project.deadline_days} Days Completion Window
      </div>

      <div className="flex flex-wrap gap-1.5">
        {project.required_skills.map((s) => (
          <span key={s} className="text-[10px] text-slate-300 bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/[0.06]">
            {s}
          </span>
        ))}
      </div>

      {project.status === "evaluated" && project.my_submission?.nlp_score != null && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Sparkles className="w-4 h-4" /> Evaluated Score: {Math.round(project.my_submission.nlp_score * 100)}%
        </div>
      )}

      <div className="flex gap-2 pt-2 mt-auto">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/[0.08] text-slate-300 text-xs font-medium hover:bg-white/[0.05]"
        >
          <Eye className="w-3.5 h-3.5" /> Details
        </button>
        {project.status === "available" ? (
          <button
            onClick={onSubmit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/30"
          >
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
        ) : (
          <div className="flex-1 py-2 text-center rounded-xl bg-slate-800 text-slate-400 text-xs flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" /> Submitted
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 14. CLEAN MAIN PAGE `frontend/src/app/student/projects/page.tsx`

```tsx
// FILE: frontend/src/app/student/projects/page.tsx
// FULL MODULAR PAGE REPLACEMENT

"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyProjects, getCommunityFeed, ProjectCard as ProjectCardType, CommunitySubmission } from "@/lib/projectsApi";
import ProjectCard from "@/components/projects/ProjectCard";
import CommunityFeedCard from "@/components/projects/CommunityFeedCard";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";
import SubmitProjectModal from "@/components/projects/SubmitProjectModal";
import { FolderOpen, RefreshCw, Loader2, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Tab = "my-projects" | "community";

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("my-projects");
  const [projects, setProjects] = useState<ProjectCardType[]>([]);
  const [community, setCommunity] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailProject, setDetailProject] = useState<ProjectCardType | null>(null);
  const [submitProjectTarget, setSubmitProjectTarget] = useState<ProjectCardType | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProjects();
      setProjects(data);
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCommunity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommunityFeed();
      setCommunity(data);
    } catch {
      toast.error("Failed to load community feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "my-projects") loadProjects();
    else loadCommunity();
  }, [activeTab, loadProjects, loadCommunity]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/10">
            <FolderOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Company Projects</h1>
            <p className="text-slate-500 text-xs mt-0.5">Real company briefs, group collaboration & automated NLP evaluation</p>
          </div>
        </div>
        <button
          onClick={() => (activeTab === "my-projects" ? loadProjects() : loadCommunity())}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/[0.06] text-xs text-slate-300 hover:bg-slate-700/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab("my-projects")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "my-projects" ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Company Briefs
        </button>
        <button
          onClick={() => setActiveTab("community")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "community" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Peer Community Feed
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
          <span className="ml-3 text-sm text-slate-400">Loading projects data...</span>
        </div>
      ) : activeTab === "my-projects" ? (
        projects.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">No project briefs matched to your role right now.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <ProjectCard
                key={proj.project_id}
                project={proj}
                onViewDetails={() => setDetailProject(proj)}
                onSubmit={() => setSubmitProjectTarget(proj)}
              />
            ))}
          </div>
        )
      ) : community.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">No public peer submissions yet. Be the first to share!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {community.map((sub) => (
            <CommunityFeedCard key={sub.submission_id} submission={sub} />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {detailProject && (
          <ProjectDetailModal
            project={detailProject}
            onClose={() => setDetailProject(null)}
            onSubmit={() => setSubmitProjectTarget(detailProject)}
          />
        )}
      </AnimatePresence>

      {/* Submit Modal */}
      <AnimatePresence>
        {submitProjectTarget && (
          <SubmitProjectModal
            project={submitProjectTarget}
            onClose={() => setSubmitProjectTarget(null)}
            onSubmitted={loadProjects}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## Complete Summary of Modular File Changes

| # | File Path | Action | Role & Purpose |
|---|-----------|--------|----------------|
| 1 | `backend/app/models/project.py` | **NEW** | Defines `CompanyProject`, `ProjectGroup` (up to 5), `StudentProjectSubmission`, `ProjectComment`. |
| 2 | `backend/app/schemas/project_schema.py` | **NEW** | Pydantic data schemas for company upload & student submission. |
| 3 | `backend/app/api/routes/projects.py` | **NEW** | FastAPI routes for company project management, student submissions, group creation/joining, community feed & peer suggestions. |
| 4 | `backend/app/core/event_bus.py` | **MODIFY** | Integrates real GitHub API NLP evaluation worker & updates 15% project_strength employability score. |
| 5 | `backend/app/core/database.py` | **MODIFY** | Registers Beanie models & MongoDB collection indexes. |
| 6 | `backend/main.py` | **MODIFY** | Includes company & student project API routers. |
| 7 | `frontend/src/lib/projectsApi.ts` | **NEW** | Frontend API client functions & TypeScript interfaces. |
| 8 | `frontend/src/components/projects/GroupPanel.tsx` | **NEW** | Team formation component for 5-member project groups & invite codes. |
| 9 | `frontend/src/components/projects/SubmitProjectModal.tsx` | **NEW** | Submission modal with GitHub repo, live demo, notes, and community toggle. |
| 10 | `frontend/src/components/projects/ProjectDetailModal.tsx` | **NEW** | Full project brief view, deliverables, starter downloads & submission trigger. |
| 11 | `frontend/src/components/projects/CommentSection.tsx` | **NEW** | Interactive peer suggestion & code review drawer. |
| 12 | `frontend/src/components/projects/CommunityFeedCard.tsx` | **NEW** | Peer project card displaying verified skills, NLP score, group badge & feedback. |
| 13 | `frontend/src/components/projects/ProjectCard.tsx` | **NEW** | Compact project card component for company briefs. |
| 14 | `frontend/src/app/student/projects/page.tsx` | **REPLACE** | Clean high-level container page for tab switching and modal management. |
