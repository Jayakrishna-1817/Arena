"use client";
import { useState } from "react";
import { Participant, Submission, Score } from "@/lib/types";
import { scoresAPI } from "@/lib/api";
import { X, Zap } from "lucide-react";

interface Props {
  roomId: string;
  roundId: string;
  participant: Participant;
  submission: Submission;
  existingScore?: Score;
  onClose: () => void;
  onScored: (score: Score) => void;
}

export default function ScoreModal({
  roomId,
  roundId,
  participant,
  submission,
  existingScore,
  onClose,
  onScored,
}: Props) {
  const [points, setPoints] = useState(existingScore?.points || 0);
  const [eliminated, setEliminated] = useState(existingScore?.eliminated || false);
  const [hostNote, setHostNote] = useState(existingScore?.host_note || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await scoresAPI.score(roomId, roundId, {
        participant_id: participant.id,
        points,
        eliminated,
        host_note: hostNote,
      });
      onScored(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to submit score";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
      <div className="bg-slate-900/95 border border-slate-700/30 w-full max-w-lg rounded-2xl p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-semibold mb-2 text-slate-100">
          Score Submission
        </h2>
        <p className="text-sm mb-8 text-slate-400">
          Participant: <span className="font-semibold text-slate-100">{participant.display_name}</span>
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Points (0-100)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              required
              className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl px-4 py-3.5 text-xl font-bold text-slate-100 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80 transition-all"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Host Note (Optional)
            </label>
            <textarea
              className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-100 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80 transition-all min-h-[90px] resize-none"
              placeholder="Provide constructive feedback..."
              value={hostNote}
              onChange={(e) => setHostNote(e.target.value)}
              maxLength={300}
            />
          </div>

          <label className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-900/50 border border-slate-700/20 cursor-pointer hover:bg-slate-900/80 transition-all">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/30"
              checked={eliminated}
              onChange={(e) => setEliminated(e.target.checked)}
            />
            <span className="text-sm font-medium text-red-400">
              Eliminate participant from the room
            </span>
          </label>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <Zap size={16} fill="white" />
              {loading ? "Saving..." : existingScore ? "Update Score" : "Submit Score"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
