import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.core.ws_manager import ws_manager
from app.core.security import decode_token
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/student/{user_id}")
async def student_ws(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(..., description="JWT access token"),
):

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if payload.get("sub") != user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await User.get(user_id)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
