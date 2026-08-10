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
    StudentProject,
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

student_router = APIRouter(tags=["Projects — Student"])
company_router = APIRouter(tags=["Projects — Company"])


@company_router.post("")
async def create_project(
    body: CreateProjectRequest,
    current_company: dict = Depends(get_current_company),
):
    from app.models.target_company import CompanyProfile
    company_id = current_company["company_id"]
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company or not company.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company is not verified to create projects.",
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


# Student Endpoint - Project Brief & Submissions
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
    
# Student Endpoint (Community Feed & Peer Reviews)
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


# Group Collaboration (Up to 5 Members)

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


# ─── Student Personal Projects ────────────────────────────────────────────────

@student_router.post("/my-projects/create")
async def create_student_project(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Student creates their own personal project and gets an invite code for collaborators."""
    student_id = str(current_user.id)
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    creator_name = profile.name if profile else "Student"

    invite_code = uuid.uuid4().hex[:8].upper()

    project = StudentProject(
        created_by=student_id,
        creator_name=creator_name,
        title=body.get("title", "Untitled Project"),
        description=body.get("description", ""),
        tech_stack=body.get("tech_stack", []),
        difficulty=body.get("difficulty", "Intermediate"),
        looking_for=body.get("looking_for", []),
        max_members=body.get("max_members", 5),
        is_public=body.get("is_public", True),
        github_url=body.get("github_url"),
        demo_url=body.get("demo_url"),
        invite_code=invite_code,
        members=[GroupMember(student_id=student_id, name=creator_name)],
    )
    await project.insert()

    # Notify all other users that a new project group is open for collaboration
    await event_bus.publish("student_project.created", {
        "project_id": str(project.id),
        "creator_id": student_id,
        "creator_name": creator_name,
        "title": project.title,
    })

    return {
        "message": "Project created successfully.",
        "project_id": str(project.id),
        "invite_code": invite_code,
    }


@student_router.get("/my-projects/feed")
async def get_student_project_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """Public feed of all student-created projects (for discovery & collaboration)."""
    skip = (page - 1) * limit
    projects = (
        await StudentProject.find(StudentProject.is_public == True)  # noqa: E712
        .sort(-StudentProject.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )
    return [
        {
            "project_id": str(p.id),
            "created_by": p.created_by,
            "creator_name": p.creator_name,
            "title": p.title,
            "description": p.description,
            "tech_stack": p.tech_stack,
            "difficulty": p.difficulty,
            "looking_for": p.looking_for,
            "max_members": p.max_members,
            "current_members": len(p.members),
            "is_open": p.is_open,
            "github_url": p.github_url,
            "demo_url": p.demo_url,
            "invite_code": p.invite_code if p.created_by == str(current_user.id) else None,
            "members": [{"student_id": m.student_id, "name": m.name} for m in p.members],
            "created_at": p.created_at.isoformat(),
            "is_mine": p.created_by == str(current_user.id),
        }
        for p in projects
    ]


@student_router.get("/my-projects/mine")
async def get_my_student_projects(
    current_user: User = Depends(get_current_user),
):
    """Fetch all projects the current student created or joined."""
    student_id = str(current_user.id)
    # Created by me
    created = await StudentProject.find(StudentProject.created_by == student_id).to_list()
    # Joined (member but not creator)
    all_projects = await StudentProject.find().to_list()
    joined = [p for p in all_projects if any(m.student_id == student_id for m in p.members) and p.created_by != student_id]

    def serialize(p: StudentProject, is_mine: bool):
        return {
            "project_id": str(p.id),
            "created_by": p.created_by,
            "creator_name": p.creator_name,
            "title": p.title,
            "description": p.description,
            "tech_stack": p.tech_stack,
            "difficulty": p.difficulty,
            "looking_for": p.looking_for,
            "max_members": p.max_members,
            "current_members": len(p.members),
            "is_open": p.is_open,
            "github_url": p.github_url,
            "demo_url": p.demo_url,
            "invite_code": p.invite_code,
            "members": [{"student_id": m.student_id, "name": m.name} for m in p.members],
            "created_at": p.created_at.isoformat(),
            "is_mine": is_mine,
        }

    return [serialize(p, True) for p in created] + [serialize(p, False) for p in joined]


@student_router.post("/my-projects/join")
async def join_student_project(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Join a student-created project using its invite code."""
    student_id = str(current_user.id)
    invite_code = body.get("invite_code", "").upper()
    project = await StudentProject.find_one(StudentProject.invite_code == invite_code)
    if not project:
        raise HTTPException(status_code=404, detail="Invalid invite code.")
    if not project.is_open:
        raise HTTPException(status_code=400, detail="Project is full or closed.")
    if any(m.student_id == student_id for m in project.members):
        raise HTTPException(status_code=400, detail="You are already a member.")

    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    name = profile.name if profile else "Student"

    # Collect existing members before appending the new joiner (to notify them)
    existing_member_ids = [m.student_id for m in project.members if m.student_id != student_id]

    project.members.append(GroupMember(student_id=student_id, name=name))
    if len(project.members) >= project.max_members:
        project.is_open = False
    await project.save()

    # Notify existing group members of the new joiner
    await event_bus.publish("student_project.joined", {
        "project_id": str(project.id),
        "joiner_id": student_id,
        "joiner_name": name,
        "title": project.title,
        "existing_member_ids": existing_member_ids,
    })

    return {"message": f"Joined '{project.title}' successfully.", "project_id": str(project.id)}


@student_router.patch("/my-projects/{project_id}")
async def update_student_project(
    project_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Creator can update GitHub URL, demo URL, or close the project."""
    from beanie import PydanticObjectId
    student_id = str(current_user.id)
    project = await StudentProject.get(PydanticObjectId(project_id))
    if not project or project.created_by != student_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this project.")

    for field in ("github_url", "demo_url", "is_open", "description", "title"):
        if field in body:
            setattr(project, field, body[field])
    await project.save()
    return {"message": "Project updated."}
