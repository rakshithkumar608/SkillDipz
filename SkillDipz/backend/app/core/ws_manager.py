import json
import logging
from typing import Any, Dict
from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}

    async def connect(self, student_id: str, websocket: WebSocket):
        try:
            if websocket.client_state != WebSocketState.CONNECTED:
                await websocket.accept()
            self._connections[student_id] = websocket
            logger.info(f"WS connected: {student_id}")
        except Exception as e:
            logger.warning(f"Error connecting WS for {student_id}: {e}")

    def disconnect(self, student_id: str):
        self._connections.pop(student_id, None)
        logger.info(f"WS disconnected: {student_id}")

    async def broadcast(self, student_id: str, event_type: str, payload: Any):
        ws = self._connections.get(student_id)
        if ws:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(json.dumps({
                        "type": event_type,
                        "payload": payload
                    }))
            except Exception as e:
                logger.warning(f"WS send error for {student_id}: {e}")
                self.disconnect(student_id)

    async def broadcast_all(self, event_type: str, payload: Any, exclude_user_id: str | None = None):
        """Push an event to every currently connected WebSocket client."""
        message = json.dumps({"type": event_type, "payload": payload})
        disconnected = []
        for uid, ws in list(self._connections.items()):
            if uid == exclude_user_id:
                continue
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(message)
            except Exception as e:
                logger.warning(f"WS broadcast_all error for {uid}: {e}")
                disconnected.append(uid)
        for uid in disconnected:
            self.disconnect(uid)

ws_manager = WebSocketManager()