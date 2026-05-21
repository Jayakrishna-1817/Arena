"""
routers/rounds.py – Round lifecycle: start, end, advance.

Only the host can start/end rounds. Backend enforces this.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_db
from models import RoundDoc
from schemas import StartRoundRequest, RoundOut
from ws_manager import manager

router = APIRouter(prefix="/api/rooms/{room_id}/rounds", tags=["rounds"])


async def _get_room_or_404(room_id: str, db):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


def _round_out(doc: dict) -> RoundOut:
    return RoundOut(
        id=doc["id"],
        room_id=doc["room_id"],
        round_number=doc["round_number"],
        status=doc["status"],
        time_limit_seconds=doc["time_limit_seconds"],
        started_at=doc.get("started_at"),
        ended_at=doc.get("ended_at"),
        created_at=doc["created_at"],
    )


@router.post("", response_model=RoundOut, status_code=201)
async def start_round(
    room_id: str,
    body: StartRoundRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await _get_room_or_404(room_id, db)

    # ── Host-only enforcement ──────────────────────────────────────
    if room["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can start a round")

    if room["status"] == "completed":
        raise HTTPException(status_code=409, detail="Room is already completed")

    # Can't start a new round while one is active
    if room.get("current_round_id"):
        active_round = await db.rounds.find_one({"id": room["current_round_id"]})
        if active_round and active_round["status"] in ("active", "scoring"):
            raise HTTPException(status_code=409, detail="A round is already in progress")

    # Determine round number
    prev_count = await db.rounds.count_documents({"room_id": room_id})
    round_doc = RoundDoc(
        room_id=room_id,
        round_number=prev_count + 1,
        status="active",
        time_limit_seconds=body.time_limit_seconds,
        started_at=datetime.utcnow(),
    )
    await db.rounds.insert_one(round_doc.model_dump())

    # Update room status + current round
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {
            "status": "active",
            "current_round_id": round_doc.id,
            "updated_at": datetime.utcnow(),
        }},
    )

    await manager.broadcast(room_id, "round:started", {
        "round": round_doc.model_dump(mode="json"),
    })

    return _round_out(round_doc.model_dump())


@router.post("/{round_id}/end", response_model=RoundOut)
async def end_round(
    room_id: str,
    round_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await _get_room_or_404(room_id, db)

    if room["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can end a round")

    round_doc = await db.rounds.find_one({"id": round_id, "room_id": room_id})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_doc["status"] not in ("active", "scoring"):
        raise HTTPException(status_code=409, detail="Round is not active")

    now = datetime.utcnow()
    await db.rounds.update_one(
        {"id": round_id},
        {"$set": {"status": "scoring", "ended_at": now}},
    )

    await manager.broadcast(room_id, "round:ended", {
        "round_id": round_id,
        "round_number": round_doc["round_number"],
    })

    updated = await db.rounds.find_one({"id": round_id})
    return _round_out(updated)


@router.get("", response_model=list[RoundOut])
async def list_rounds(room_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await _get_room_or_404(room_id, db)
    cursor = db.rounds.find({"room_id": room_id}).sort("round_number", 1)
    docs = await cursor.to_list()
    return [_round_out(r) for r in docs]


@router.get("/{round_id}", response_model=RoundOut)
async def get_round(room_id: str, round_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    round_doc = await db.rounds.find_one({"id": round_id, "room_id": room_id})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")
    return _round_out(round_doc)
