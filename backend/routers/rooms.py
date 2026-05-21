"""
routers/rooms.py – Room creation, joining, and state retrieval.
"""
import random
import string
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_db
from models import RoomDoc, ParticipantDoc
from schemas import CreateRoomRequest, JoinRoomRequest, RoomOut, ParticipantOut, RoundOut, SubmissionOut, ScoreOut
from ws_manager import manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def _participant_out(doc: dict) -> ParticipantOut:
    return ParticipantOut(**{k: doc[k] for k in ParticipantOut.model_fields})


async def _get_room_or_404(room_id: str, db):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def _room_out(room_doc: dict, db) -> RoomOut:
    participants_cursor = db.participants.find({"room_id": room_doc["id"]})
    participants_docs = await participants_cursor.to_list()
    participants = [_participant_out(p) for p in participants_docs]
    
    rounds_cursor = db.rounds.find({"room_id": room_doc["id"]}).sort("round_number", 1)
    rounds_docs = await rounds_cursor.to_list()
    rounds = [RoundOut(
        id=r["id"],
        room_id=r["room_id"],
        round_number=r["round_number"],
        status=r["status"],
        time_limit_seconds=r["time_limit_seconds"],
        started_at=r.get("started_at"),
        ended_at=r.get("ended_at"),
        created_at=r["created_at"],
    ) for r in rounds_docs]
    
    current_round = None
    submissions = []
    if room_doc.get("current_round_id"):
        current_round_doc = await db.rounds.find_one({"id": room_doc["current_round_id"]})
        if current_round_doc:
            current_round = RoundOut(
                id=current_round_doc["id"],
                room_id=current_round_doc["room_id"],
                round_number=current_round_doc["round_number"],
                status=current_round_doc["status"],
                time_limit_seconds=current_round_doc["time_limit_seconds"],
                started_at=current_round_doc.get("started_at"),
                ended_at=current_round_doc.get("ended_at"),
                created_at=current_round_doc["created_at"],
            )
            
            subs_cursor = db.submissions.find({"round_id": current_round_doc["id"]})
            subs_docs = await subs_cursor.to_list()
            for sub in subs_docs:
                job = await db.generation_jobs.find_one({"submission_id": sub["id"]})
                submission_dict = {
                    **sub,
                    "job": job,
                }
                submissions.append(SubmissionOut(**submission_dict))
    
    scores_cursor = db.scores.find({"room_id": room_doc["id"]})
    scores_docs = await scores_cursor.to_list()
    scores = [ScoreOut(**s) for s in scores_docs]
    
    return RoomOut(
        id=room_doc["id"],
        code=room_doc["code"],
        title=room_doc["title"],
        challenge_prompt=room_doc["challenge_prompt"],
        host_id=room_doc["host_id"],
        status=room_doc["status"],
        current_round_id=room_doc.get("current_round_id"),
        created_at=room_doc["created_at"],
        participants=participants,
        rounds=rounds,
        current_round=current_round,
        submissions=submissions,
        scores=scores,
    )


