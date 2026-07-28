import json
import logging
from typing import Any, Dict
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}

    async def connect(self, student_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections[student_id] = websocket
        logger.info(f"WS connected: {student_id}")

    def disconnect(self, student_id: str):
        self._connections.pop(student_id, None)
        logger.info(f"WS disconnected: {student_id}")

    async def broadcast(self, student_id: str, event_type: str, payload: Any):
        ws = self._connections.get(student_id)
        if ws:
            try:
                await ws.send_text(json.dumps({
                    "type": event_type,
                    "payload": payload
                }))
            except Exception as e:
                logger.warning(f"WS send error for {student_id}: {e}")
                self.disconnect(student_id)

ws_manager = WebSocketManager()