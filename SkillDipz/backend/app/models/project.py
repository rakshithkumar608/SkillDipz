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
    target_roles: List[str] = []
    required_skills: List[str] = []
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    deliverables: List[str] = []
    deadline_days: int = 14
    resources: List[ProjectResource] = []
    
    visibality: Literal["all_students", "shortlisted_only"] = "all_students"
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
    notes: Optional[str] = None
    
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