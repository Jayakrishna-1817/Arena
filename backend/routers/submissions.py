"""
routers/submissions.py – Prompt submission and scoring.

Participants submit prompts → job is created and enqueued.
Host scores submissions after round ends.
"""
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_db
from models import SubmissionDoc, GenerationJobDoc, ScoreDoc
from schemas import SubmitPromptRequest, SubmissionOut, JobOut, ScoreSubmissionRequest, ScoreOut
from services.job_worker import enqueue_job
from ws_manager import manager

router = APIRouter(tags=["submissions"])


def _job_out(doc: dict) -> JobOut:
    return JobOut(
        id=doc["id"],
        submission_id=doc["submission_id"],
        status=doc["status"],
        output=doc.get("output"),
        error_message=doc.get("error_message"),
        retry_count=doc.get("retry_count", 0),
        queued_at=doc["queued_at"],
        started_at=doc.get("started_at"),
        completed_at=doc.get("completed_at"),
    )


async def _submission_out(doc: dict, db) -> SubmissionOut:
    job_doc = await db.generation_jobs.find_one({"submission_id": doc["id"]})
    return SubmissionOut(
        id=doc["id"],
        round_id=doc["round_id"],
        room_id=doc["room_id"],
        participant_id=doc["participant_id"],
        user_id=doc["user_id"],
        prompt_text=doc["prompt_text"],
        submitted_at=doc["submitted_at"],
        job=_job_out(job_doc) if job_doc else None,
    )


# ── Submit prompt ─────────────────────────────────────────────────────────────

