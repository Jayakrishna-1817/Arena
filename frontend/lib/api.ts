/**
 * lib/api.ts – Typed Axios API client with auto-auth headers.
 */
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; display_name: string; password: string }) =>
    api.post("/api/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/api/auth/login", data),
  me: () => api.get("/api/auth/me"),
};

// ── Rooms ─────────────────────────────────────────────────────────────────────
export const roomsAPI = {
  create: (data: { title: string; challenge_prompt: string }) =>
    api.post("/api/rooms", data),
  join: (code: string) => api.post("/api/rooms/join", { code }),
  leave: (roomId: string) => api.post(`/api/rooms/${roomId}/leave`),
  end: (roomId: string) => api.post(`/api/rooms/${roomId}/end`),
  delete: (roomId: string) => api.delete(`/api/rooms/${roomId}`),
  get: (roomId: string) => api.get(`/api/rooms/${roomId}`),
  getByCode: (code: string) => api.get(`/api/rooms/by-code/${code}`),
  list: () => api.get("/api/rooms"),
};

// ── Rounds ────────────────────────────────────────────────────────────────────
export const roundsAPI = {
  start: (roomId: string, timeLimitSeconds = 180) =>
    api.post(`/api/rooms/${roomId}/rounds`, { time_limit_seconds: timeLimitSeconds }),
  end: (roomId: string, roundId: string) =>
    api.post(`/api/rooms/${roomId}/rounds/${roundId}/end`),
  list: (roomId: string) => api.get(`/api/rooms/${roomId}/rounds`),
};

// ── Submissions ───────────────────────────────────────────────────────────────
export const submissionsAPI = {
  submit: (roomId: string, roundId: string, promptText: string) =>
    api.post(`/api/rooms/${roomId}/rounds/${roundId}/submissions`, {
      prompt_text: promptText,
    }),
  list: (roomId: string, roundId: string) =>
    api.get(`/api/rooms/${roomId}/rounds/${roundId}/submissions`),
};

// ── Scores ────────────────────────────────────────────────────────────────────
export const scoresAPI = {
  score: (
    roomId: string,
    roundId: string,
    data: {
      participant_id: string;
      points: number;
      eliminated: boolean;
      host_note?: string;
    }
  ) => api.post(`/api/rooms/${roomId}/rounds/${roundId}/scores`, data),
  list: (roomId: string, roundId: string) =>
    api.get(`/api/rooms/${roomId}/rounds/${roundId}/scores`),
};
