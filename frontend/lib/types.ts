/**
 * lib/types.ts – Shared TypeScript types mirroring backend schemas.
 */

export type RoomStatus = "lobby" | "active" | "completed";
export type RoundStatus = "pending" | "active" | "scoring" | "completed";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  title: string;
  challenge_prompt: string;
  host_id: string;
  status: RoomStatus;
  current_round_id: string | null;
  created_at: string;
  participants: Participant[];
  rounds: Round[];
  current_round: Round | null;
  submissions: Submission[];
  scores: Score[];
}

export interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  eliminated: boolean;
  total_score: number;
  joined_at: string;
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  status: RoundStatus;
  time_limit_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface GenerationJob {
  id: string;
  submission_id: string;
  status: JobStatus;
  output: string | null;
  error_message: string | null;
  retry_count: number;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Submission {
  id: string;
  round_id: string;
  room_id: string;
  participant_id: string;
  user_id: string;
  prompt_text: string;
  submitted_at: string;
  job: GenerationJob | null;
}

export interface Score {
  id: string;
  room_id: string;
  round_id: string;
  submission_id: string;
  participant_id: string;
  points: number;
  rank: number | null;
  eliminated: boolean;
  host_note: string | null;
  scored_at: string;
}

// ── WebSocket event payloads ──────────────────────────────────────────────────

export interface WSMessage {
  event: string;
  payload: Record<string, unknown>;
}

export interface RoomSnapshot {
  room: Room;
  participants: Participant[];
  rounds: Round[];
  current_round: Round | null;
  submissions: (Submission & { job: GenerationJob | null })[];
  scores: Score[];
  viewer_id: string;
  is_host: boolean;
}
