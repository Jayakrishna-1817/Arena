"""
main.py – FastAPI application entry point.

Startup:
  1. Connect to MongoDB Atlas and create indexes.
  2. Start the background job worker coroutine.

Shutdown:
  1. Close MongoDB connection.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_indexes, close_db
from services.job_worker import worker_loop
from routers import auth, rooms, rounds, submissions, ws

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────
    logger.info("Connecting to MongoDB and creating indexes...")
    await create_indexes()
    logger.info("MongoDB ready.")

    # Start the background job worker
    worker_task = asyncio.create_task(worker_loop())
    logger.info("Job worker started.")

    yield

    # ── Shutdown ──────────────────────────────────────────────────
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    await close_db()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="AI Battle Room API",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {type(exc).__name__}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"}
    )

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(rounds.router)
app.include_router(submissions.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