@router.post("/api/rooms/{room_id}/rounds/{round_id}/submissions", response_model=SubmissionOut, status_code=201)
async def submit_prompt(
    room_id: str,
    round_id: str,
    body: SubmitPromptRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()

    # Verify room exists
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Host cannot submit
    if room["host_id"] == current_user["id"]:
        raise HTTPException(status_code=403, detail="The host cannot submit as a contestant")

    # Participant must be in the room
    participant = await db.participants.find_one({
        "room_id": room_id,
        "user_id": current_user["id"],
    })
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a participant in this room")

    # Participant must not be eliminated
    if participant["eliminated"]:
        raise HTTPException(status_code=403, detail="You have been eliminated from this room")

    # Verify round is active
    round_doc = await db.rounds.find_one({"id": round_id, "room_id": room_id})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_doc["status"] != "active":
        raise HTTPException(status_code=409, detail="Round is not accepting submissions")

    # One submission per participant per round
    existing_sub = await db.submissions.find_one({
        "round_id": round_id,
        "participant_id": participant["id"],
    })
    if existing_sub:
        raise HTTPException(status_code=409, detail="You have already submitted for this round")

    # Create submission
    submission = SubmissionDoc(
        round_id=round_id,
        room_id=room_id,
        participant_id=participant["id"],
        user_id=current_user["id"],
        prompt_text=body.prompt_text,
    )
    await db.submissions.insert_one(submission.model_dump())

    # Create generation job in queued state
    job = GenerationJobDoc(
        submission_id=submission.id,
        room_id=room_id,
        status="queued",
    )
    await db.generation_jobs.insert_one(job.model_dump())

    # Broadcast to room
    await manager.broadcast(room_id, "submission:received", {
        "submission_id": submission.id,
        "participant_id": participant["id"],
        "display_name": participant["display_name"],
    })
    await manager.broadcast(room_id, "job:queued", {
        "job_id": job.id,
        "submission_id": submission.id,
        "participant_id": participant["id"],
    })

    # Enqueue for async processing (non-blocking)
    asyncio.create_task(enqueue_job(job.id))

    return await _submission_out(submission.model_dump(), db)


# ── List submissions ──────────────────────────────────────────────────────────

@router.get("/api/rooms/{room_id}/rounds/{round_id}/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    room_id: str,
    round_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await db.rooms.find_one({"id": room_id}) or (_ for _ in ()).throw(HTTPException(404, "Room not found"))
    cursor = db.submissions.find({"round_id": round_id, "room_id": room_id})
    docs = await cursor.to_list()
    results = []
    for doc in docs:
        results.append(await _submission_out(doc, db))
    return results


# ── Score a submission ────────────────────────────────────────────────────────

@router.post("/api/rooms/{room_id}/rounds/{round_id}/scores", response_model=ScoreOut, status_code=201)
async def score_submission(
    room_id: str,
    round_id: str,
    body: ScoreSubmissionRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Only host can score
    if room["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can score submissions")

    round_doc = await db.rounds.find_one({"id": round_id, "room_id": room_id})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_doc["status"] not in ("scoring", "active"):
        raise HTTPException(status_code=409, detail="Round must be in scoring or active state")

    # Find submission for this participant in this round
    submission = await db.submissions.find_one({
        "round_id": round_id,
        "participant_id": body.participant_id,
    })
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found for this participant")

    # Upsert score
    existing_score = await db.scores.find_one({
        "round_id": round_id,
        "participant_id": body.participant_id,
    })

    score_data = {
        "room_id": room_id,
        "round_id": round_id,
        "submission_id": submission["id"],
        "participant_id": body.participant_id,
        "points": body.points,
        "eliminated": body.eliminated,
        "host_note": body.host_note,
        "scored_at": datetime.utcnow(),
    }

    if existing_score:
        await db.scores.update_one({"id": existing_score["id"]}, {"$set": score_data})
        score_id = existing_score["id"]
    else:
        score = ScoreDoc(**score_data)
        await db.scores.insert_one(score.model_dump())
        score_id = score.id

    # Update participant total score and elimination status
    all_scores_cursor = db.scores.find({"room_id": room_id, "participant_id": body.participant_id})
    all_scores_docs = await all_scores_cursor.to_list()
    scores_list = [s["points"] for s in all_scores_docs]
    total = sum(scores_list)
    await db.participants.update_one(
        {"id": body.participant_id},
        {"$set": {
            "total_score": total,
            "eliminated": body.eliminated,
        }},
    )

    # Recompute ranks for this round
    all_round_scores_cursor = db.scores.find({"round_id": round_id}).sort("points", -1)
    all_round_scores_docs = await all_round_scores_cursor.to_list()
    rank = 1
    for s in all_round_scores_docs:
        await db.scores.update_one({"id": s["id"]}, {"$set": {"rank": rank}})
        rank += 1

    # Broadcast updates
    await manager.broadcast(room_id, "scores:updated", {
        "round_id": round_id,
        "participant_id": body.participant_id,
        "points": body.points,
        "eliminated": body.eliminated,
    })

    if body.eliminated:
        await manager.broadcast(room_id, "participant:eliminated", {
            "participant_id": body.participant_id,
        })

    final_score = await db.scores.find_one({"id": score_id})
    return ScoreOut(
        id=final_score["id"],
        room_id=final_score["room_id"],
        round_id=final_score["round_id"],
        submission_id=final_score["submission_id"],
        participant_id=final_score["participant_id"],
        points=final_score["points"],
        rank=final_score.get("rank"),
        eliminated=final_score["eliminated"],
        host_note=final_score.get("host_note"),
        scored_at=final_score["scored_at"],
    )


@router.get("/api/rooms/{room_id}/rounds/{round_id}/scores", response_model=list[ScoreOut])
async def list_scores(
    room_id: str,
    round_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    cursor = db.scores.find({"round_id": round_id}).sort("rank", 1)
    docs = await cursor.to_list()
    return [
        ScoreOut(
            id=s["id"],
            room_id=s["room_id"],
            round_id=s["round_id"],
            submission_id=s["submission_id"],
            participant_id=s["participant_id"],
            points=s["points"],
            rank=s.get("rank"),
            eliminated=s["eliminated"],
            host_note=s.get("host_note"),
            scored_at=s["scored_at"],
        )
        for s in docs
    ]
