from beanie import Document
from pydantic import Field
from typing import Optional, Literal
from datetime import datetime, timezone

DataRightType = Literal["access", "correct", "erase", "withdraw_consent"]
RequestStatus = Literal["open", "in_progress", "completed", "rejected"]


class DataRightsRequest(Document):
    """
    DPDP Act, 2023 gives a Data Principal the right to:
      - confirm whether their data is being processed & access it (s.11)
      - correct/complete/update it (s.12)
      - erase it once the purpose is served / consent withdrawn (s.12)
      - withdraw consent as easily as it was given (s.6(4))
    This is the intake queue. There is currently NO automated fulfilment
    (no export job, no cascading-delete job) — see DPDP_PROGRESS.md open items.
    A human on the grievance team must action each request manually for now.
    """
    user_id: str
    email: str
    request_type: DataRightType
    details: Optional[str] = None
    status: RequestStatus = "open"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None

    class Settings:
        name = "data_rights_requests"
