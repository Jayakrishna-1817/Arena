"""
routers/ws.py – WebSocket endpoint for real-time room events.

Clients connect to /ws/{room_id}?token=<jwt>
On connect they receive the current room snapshot.
All subsequent events are broadcast by the API routers and job worker.
"""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException

from auth import get_current_user
from database import get_db
from ws_manager import manager
from jose import JWTError, jwt
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str) -> dict | None:
    """Validate JWT and return user doc, or None on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        db = get_db()
        return await db.users.find_one({"id": user_id})
    except JWTError:
        return None


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    db = get_db()
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    await manager.connect(room_id, websocket)

    try:
        # Send initial state snapshot to the newly connected client
        participants_cursor = db.participants.find({"room_id": room_id})
        participants = await participants_cursor.to_list()

        rounds_cursor = db.rounds.find({"room_id": room_id}).sort("round_number", 1)
        rounds = await rounds_cursor.to_list()

        current_round = None
        submissions_with_jobs = []
        if room.get("current_round_id"):
            current_round = await db.rounds.find_one({"id": room["current_round_id"]})
            if current_round:
                subs_cursor = db.submissions.find({"round_id": current_round["id"]})
                subs_docs = await subs_cursor.to_list()
                for sub in subs_docs:
                    job = await db.generation_jobs.find_one({"submission_id": sub["id"]})
                    submissions_with_jobs.append({**sub, "job": job})

        scores_cursor = db.scores.find({"room_id": room_id})
        scores = await scores_cursor.to_list()

        def _serialise(doc):
            """Convert datetime objects to ISO strings for JSON."""
            if doc is None:
                return None
            result = {}
            for k, v in doc.items():
                if k == "_id":
                    continue
                if hasattr(v, "isoformat"):
                    result[k] = v.isoformat()
                elif isinstance(v, dict):
                    result[k] = _serialise(v)
                elif isinstance(v, list):
                    result[k] = [_serialise(i) if isinstance(i, dict) else i for i in v]
                else:
                    result[k] = v
            return result

        await manager.send_personal(websocket, "room:snapshot", {
            "room": _serialise(room),
            "participants": [_serialise(p) for p in participants],
            "rounds": [_serialise(r) for r in rounds],
            "current_round": _serialise(current_round),
            "submissions": [_serialise(s) for s in submissions_with_jobs],
            "scores": [_serialise(s) for s in scores],
            "viewer_id": user["id"],
            "is_host": room["host_id"] == user["id"],
        })

        # Keep connection alive; clients may send pings
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await manager.send_personal(websocket, "pong", {})
            except Exception:
                pass

    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
        logger.info("WS disconnected  user=%s  room=%s", user["id"], room_id)
    except Exception as exc:
        logger.exception("WS error  user=%s  room=%s: %s", user["id"], room_id, exc)
        manager.disconnect(room_id, websocket)
