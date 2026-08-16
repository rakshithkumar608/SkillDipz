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