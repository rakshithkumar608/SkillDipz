from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone

class ProjectResource(BaseModel):
    name: str
    url: str
    
class GroupMember(BaseModel):
    student_id: str
    name: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
# Company Project Brief

class CompanyProject(Document):
    company_id: str
    company_name: str
    company_logo_emoji: Optional[str] = None
    
    title: str
    description: str
    project_idea: Optional[str] = None             # Full project scope & concept
    architecture_overview: Optional[str] = None    # Architecture & tech guidelines
    spec_document_url: Optional[str] = None        # Uploaded project spec document file URL
    spec_document_name: Optional[str] = None       # Original filename of spec document
    
    target_roles: List[str] = []
    required_skills: List[str] = []
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    deliverables: List[str] = []
    deadline_days: int = 14
    resources: List[ProjectResource] = []
    
    visibility: Literal["all_students", "shortlisted_only"] = "all_students"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Settings:
        name = "company_projects"
    
# Project Group (up to 5 Students)

class ProjectGroup(Document):
    project_id: str
    created_by: str
    name: str
    members: List[GroupMember] = []
    invite_code: str
    is_open: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Settings:
        name = "project_groups"
        

# Tracks when a student "accepts" / opens a project (for company stats)
class ProjectAcceptance(Document):
    project_id: str
    student_id: str
    student_name: str
    accepted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Settings:
        name = "project_acceptances"


#  Student Submission Document
class StudentProjectSubmission(Document):
    project_id: str
    student_id: str
    
    #  Group colloboration fields
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    group_members: List[GroupMember] = []
    
    github_url: str
    demo_url: Optional[str] = None
    deployment_url: Optional[str] = None     # explicit deployment URL
    what_i_learned: Optional[str] = None     # student's learning summary
    notes: Optional[str] = None              # implementation notes / brief
    
    # Asynchronous NLP Evaluation Results
    nlp_score: Optional[float] = None
    verified_skills: List[str] = []
    quality_signals: List[str] = []
    evaluation_status: Literal["pending", "evaluated", "failed"] = "pending"

    # Community visibility
    is_public: bool = True

    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    evaluated_at: Optional[datetime] = None

    class Settings:
        name = "project_submissions"


#  Peer Suggestion / Comment 

class ProjectComment(Document):
    submission_id: str                     
    author_id: str                         
    author_name: str
    body: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "project_comments"


# Student-created personal project
class StudentProject(Document):
    created_by: str                         # student_id
    creator_name: str
    title: str
    description: str
    tech_stack: List[str] = []
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    looking_for: List[str] = []             # roles wanted in the team
    max_members: int = 5
    is_open: bool = True                    # accepting new members
    is_public: bool = True
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    invite_code: str                        # for joining
    members: List[GroupMember] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "student_projects"