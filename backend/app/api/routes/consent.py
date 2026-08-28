from fastapi import APIRouter, Depends, Request
from datetime import datetime, timezone
from typing import List

from app.models.user import User
from app.models.consent import ConsentRecord
from app.schemas.consent_schema import (
    ConsentSubmitRequest,
    ConsentRecordOut,
    ConsentWithdrawRequest,
)
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/consent", tags=["consent"])


@router.post("", response_model=List[ConsentRecordOut], status_code=201)
async def submit_consent(
    body: ConsentSubmitRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Records one row per purpose, every time consent is given or refused.
    We never overwrite history — a fresh POST always appends a new record,
    so `GET /consent/me` shows the full audit trail, not just latest state.
    """
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    saved = []
    for item in body.consents:
        record = ConsentRecord(
            user_id=str(current_user.id),
            purpose=item.purpose,
            granted=item.granted,
            source=body.source,
            ip_address=ip,
            user_agent=ua,
        )
        await record.insert()
        saved.append(record)
    return saved


@router.get("/me", response_model=List[ConsentRecordOut])
async def get_my_consent(current_user: User = Depends(get_current_user)):
    records = (
        await ConsentRecord.find(ConsentRecord.user_id == str(current_user.id))
        .sort(-ConsentRecord.created_at)
        .to_list()
    )
    return records


@router.post("/withdraw", response_model=ConsentRecordOut)
async def withdraw_consent(
    body: ConsentWithdrawRequest,
    current_user: User = Depends(get_current_user),
):
    """
    DPDP s.6(4): withdrawal must be as easy as giving consent.
    Logs a new `granted=False` record AND stamps the most recent
    `granted=True` record for that purpose as withdrawn.
    NOTE: this only records the withdrawal. It does NOT itself stop
    downstream processing (e.g. does not delete resume file, does not
    remove profile from recruiter search). Wiring withdrawal to actually
    halt each processing purpose is an open item — see DPDP_PROGRESS.md.
    """
    last_grant = (
        await ConsentRecord.find(
            ConsentRecord.user_id == str(current_user.id),
            ConsentRecord.purpose == body.purpose,
            ConsentRecord.granted == True,  # noqa: E712
        )
        .sort(-ConsentRecord.created_at)
        .first_or_none()
    )
    if last_grant and not last_grant.withdrawn_at:
        last_grant.withdrawn_at = datetime.now(timezone.utc)
        await last_grant.save()

    record = ConsentRecord(
        user_id=str(current_user.id),
        purpose=body.purpose,
        granted=False,
        source="withdrawal",
    )
    await record.insert()
    return record