@router.post("", response_model=RoomOut, status_code=201)
async def create_room(
    body: CreateRoomRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()

    # Generate a unique room code
    for _ in range(10):
        code = _generate_code()
        if not await db.rooms.find_one({"code": code}):
            break

    room = RoomDoc(
        code=code,
        title=body.title,
        challenge_prompt=body.challenge_prompt,
        host_id=current_user["id"],
    )
    await db.rooms.insert_one(room.model_dump())

    # Host is NOT added as a participant (role separation enforced here)
    return await _room_out(room.model_dump(), db)


@router.post("/join", response_model=RoomOut)
async def join_room(
    body: JoinRoomRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room_doc = await db.rooms.find_one({"code": body.code.upper()})
    if not room_doc:
        raise HTTPException(status_code=404, detail="Room not found")
    if room_doc["status"] == "completed":
        raise HTTPException(status_code=410, detail="This room has already ended")

    # Host cannot join as participant
    if room_doc["host_id"] == current_user["id"]:
        raise HTTPException(status_code=403, detail="You are the host of this room")

    # Idempotent join
    existing = await db.participants.find_one({
        "room_id": room_doc["id"],
        "user_id": current_user["id"],
    })
    if not existing:
        participant = ParticipantDoc(
            room_id=room_doc["id"],
            user_id=current_user["id"],
            display_name=current_user["display_name"],
        )
        await db.participants.insert_one(participant.model_dump())

        # Broadcast to all room members
        await manager.broadcast(room_doc["id"], "participant:joined", {
            "participant": participant.model_dump(mode="json"),
        })

    return await _room_out(room_doc, db)


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(room_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    room_doc = await db.rooms.find_one({"id": room_id})
    if not room_doc:
        raise HTTPException(status_code=404, detail="Room not found")
    return await _room_out(room_doc, db)


@router.get("/by-code/{code}", response_model=RoomOut)
async def get_room_by_code(code: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    room_doc = await db.rooms.find_one({"code": code.upper()})
    if not room_doc:
        raise HTTPException(status_code=404, detail="Room not found")
    return await _room_out(room_doc, db)


@router.post("/{room_id}/end", response_model=RoomOut)
async def end_room(
    room_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await _get_room_or_404(room_id, db)
    
    if room["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can end the room")
    
    if room["status"] == "completed":
        raise HTTPException(status_code=409, detail="Room is already completed")
    
    from datetime import datetime
    
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {
            "status": "completed",
            "updated_at": datetime.utcnow(),
        }},
    )
    
    from ws_manager import manager
    await manager.broadcast(room_id, "room:ended", {})
    
    updated_room = await db.rooms.find_one({"id": room_id})
    return await _room_out(updated_room, db)


@router.delete("/{room_id}", status_code=204)
async def delete_room(
    room_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await _get_room_or_404(room_id, db)
    
    if room["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can delete the room")
    
    await db.participants.delete_many({"room_id": room_id})
    await db.submissions.delete_many({"room_id": room_id})
    await db.scores.delete_many({"room_id": room_id})
    await db.rounds.delete_many({"room_id": room_id})
    await db.generation_jobs.delete_many({"room_id": room_id})
    await db.rooms.delete_one({"id": room_id})
    
    from ws_manager import manager
    await manager.broadcast(room_id, "room:deleted", {})
    
    return

@router.post("/{room_id}/leave", status_code=204)
async def leave_room(
    room_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await _get_room_or_404(room_id, db)
    
    if room["host_id"] == current_user["id"]:
        raise HTTPException(status_code=403, detail="Host cannot leave the room")
    
    participant = await db.participants.find_one({
        "room_id": room_id,
        "user_id": current_user["id"],
    })
    if not participant:
        raise HTTPException(status_code=404, detail="You are not a participant of this room")
    
    await db.participants.delete_one({"id": participant["id"]})
    
    from ws_manager import manager
    await manager.broadcast(room_id, "participant:left", {
        "participant_id": participant["id"],
    })
    
    return

@router.get("", response_model=list[RoomOut])
async def list_my_rooms(current_user: dict = Depends(get_current_user)):
    """Return rooms where the user is host or participant."""
    db = get_db()
    uid = current_user["id"]

    # Rooms hosted
    hosted_cursor = db.rooms.find({"host_id": uid})
    hosted_docs = await hosted_cursor.to_list()
    room_ids_as_host = [r["id"] for r in hosted_docs]

    # Rooms joined as participant
    participant_cursor = db.participants.find({"user_id": uid})
    participant_docs = await participant_cursor.to_list()
    room_ids_as_participant = [p["room_id"] for p in participant_docs]

    all_ids = list(set(room_ids_as_host + room_ids_as_participant))

    results = []
    for rid in all_ids:
        rdoc = await db.rooms.find_one({"id": rid})
        if rdoc:
            results.append(await _room_out(rdoc, db))

    return results
