"""
ws_manager.py – In-memory WebSocket connection manager.

Rooms are pub/sub channels. All connected clients in a room receive
broadcast messages. The manager is a singleton used across routers.
"""
from __future__ import annotations
import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # room_id -> set of active WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, room_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[room_id].add(ws)
        logger.info("WS connect  room=%s  total=%d", room_id, len(self._connections[room_id]))

    def disconnect(self, room_id: str, ws: WebSocket):
        self._connections[room_id].discard(ws)
        if not self._connections[room_id]:
            del self._connections[room_id]
        logger.info("WS disconnect room=%s", room_id)

    async def broadcast(self, room_id: str, event: str, payload: dict):
        """Broadcast a named event to every client in the room."""
        message = json.dumps({"event": event, "payload": payload})
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(room_id, [])):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room_id, ws)

    async def send_personal(self, ws: WebSocket, event: str, payload: dict):
        """Send a message to a single connection."""
        try:
            await ws.send_text(json.dumps({"event": event, "payload": payload}))
        except Exception:
            pass

    def room_count(self, room_id: str) -> int:
        return len(self._connections.get(room_id, []))


# Singleton used across the entire app
manager = ConnectionManager()
