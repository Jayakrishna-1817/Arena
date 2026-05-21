"use client";
import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore, isAuthenticated } from "@/store/authStore";
import { useRoomStore } from "@/store/roomStore";
import { useRoomWebSocket } from "@/lib/ws";
import { roomsAPI, roundsAPI, submissionsAPI, scoresAPI } from "@/lib/api";
import {
  Participant,
  Round,
  Submission,
  Score,
  RoomSnapshot,
} from "@/lib/types";
import JobCard from "@/components/JobCard";
import ParticipantRow from "@/components/ParticipantRow";
import ScoreModal from "@/components/ScoreModal";
import { Zap, ArrowLeft, Copy, Check, Users, Play, Square, Gauge } from "lucide-react";

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const {
    room, participants, currentRound, submissions, scores,
    isHost, viewerId, connected,
    setSnapshot, setConnected, setLoading, setError, reset,
    onParticipantJoined, onParticipantLeft, onRoomEnded, onRoundStarted, onRoundEnded,
    onJobQueued, onJobRunning, onJobCompleted, onJobFailed,
    onScoresUpdated, onParticipantEliminated,
    addSubmission,
  } = useRoomStore();

  const [promptText, setPromptText] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [scoreTarget, setScoreTarget] = useState<{ participant: Participant; submission: Submission; existingScore?: Score } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(180);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [endRoomLoading, setEndRoomLoading] = useState(false);

  const handleEndRoom = async () => {
    if (!roomId) return;
    setEndRoomLoading(true);
    try {
      await roomsAPI.end(roomId);
      onRoomEnded();
      router.push("/dashboard");
    } finally {
      setEndRoomLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!roomId) return;
    setLeaveLoading(true);
    try {
      await roomsAPI.leave(roomId);
      router.push("/dashboard");
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); }
    return () => reset();
  }, [token, router]);

  const wsHandlers = useCallback(() => ({
    "room:snapshot": (payload: Record<string, unknown>) => {
      setSnapshot(payload as unknown as RoomSnapshot);
      setConnected(true);
    },
    "participant:joined": (payload: Record<string, unknown>) => {
      onParticipantJoined(payload.participant as Participant);
    },
    "round:started": (payload: Record<string, unknown>) => {
      onRoundStarted(payload.round as Round);
    },
    "round:ended": (payload: Record<string, unknown>) => {
      onRoundEnded(payload.round_id as string, payload.round_number as number);
    },
    "submission:received": () => {},
    "job:queued": (payload: Record<string, unknown>) => {
      onJobQueued(payload.job_id as string, payload.submission_id as string);
    },
    "job:running": (payload: Record<string, unknown>) => {
      onJobRunning(payload.job_id as string, payload.submission_id as string);
    },
    "job:completed": (payload: Record<string, unknown>) => {
      onJobCompleted(
        payload.job_id as string,
        payload.submission_id as string,
        payload.output as string
      );
    },
    "job:failed": (payload: Record<string, unknown>) => {
      onJobFailed(
        payload.job_id as string,
        payload.submission_id as string,
        payload.error as string,
        payload.status as string
      );
    },
    "scores:updated": (payload: Record<string, unknown>) => {
      onScoresUpdated(payload as { round_id: string; participant_id: string; points: number; eliminated: boolean });
    },
    "participant:eliminated": (payload: Record<string, unknown>) => {
      onParticipantEliminated(payload.participant_id as string);
    },
    "participant:left": (payload: Record<string, unknown>) => {
      onParticipantLeft(payload.participant_id as string);
    },
    "room:ended": () => {
      onRoomEnded();
      router.push("/dashboard");
    },
    "pong": () => {},
  }), []);

  useRoomWebSocket(roomId, wsHandlers(), () => setConnected(true));

  useEffect(() => {
    if (!roomId) return;
    const timer = setTimeout(async () => {
      if (!room) {
        try {
          setLoading(true);
          const res = await roomsAPI.get(roomId);
          setSnapshot({
            room: res.data,
            participants: res.data.participants,
            rounds: res.data.rounds,
            current_round: res.data.current_round,
            submissions: res.data.submissions,
            scores: res.data.scores,
            is_host: res.data.host_id === user?.id,
            viewer_id: user?.id || "",
          });
        } catch {
          setError("Failed to load room");
        } finally {
          setLoading(false);
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [roomId, room]);

  const handleStartRound = async () => {
    if (!roomId) return;
    setStartLoading(true);
    try {
      const res = await roundsAPI.start(roomId, timeLimitSeconds);
      onRoundStarted(res.data);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to start round");
    } finally {
      setStartLoading(false);
    }
  };

  const handleEndRound = async () => {
    if (!roomId || !currentRound) return;
    setEndLoading(true);
    try {
      await roundsAPI.end(roomId, currentRound.id);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to end round");
    } finally {
      setEndLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !currentRound) return;
    setSubmitError("");
    setSubmitLoading(true);
    try {
      const res = await submissionsAPI.submit(roomId, currentRound.id, promptText);
      addSubmission(res.data);
      setSubmitSuccess(true);
      setPromptText("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Submission failed";
      setSubmitError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const myParticipant = participants.find((p) => p.user_id === viewerId);
  const hasSubmitted = submissions.some(
    (s) => s.participant_id === myParticipant?.id && s.round_id === currentRound?.id
  );

  const roundSubmissions = submissions.filter(
    (s) => s.round_id === currentRound?.id
  );

  const getParticipantForSub = (sub: Submission) =>
    participants.find((p) => p.id === sub.participant_id);

  const getScoreForSub = (sub: Submission) =>
    scores.find((s) => s.submission_id === sub.id && s.round_id === currentRound?.id);

  if (!room) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="relative z-10 text-center">
          <div className="h-7 w-56 mx-auto mb-5 rounded-xl bg-slate-800 animate-pulse" />
          <div className="h-4 w-80 mx-auto rounded-xl bg-slate-800 animate-pulse" />
        </div>
      </main>
    );
  }

  const canStart = isHost && room.status !== "completed" &&
    (!currentRound || currentRound.status === "scoring" || !["active"].includes(currentRound.status));
  const canEnd = isHost && currentRound?.status === "active";
  const canSubmit = !isHost && currentRound?.status === "active" && !hasSubmitted &&
    !myParticipant?.eliminated;

  const getStatusBadge = (status: string) => {
    const colors = {
      lobby: "bg-slate-800/80 text-slate-400 border-slate-700/30",
      active: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
      scoring: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
      completed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    };
    return colors[status as keyof typeof colors] || colors.lobby;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-violet-900/20 to-transparent" />

      <nav className="sticky top-0 z-50 border-b border-slate-800/30 px-8 py-5 flex items-center justify-between bg-slate-950/95 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => router.push("/dashboard")} 
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-violet-300 transition-colors"
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <span className="text-lg font-semibold text-slate-100">
            {room.title}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(room.status)}`}>
            {room.status}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-400 shadow-lg shadow-green-400/30" : "bg-red-400"}`} />
            <span className="text-xs font-medium text-slate-400">
              {connected ? "Live" : "Connecting..."}
            </span>
          </div>
          <button 
            onClick={handleCopyCode}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-violet-500/15 border border-violet-500/35 text-violet-300 hover:bg-violet-500/20 transition-all hover:-translate-y-0.5"
          >
            {copySuccess ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {room.code}
          </button>
          {!isHost && (
            <button 
              onClick={handleLeave}
              disabled={leaveLoading}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-red-500/15 border border-red-500/35 text-red-400 hover:bg-red-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {leaveLoading ? "Leaving..." : "Leave"}
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 relative z-10">

        <aside className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-6">
            <div className="text-xs font-semibold mb-4 uppercase tracking-widest text-slate-400">
              The Challenge
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {room.challenge_prompt}
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs font-semibold mb-4 uppercase tracking-widest text-slate-400">
              <Users size={14} />
              Participants ({participants.length})
            </div>
            <div className="space-y-3">
              {participants.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Waiting for players...
                </p>
              ) : (
                participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  isCurrentUser={p.user_id === viewerId}
                  score={scores
                    .filter((s) => s.participant_id === p.id)
                    .reduce((acc, s) => acc + s.points, 0)}
                />
              )))}
            </div>
          </div>

          {isHost && (
            <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-xs font-semibold mb-5 uppercase tracking-widest text-slate-400">
                <Gauge size={14} />
                Host Controls
              </div>

              {canStart && !currentRound && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-2 text-slate-400">
                      Time limit: {timeLimitSeconds}s
                    </label>
                    <input 
                      type="range" 
                      min={30} 
                      max={600} 
                      step={30}
                      value={timeLimitSeconds}
                      onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
                      className="w-full accent-violet-500" 
                    />
                  </div>
                  <button 
                    onClick={handleStartRound} 
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
                    disabled={startLoading}
                  >
                    <Play size={16} fill="white" />
                    {startLoading ? "Starting..." : "Start Round"}
                  </button>
                </div>
              )}

              {canStart && currentRound?.status === "scoring" && (
                <button 
                  onClick={handleStartRound} 
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
                  disabled={startLoading}
                >
                  <Play size={16} fill="white" />
                  {startLoading ? "Starting..." : "Next Round"}
                </button>
              )}

              {canEnd && (
                <button 
                  onClick={handleEndRound} 
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/30 transition-all duration-300"
                  disabled={endLoading}
                >
                  <Square size={16} fill="white" />
                  {endLoading ? "Ending..." : "End Round & Score"}
                </button>
              )}

              {currentRound?.status === "scoring" && (
                <div className="space-y-3">
                  <div className="text-sm text-center py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300">
                    Scoring phase — click submissions to score
                  </div>
                  {(() => {
                    const activeParticipants = participants.filter(p => !p.eliminated);
                    if (activeParticipants.length <= 1) {
                      return (
                        <div className="text-sm text-center py-3 rounded-xl bg-slate-800/50 border border-slate-700/30 text-slate-400">
                          Only one participant left — room is complete!
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
              {isHost && room.status !== "completed" && (
                <button 
                  onClick={() => {
                    if (confirm("Are you sure you want to end this room?")) {
                      handleEndRoom();
                    }
                  }}
                  disabled={endRoomLoading}
                  className="w-full mt-3 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-300 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {endRoomLoading ? "Ending..." : "End Room"}
                </button>
              )}
            </div>
          )}


        </aside>

        <main className="space-y-6">
          {currentRound && (
            <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold mb-2 uppercase tracking-widest text-slate-400">
                  Round {currentRound.round_number}
                </div>
                <div className="text-lg font-semibold text-slate-100">
                  {currentRound.status === "active" && "Battle in Progress"}
                  {currentRound.status === "scoring" && "Judging Phase"}
                  {currentRound.status === "completed" && "Round Complete"}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(currentRound.status)}`}>
                {currentRound.status}
              </span>
            </div>
          )}

          {!isHost && currentRound?.status === "active" && (
            <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-7">
              <div className="text-xs font-semibold mb-5 uppercase tracking-widest text-slate-400">
                Your Submission
              </div>

              {myParticipant?.eliminated ? (
                <div className="p-6 rounded-xl text-center bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">You have been eliminated</p>
                </div>
              ) : hasSubmitted ? (
                <div className="p-6 rounded-xl text-center bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-400">Submission received! The AI is generating your campaign...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <div className="p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-400">
                      {submitError}
                    </div>
                  )}
                  <textarea
                    className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-100 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80 transition-all min-h-[120px] resize-none"
                    placeholder="Describe your creative direction for this challenge..."
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    minLength={5}
                    maxLength={500}
                    required
                    rows={4}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {promptText.length}/500
                    </span>
                    <button 
                      type="submit" 
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
                      disabled={submitLoading}
                    >
                      <Zap size={16} fill="white" />
                      {submitLoading ? "Submitting..." : "Submit Prompt"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {!currentRound && room.status === "lobby" && (
            <div className="text-center py-20 bg-slate-900/60 border border-slate-700/20 rounded-2xl">
              <Users size={56} className="text-slate-500 mx-auto mb-6" />
              <h3 className="text-lg font-semibold mb-2 text-slate-100">
                Waiting for the host to start
              </h3>
              <p className="text-sm max-w-lg mx-auto text-slate-400">
                Share the room code{" "}
                <span className="font-mono font-semibold text-violet-300">{room.code}</span>{" "}
                with friends and wait for the battle to begin
              </p>
            </div>
          )}

          {roundSubmissions.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-5 uppercase tracking-widest text-slate-400">
                Submissions ({roundSubmissions.length})
              </div>
              <div className="space-y-5">
                {roundSubmissions.map((sub) => {
                  const participant = getParticipantForSub(sub);
                  const score = getScoreForSub(sub);
                  const canScore = isHost && currentRound?.status === "scoring";

                  return (
                    <JobCard
                      key={sub.id}
                      submission={sub}
                      participant={participant}
                      score={score}
                      canScore={canScore}
                      onScore={() => {
                        if (participant) {
                          setScoreTarget({ participant, submission: sub, existingScore: score });
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {scoreTarget && (
        <ScoreModal
          roomId={roomId}
          roundId={currentRound?.id || ""}
          participant={scoreTarget.participant}
          submission={scoreTarget.submission}
          existingScore={scoreTarget.existingScore}
          onClose={() => setScoreTarget(null)}
          onScored={(score) => {
            onScoresUpdated({
              round_id: score.round_id,
              participant_id: score.participant_id,
              points: score.points,
              eliminated: score.eliminated,
            });
            setScoreTarget(null);
          }}
        />
      )}
    </main>
  );
}
