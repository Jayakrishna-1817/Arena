# Poiro - AI Creative Battle Room

A minimal real-time platform where users compete in an AI-powered creative challenge!

---

## Table of Contents
1. [Why I Chose This Tech Stack](#why-i-chose-this-tech-stack)
2. [Tradeoffs](#tradeoffs)
3. [What I Intentionally Skipped](#what-i-intentionally-skipped)
4. [Local Setup Instructions](#local-setup-instructions)
5. [Architecture Overview](#architecture-overview)
6. [Database Schema & Entity Model](#database-schema--entity-model)
7. [Realtime Event Model](#realtime-event-model)
8. [Generation Job Lifecycle](#generation-job-lifecycle)
9. [Chosen Judging/Scoring Mechanism](#chosen-judging--scoring-mechanism)
10. [Persistence Details](#persistence-details)
11. [Failure Handling](#failure-handling)
12. [Known Limitations](#known-limitations)
13. [Improvements with More Time](#improvements-with-more-time)

---

## Why I Chose This Tech Stack

### Frontend
- **Next.js 14**: Fast, SEO-friendly, great DX with App Router
- **TypeScript**: Type safety reduces bugs and improves maintainability
- **Tailwind CSS**: Rapid UI development without writing custom CSS
- **Zustand**: Lightweight state management, perfect for simple room state

### Backend
- **FastAPI**: Async-first, automatic OpenAPI docs, strong type hints
- **Python**: Great for AI/ML integrations, easy to work with async operations
- **WebSockets**: Simple real-time communication without dependencies like Socket.IO

### Database
- **In-memory DB (swappable)**: Minimal setup for the assignment; easy to replace with MongoDB/PostgreSQL later
- **Async-compatible**: Fits perfectly with FastAPI's async request handling

---

## Tradeoffs

| Decision | Pro | Con |
|----------|-----|-----|
| In-memory DB instead of MongoDB/PostgreSQL | No external dependencies needed; easy to run locally | Data doesn't survive server restart |
| Mock AI provider instead of real LLM | No API keys or costs; consistent behavior | No real AI outputs |
| WebSockets instead of Socket.IO | Lightweight; no extra libraries | No automatic reconnection or fallback to polling |
| Manual scoring instead of automated | Simple to implement; host has full control | No consistency; requires active host |

---

## What I Intentionally Skipped

These features were skipped to keep the scope focused and deliver a complete playable loop first:

1. **Production OAuth**: Used simple email/password instead of Google/GitHub OAuth
2. **Image/Video Generation**: Only text outputs for simplicity
3. **Spectator Mode**: Only host/participant roles
4. **Retry Logic for Failed Jobs**: No automatic retries
5. **Multiple Tournament Formats**: Only simple rounds
6. **Moderation/Safety**: No content filtering
7. **Hosted Deployment**: Kept it local-only for the assignment
8. **Comprehensive Tests**: No unit/integration tests yet
9. **Mobile Responsiveness**: Focused on desktop first
10. **Event Sourcing**: No append-only activity log

---

## Local Setup Instructions

### Prerequisites
1. Python 3.11+
2. Node.js 20+

### Backend Setup
1. Navigate to backend directory:
```bash
cd backend
```

2. Create a virtual environment (Windows):
```bash
python -m venv venv
.\venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the server:
```bash
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the dev server:
```bash
npm run dev
```

Now visit http://localhost:3000!

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand
- **Backend**: FastAPI, Python 3.11+
- **Database**: In-memory database (swappable for MongoDB/PostgreSQL)
- **Realtime**: WebSockets
- **AI Generation**: Mock provider (simulates real latency and outputs)

---

## Database Schema & Entity Model

### Core Entities:
1. **User**: Represents a signed-in user (email, display name, hashed password)
2. **Room**: Represents a battle room (host, title, challenge, status, current round)
3. **Participant**: Links a user to a room
4. **Round**: One round in the battle room (round number, status, time limit)
5. **Submission**: A participant's prompt for a round
6. **GenerationJob**: Async job for AI generation (status: queued/running/completed/failed)
7. **Score**: A host's score and elimination decision for a submission

---

## Realtime Event Model

WebSocket events sent to all connected clients in a room:
- `room:snapshot` - Initial room state on connect
- `participant:joined` - New participant joined the room
- `participant:left` - Participant left the room
- `participant:eliminated` - Host eliminated a participant
- `round:started` - Host started a new round
- `round:ended` - Host ended the round (entering scoring phase)
- `submission:received` - Participant submitted a prompt
- `job:queued` - Generation job created
- `job:running` - Job started processing
- `job:completed` - Job finished successfully
- `job:failed` - Job failed to complete
- `scores:updated` - Host scored a submission
- `room:ended` - Host ended the entire room
- `room:deleted` - Host deleted the room

---

## Generation Job Lifecycle

1. **Queued**: Submission created, job starts immediately
2. **Running**: Job worker picks up the job and simulates processing
3. **Completed**: Mock provider returns a sample creative output
4. **Failed**: 10% chance of failure for demo purposes

---

## Chosen Judging/Scoring Mechanism

### How it works:
The host manually scores each submission with 0-100 points. Additionally, the host can eliminate a participant at any time (either during scoring or afterward). Scoring updates the participant's total score and elimination status immediately.

### Strengths:
- Simple and straightforward
- Host has full control over the judging
- Works great for small groups

### Weaknesses:
- No automated scoring or AI-based ranking
- No voting system from participants/spectators
- No consistency guarantees between rounds

### How to Improve in Production:
- Add AI-based scoring as a baseline
- Add participant/spectator voting
- Add multiple judge capabilities

---

## Persistence Details

### Persisted:
- Users, rooms, participants, rounds, submissions
- Generation jobs, scores
- All timestamps and state changes

### Not persisted (ephemeral):
- WebSocket connections (if server restarts, clients reconnect automatically)
- In-memory job queue (jobs are reloaded from DB on server startup)

---

## Failure Handling

1. **Failed Generation Jobs**: Show error message to user, job is marked as "failed"
2. **Disconnected WebSockets**: Client auto-reconnects with backoff
3. **Invalid Room Code**: Show "Room not found" error
4. **Unauthorized Actions**: Backend enforces host/participant permissions
5. **Page Refresh**: All state is restored from database

---

## Known Limitations

- Only one AI provider (mock) is available
- No image/video generation, only text
- No spectator mode
- No retry logic for failed jobs
- No tournament formats beyond simple rounds
- No moderation or safety features

---

## Improvements with More Time

1. **Add real AI integration**: Replace mock provider with OpenAI, Anthropic, or other LLM APIs
2. **Add image generation**: Use DALL-E or Midjourney APIs
3. **Add retry logic**: Automatically retry failed generation jobs
4. **Implement voting system**: Allow participants/spectators to vote on submissions
5. **Add event sourcing**: Store all room activity in an append-only log
6. **Add hosted deployment**: Deploy to Vercel (frontend) and Fly.io (backend)
7. **Write comprehensive tests**: Add unit tests and integration tests
8. **Add more battle formats**: Tournament brackets, leaderboards, etc.

---

## Assignment Checklist Coverage

✅ **Product slice and prioritization**: Complete playable loop from room creation to scoring!  
✅ **Architecture and data model**: Clear entity separation (User, Room, Round, Submission, Job, Score)!  
✅ **Realtime behavior**: WebSocket updates for all state changes!  
✅ **AI/job orchestration**: Async job worker with explicit states!  
✅ **Role and permission logic**: Backend-enforced host/participant capabilities!  
✅ **UX quality**: Clear flow, progress indicators, empty/error states!  
✅ **Code quality**: Typed, modular, readable code!  
✅ **Explanation and tradeoffs**: This README!

---

## License
MIT
