from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.models.consent import ConsentPurpose


class ConsentItem(BaseModel):
    purpose: ConsentPurpose
    granted: bool


class ConsentSubmitRequest(BaseModel):
    consents: List[ConsentItem]
    source: str = "web"


class ConsentRecordOut(BaseModel):
    purpose: ConsentPurpose
    granted: bool
    notice_version: str
    created_at: datetime
    withdrawn_at: Optional[datetime] = None


class ConsentWithdrawRequest(BaseModel):
    purpose: ConsentPurpose
