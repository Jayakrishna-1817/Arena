/**
 * store/roomStore.ts – Battle room state, updated by WS events and REST calls.
 */
import { create } from "zustand";
import {
  Room,
  Participant,
  Round,
  Submission,
  GenerationJob,
  Score,
} from "@/lib/types";

interface RoomState {
  // Core room data
  room: Room | null;
  participants: Participant[];
  rounds: Round[];
  currentRound: Round | null;
  submissions: Submission[];
  scores: Score[];
  isHost: boolean;
  viewerId: string | null;

  // UI status
  connected: boolean;
  loading: boolean;
  error: string | null;

  // Setters
  setSnapshot: (data: {
    room: Room;
    participants: Participant[];
    rounds: Round[];
    current_round: Round | null;
    submissions: Submission[];
    scores: Score[];
    is_host: boolean;
    viewer_id: string;
  }) => void;

  setConnected: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;

  // WS event handlers
  onParticipantJoined: (p: Participant) => void;
  onRoundStarted: (r: Round) => void;
  onRoundEnded: (roundId: string, roundNumber: number) => void;
  onSubmissionReceived: (payload: {
    submission_id: string;
    participant_id: string;
    display_name: string;
  }) => void;
  onJobQueued: (jobId: string, submissionId: string) => void;
  onJobRunning: (jobId: string, submissionId: string) => void;
  onJobCompleted: (jobId: string, submissionId: string, output: string) => void;
  onJobFailed: (
    jobId: string,
    submissionId: string,
    error: string,
    status: string
  ) => void;
  onScoresUpdated: (payload: {
    round_id: string;
    participant_id: string;
    points: number;
    eliminated: boolean;
  }) => void;
  onParticipantEliminated: (participantId: string) => void;
  onParticipantLeft: (participantId: string) => void;
  onRoomEnded: () => void;

  // Mutations from REST responses
  addSubmission: (submission: Submission) => void;
  updateJob: (submissionId: string, job: Partial<GenerationJob>) => void;
}

export const useRoomStore = create<RoomState>()((set, get) => ({
  room: null,
  participants: [],
  rounds: [],
  currentRound: null,
  submissions: [],
  scores: [],
  isHost: false,
  viewerId: null,
  connected: false,
  loading: false,
  error: null,

  setSnapshot: (data) =>
    set({
      room: data.room,
      participants: data.participants,
      rounds: data.rounds,
      currentRound: data.current_round,
      submissions: data.submissions,
      scores: data.scores,
      isHost: data.is_host,
      viewerId: data.viewer_id,
    }),

  setConnected: (v) => set({ connected: v }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      room: null,
      participants: [],
      rounds: [],
      currentRound: null,
      submissions: [],
      scores: [],
      isHost: false,
      viewerId: null,
      connected: false,
      loading: false,
      error: null,
    }),

  onParticipantJoined: (p) =>
    set((state) => ({
      participants: state.participants.some((x) => x.id === p.id)
        ? state.participants
        : [...state.participants, p],
    })),

  onRoundStarted: (r) =>
    set((state) => ({
      currentRound: r,
      rounds: [...state.rounds.filter((x) => x.id !== r.id), r].sort(
        (a, b) => a.round_number - b.round_number
      ),
      room: state.room ? { ...state.room, current_round_id: r.id, status: "active" } : null,
    })),

  onRoundEnded: (roundId, _roundNumber) =>
    set((state) => ({
      currentRound: state.currentRound?.id === roundId
        ? { ...state.currentRound, status: "scoring" }
        : state.currentRound,
      rounds: state.rounds.map((r) =>
        r.id === roundId ? { ...r, status: "scoring" } : r
      ),
    })),

  onSubmissionReceived: (_payload) => {
    // Optimistic: a skeleton submission will be updated by REST or job events
  },

  onJobQueued: (jobId, submissionId) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId
          ? { ...s, job: { ...(s.job || buildEmptyJob(jobId, submissionId)), status: "queued" } }
          : s
      ),
    })),

  onJobRunning: (jobId, submissionId) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId
          ? { ...s, job: { ...(s.job || buildEmptyJob(jobId, submissionId)), id: jobId, status: "running" } }
          : s
      ),
    })),

  onJobCompleted: (jobId, submissionId, output) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              job: {
                ...(s.job || buildEmptyJob(jobId, submissionId)),
                id: jobId,
                status: "completed",
                output,
              },
            }
          : s
      ),
    })),

  onJobFailed: (jobId, submissionId, error, status) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              job: {
                ...(s.job || buildEmptyJob(jobId, submissionId)),
                id: jobId,
                status: status as GenerationJob["status"],
                error_message: error,
              },
            }
          : s
      ),
    })),

  onScoresUpdated: (payload) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === payload.participant_id
          ? {
              ...p,
              eliminated: payload.eliminated || p.eliminated,
            }
          : p
      ),
    })),

  onParticipantEliminated: (participantId) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, eliminated: true } : p
      ),
    })),

  onParticipantLeft: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    })),

  onRoomEnded: () =>
    set((state) => ({
      room: state.room ? { ...state.room, status: "completed" } : null,
    })),

  addSubmission: (submission) =>
    set((state) => ({
      submissions: state.submissions.some((s) => s.id === submission.id)
        ? state.submissions
        : [...state.submissions, submission],
    })),

  updateJob: (submissionId, jobUpdate) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId && s.job
          ? { ...s, job: { ...s.job, ...jobUpdate } }
          : s
      ),
    })),
}));

function buildEmptyJob(jobId: string, submissionId: string): GenerationJob {
  return {
    id: jobId,
    submission_id: submissionId,
    status: "queued",
    output: null,
    error_message: null,
    retry_count: 0,
    queued_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  };
}
