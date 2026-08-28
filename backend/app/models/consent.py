from beanie import Document
from pydantic import Field
from typing import Optional, Literal
from datetime import datetime, timezone

# DPDP Act, 2023 — every purpose consent is collected for must be named here.
# "account_essential" is not real "consent" (it's necessary for the contract),
# it is logged anyway so there is a complete record of what a user agreed to
# and when. Legal must confirm which purposes are genuinely consent-based
# vs. contractually necessary before this list is treated as final.
ConsentPurpose = Literal[
    "account_essential",       # login/session, fraud prevention — necessary, logged for transparency
    "profile_data_processing", # college/branch/phone/skills used for scoring & matching
    "resume_parsing",          # resume file storage + local NLP skill extraction
    "third_party_ai_analysis", # role/skill data sent to Groq for roadmap generation
    "recruiter_visibility",    # profile shown to companies (job matching/leaderboard)
    "marketing_communications" # optional — non-transactional email
]


class ConsentRecord(Document):
    user_id: str
    purpose: ConsentPurpose
    granted: bool
    notice_version: str = "v1-draft"   # bump when Privacy Notice copy changes
    source: str = "web"                # which form/screen captured this
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    withdrawn_at: Optional[datetime] = None

    class Settings:
        name = "consent_records"

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "665f1c...",
                "purpose": "profile_data_processing",
                "granted": True,
                "notice_version": "v1-draft",
                "source": "register_form",
            }
        }
