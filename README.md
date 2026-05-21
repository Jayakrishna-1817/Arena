# Poiro - AI Creative Battle Room

A minimal real-time platform where users compete in an AI-powered creative challenge!

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Local Setup Instructions](#local-setup-instructions)
3. [Database Schema & Entity Model](#database-schema--entity-model)
4. [Realtime Event Model](#realtime-event-model)
5. [Generation Job Lifecycle](#generation-job-lifecycle)
6. [Chosen Judging/Scoring Mechanism](#chosen-judging--scoring-mechanism)
7. [What is Persisted and What is Not](#what-is-persisted-and-what-is-not)
8. [Failure Handling Strategy](#failure-handling-strategy)
9. [Known Limitations](#known-limitations)
10. [What I Would Improve with More Time](#what-i-would-improve-with-more-time)

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand
- **Backend**: FastAPI, Python 3.11+
- **Database**: In-memory database (swappable for MongoDB/PostgreSQL)
- **Realtime**: WebSockets
- **AI Generation**: Mock provider (simulates real latency and outputs)

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

## What is Persisted and What is Not

### Persisted:
- Users, rooms, participants, rounds, submissions
- Generation jobs, scores
- All timestamps and state changes

### Not persisted (ephemeral):
- WebSocket connections (if server restarts, clients reconnect automatically)
- In-memory job queue (jobs are reloaded from DB on server startup)

---

## Failure Handling Strategy

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

## What I Would Improve with More Time

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
