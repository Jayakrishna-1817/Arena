"""
models.py – Pydantic document models for MongoDB collections.

Each model has a `id` field mapped to MongoDB's `_id` (stored as string).
We use bson ObjectId as strings for simplicity with the REST API.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field
from bson import ObjectId


# ── Helpers ───────────────────────────────────────────────────────────────────

def new_id() -> str:
    return str(ObjectId())


def utcnow() -> datetime:
    return datetime.utcnow()


# ── Enums (string literals) ────────────────────────────────────────────────────

RoomStatus = Literal["lobby", "active", "completed"]
RoundStatus = Literal["pending", "active", "scoring", "completed"]
JobStatus = Literal["queued", "running", "completed", "failed", "timed_out"]


# ── Document Models ────────────────────────────────────────────────────────────

class UserDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    email: str
    display_name: str
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


class RoomDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str                        # short 6-char join code
    title: str
    challenge_prompt: str            # the creative challenge statement
    host_id: str
    status: RoomStatus = "lobby"
    current_round_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


class RoundDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    room_id: str
    round_number: int
    status: RoundStatus = "pending"
    time_limit_seconds: int = 180    # participants have 3 min to submit
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


class ParticipantDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    room_id: str
    user_id: str
    display_name: str
    eliminated: bool = False
    total_score: int = 0
    joined_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


class SubmissionDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    round_id: str
    room_id: str
    participant_id: str
    user_id: str
    prompt_text: str
    submitted_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


class GenerationJobDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    submission_id: str
    room_id: str
    status: JobStatus = "queued"
    output: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    queued_at: datetime = Field(default_factory=utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class ScoreDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    room_id: str
    round_id: str
    submission_id: str
    participant_id: str
    points: int = 0
    rank: Optional[int] = None
    eliminated: bool = False
    host_note: Optional[str] = None
    scored_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True
