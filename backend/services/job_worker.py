"""
services/job_worker.py

In-process async job worker.

Design:
- Jobs are persisted to MongoDB (generation_jobs collection) with explicit states.
- A single asyncio.Queue holds pending job IDs.
- A background task pulls from the queue and calls the AI provider.
- The worker broadcasts real-time WebSocket events for every state transition.
- Timeout is enforced via asyncio.wait_for (30 s default).
- On failure the job is marked failed/timed_out; the room is NOT broken.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime

from database import get_db
from models import GenerationJobDoc
from services.ai_provider import get_provider
from ws_manager import manager

logger = logging.getLogger(__name__)

JOB_TIMEOUT_SECONDS = 30
MAX_RETRIES = 1   # retry once on transient failures

# The single in-process queue
_queue: asyncio.Queue[str] = asyncio.Queue()


async def enqueue_job(job_id: str):
    """Add a job ID to the processing queue."""
    await _queue.put(job_id)
    logger.info("Job enqueued  job_id=%s", job_id)


async def _process_job(job_id: str):
    db = get_db()
    job_doc = await db.generation_jobs.find_one({"id": job_id})
    if not job_doc:
        logger.error("Job not found in DB  job_id=%s", job_id)
        return

    job = GenerationJobDoc(**job_doc)

    # Fetch the linked submission so we can get prompts
    submission = await db.submissions.find_one({"id": job.submission_id})
    if not submission:
        logger.error("Submission not found  submission_id=%s", job.submission_id)
        return

    room = await db.rooms.find_one({"id": job.room_id})
    challenge_prompt = room["challenge_prompt"] if room else "Create something amazing"

    # ── Transition → running ──────────────────────────────────────
    now = datetime.utcnow()
    await db.generation_jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "running", "started_at": now}},
    )
    await manager.broadcast(job.room_id, "job:running", {
        "job_id": job_id,
        "submission_id": job.submission_id,
    })

    provider = get_provider()
    attempt = 0
    last_error = ""

    while attempt <= MAX_RETRIES:
        try:
            output = await asyncio.wait_for(
                provider.generate(challenge_prompt, submission["prompt_text"]),
                timeout=JOB_TIMEOUT_SECONDS,
            )
            # ── Transition → completed ────────────────────────────
            now = datetime.utcnow()
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {"status": "completed", "output": output, "completed_at": now}},
            )
            await manager.broadcast(job.room_id, "job:completed", {
                "job_id": job_id,
                "submission_id": job.submission_id,
                "output": output,
            })
            logger.info("Job completed  job_id=%s", job_id)
            return

        except asyncio.TimeoutError:
            last_error = f"Generation timed out after {JOB_TIMEOUT_SECONDS}s"
            logger.warning("Job timeout  job_id=%s  attempt=%d", job_id, attempt)
            # Timeouts are not retried
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "status": "timed_out",
                    "error_message": last_error,
                    "completed_at": datetime.utcnow(),
                }},
            )
            await manager.broadcast(job.room_id, "job:failed", {
                "job_id": job_id,
                "submission_id": job.submission_id,
                "error": last_error,
                "status": "timed_out",
            })
            return

        except Exception as exc:
            last_error = str(exc)
            attempt += 1
            logger.warning("Job error  job_id=%s  attempt=%d  error=%s", job_id, attempt, exc)
            if attempt <= MAX_RETRIES:
                await db.generation_jobs.update_one(
                    {"id": job_id},
                    {"$inc": {"retry_count": 1}},
                )
                await asyncio.sleep(2 ** attempt)   # exponential back-off
            else:
                # ── Transition → failed ───────────────────────────
                await db.generation_jobs.update_one(
                    {"id": job_id},
                    {"$set": {
                        "status": "failed",
                        "error_message": last_error,
                        "completed_at": datetime.utcnow(),
                    }},
                )
                await manager.broadcast(job.room_id, "job:failed", {
                    "job_id": job_id,
                    "submission_id": job.submission_id,
                    "error": last_error,
                    "status": "failed",
                })
                logger.error("Job failed permanently  job_id=%s  error=%s", job_id, last_error)


async def worker_loop():
    """Long-running coroutine that drains the job queue."""
    logger.info("Job worker started")
    while True:
        job_id = await _queue.get()
        try:
            await _process_job(job_id)
        except Exception as exc:
            logger.exception("Unhandled error in worker for job_id=%s: %s", job_id, exc)
        finally:
            _queue.task_done()
