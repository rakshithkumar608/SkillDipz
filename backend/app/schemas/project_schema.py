from pydantic import BaseModel
from typing import Optional, List, Literal


class CreateProjectRequest(BaseModel):
    title: str
    description: str
    project_idea: Optional[str] = None
    architecture_overview: Optional[str] = None
    spec_document_url: Optional[str] = None
    spec_document_name: Optional[str] = None
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
    project_idea: Optional[str] = None
    architecture_overview: Optional[str] = None
    spec_document_url: Optional[str] = None
    spec_document_name: Optional[str] = None
    difficulty: str
    deadline_days: int
    required_skills: List[str]
    deliverables: List[str]
    resources: List[dict]
    status: Literal["available", "submitted", "evaluated"]
    is_accepted: bool = False
    acceptance_count: int = 0
    my_submission: Optional[dict] = None


# Company project list output (with stats)
class CompanyProjectOut(BaseModel):
    project_id: str
    title: str
    description: str
    project_idea: Optional[str] = None
    architecture_overview: Optional[str] = None
    spec_document_url: Optional[str] = None
    spec_document_name: Optional[str] = None
    difficulty: str
    deadline_days: int
    required_skills: List[str]
    target_roles: List[str]
    deliverables: List[str]
    resources: List[dict]
    visibility: str
    is_active: bool
    created_at: str
    submission_count: int       # how many submitted
    acceptance_count: int       # how many students accepted/opened



class SubmitProjectRequest(BaseModel):
    github_url: str
    demo_url: Optional[str] = None
    deployment_url: Optional[str] = None   # explicit deployment link
    what_i_learned: Optional[str] = None   # student's learning summary
    notes: Optional[str] = None            # implementation notes / brief
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
    deployment_url: Optional[str] = None
    what_i_learned: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: str
    evaluation_status: str
    nlp_score: Optional[float]
    verified_skills: List[str]
    is_group: bool
    group_name: Optional[str]
    group_members: List[dict] = []