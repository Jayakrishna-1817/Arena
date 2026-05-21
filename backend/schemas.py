"""
schemas.py – Request/response Pydantic schemas (API surface, not DB docs).
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from models import RoomStatus, RoundStatus, JobStatus


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime


# ── Rooms ─────────────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    challenge_prompt: str = Field(min_length=10, max_length=1000)


class JoinRoomRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class RoomOut(BaseModel):
    id: str
    code: str
    title: str
    challenge_prompt: str
    host_id: str
    status: RoomStatus
    current_round_id: Optional[str]
    created_at: datetime
    participants: List[ParticipantOut] = []
    rounds: List[RoundOut] = []
    current_round: Optional[RoundOut] = None
    submissions: List[SubmissionOut] = []
    scores: List[ScoreOut] = []


# ── Participants ───────────────────────────────────────────────────────────────

class ParticipantOut(BaseModel):
    id: str
    room_id: str
    user_id: str
    display_name: str
    eliminated: bool
    total_score: int
    joined_at: datetime


# ── Rounds ────────────────────────────────────────────────────────────────────

class StartRoundRequest(BaseModel):
    time_limit_seconds: int = Field(default=180, ge=30, le=600)


class RoundOut(BaseModel):
    id: str
    room_id: str
    round_number: int
    status: RoundStatus
    time_limit_seconds: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime


# ── Submissions ────────────────────────────────────────────────────────────────

class SubmitPromptRequest(BaseModel):
    prompt_text: str = Field(min_length=5, max_length=500)


class SubmissionOut(BaseModel):
    id: str
    round_id: str
    room_id: str
    participant_id: str
    user_id: str
    prompt_text: str
    submitted_at: datetime
    job: Optional[JobOut] = None


# ── Generation Jobs ────────────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: str
    submission_id: str
    status: JobStatus
    output: Optional[str]
    error_message: Optional[str]
    retry_count: int
    queued_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


# ── Scores ────────────────────────────────────────────────────────────────────

class ScoreSubmissionRequest(BaseModel):
    participant_id: str
    points: int = Field(ge=0, le=100)
    eliminated: bool = False
    host_note: Optional[str] = Field(default=None, max_length=300)


class ScoreOut(BaseModel):
    id: str
    room_id: str
    round_id: str
    submission_id: str
    participant_id: str
    points: int
    rank: Optional[int]
    eliminated: bool
    host_note: Optional[str]
    scored_at: datetime


# ── WebSocket Events ───────────────────────────────────────────────────────────
# These are the canonical event names used across the WS bridge.
# Frontend subscribes per-room channel.

class WSEvent(BaseModel):
    event: str
    payload: dict

    # Event name constants
    PARTICIPANT_JOINED: str = "participant:joined"
    ROUND_STARTED: str = "round:started"
    ROUND_ENDED: str = "round:ended"
    SUBMISSION_RECEIVED: str = "submission:received"
    JOB_QUEUED: str = "job:queued"
    JOB_RUNNING: str = "job:running"
    JOB_COMPLETED: str = "job:completed"
    JOB_FAILED: str = "job:failed"
    SCORES_UPDATED: str = "scores:updated"
    PARTICIPANT_ELIMINATED: str = "participant:eliminated"
    ROOM_COMPLETED: str = "room:completed"
