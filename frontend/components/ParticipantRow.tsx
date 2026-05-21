"use client";
import { Participant } from "@/lib/types";
import { Trophy } from "lucide-react";

interface Props {
  participant: Participant;
  isCurrentUser: boolean;
  score: number;
}

export default function ParticipantRow({ participant, isCurrentUser, score }: Props) {
  return (
    <div
      className={`flex items-center justify-between p-5 rounded-2xl transition-all duration-300 ${isCurrentUser ? "bg-violet-500/10 border border-violet-500/30" : "bg-slate-900/40 border border-slate-700/10"}`}
      style={{ opacity: participant.eliminated ? 0.5 : 1 }}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${participant.eliminated ? "bg-red-500/30" : "bg-gradient-to-r from-violet-600 to-cyan-500"}`}
        >
          {participant.display_name[0]?.toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-slate-100">
              {participant.display_name}
            </span>
            {isCurrentUser && (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-300">
                you
              </span>
            )}
          </div>
          {participant.eliminated && (
            <span className="text-xs text-red-400">eliminated</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${score > 0 ? "text-violet-300" : "text-slate-500"}`}>
          {score} pts
        </span>
        {score > 0 && <Trophy size={18} className="text-yellow-400" />}
      </div>
    </div>
  );
}
