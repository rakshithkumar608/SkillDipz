from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from app.models.user import User
from app.models.data_rights_request import DataRightsRequest, DataRightType
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/data-rights", tags=["data-rights"])


class DataRightsRequestIn(BaseModel):
    request_type: DataRightType
    details: Optional[str] = None


class DataRightsRequestOut(BaseModel):
    id: str
    request_type: DataRightType
    details: Optional[str]
    status: str
    created_at: str

    @classmethod
    def from_doc(cls, doc: DataRightsRequest) -> "DataRightsRequestOut":
        return cls(
            id=str(doc.id),
            request_type=doc.request_type,
            details=doc.details,
            status=doc.status,
            created_at=doc.created_at.isoformat(),
        )


@router.post("/request", response_model=DataRightsRequestOut, status_code=201)
async def submit_data_rights_request(
    body: DataRightsRequestIn,
    current_user: User = Depends(get_current_user),
):
    """
    Intake only. Per DPDP Act ss.11-13, the platform must acknowledge and
    action these within a reasonable time (a fixed statutory SLA has not
    been set for this section — legal to confirm the internal turnaround
    target, e.g. 30 days, that goes in the Privacy Notice).

    THIS ENDPOINT DOES NOT YET FULFIL THE REQUEST. There is no automated
    export job for "access", no cascading-delete job for "erase". A human
    must action every row in `data_rights_requests` manually until those
    jobs exist. See DPDP_PROGRESS.md open items.
    """
    doc = DataRightsRequest(
        user_id=str(current_user.id),
        email=current_user.email,
        request_type=body.request_type,
        details=body.details,
    )
    await doc.insert()
    return DataRightsRequestOut.from_doc(doc)


@router.get("/me", response_model=List[DataRightsRequestOut])
async def get_my_data_rights_requests(current_user: User = Depends(get_current_user)):
    docs = (
        await DataRightsRequest.find(DataRightsRequest.user_id == str(current_user.id))
        .sort(-DataRightsRequest.created_at)
        .to_list()
    )
    return [DataRightsRequestOut.from_doc(d) for d in docs]
