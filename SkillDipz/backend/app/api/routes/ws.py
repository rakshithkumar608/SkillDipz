import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.core.ws_manager import ws_manager
from app.core.security import decode_token
from app.core.redis_client import get_session
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/student/{user_id}")
async def student_ws(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(None, description="JWT access token (fallback if no cookie)"),
):

    authenticated = False

    # 1. Try HttpOnly cookie (most secure - no token in URl)
    session_id = websocket.cookies.get("session_id")
    if session_id:
        session = await get_session(session_id)
        if session and session.get("user_id") == user_id:
            authenticated = True

    # 2. Fallback: token query param (for non-browser client)
    if not authenticated and token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access" and payload.get("sub") == user_id:
            authenticated = True
        else:
            if not payload:
                logger.warning(f"⚠️ WebSocket Auth Failed: Token invalid or JWT_SECRET_KEY mismatch for user {user_id}")
            else:
                logger.warning(f"⚠️ WebSocket Auth Failed: Token claims mismatch for user {user_id} (token sub={payload.get('sub')}, type={payload.get('type')})")

    if not authenticated:
        logger.warning(f"❌ WebSocket Connection Rejected (403): User {user_id} is not authenticated via cookie or token.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await User.get(user_id)
    if not user:
        logger.warning(f"❌ WebSocket Connection Rejected (403): User {user_id} not found in database.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.info(f"WS connection closed for {user_id}: {e}")
    finally:
        ws_manager.disconnect(user_id)
