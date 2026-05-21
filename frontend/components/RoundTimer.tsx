"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  startedAt: string | null;
  timeLimitSeconds: number;
}

export default function RoundTimer({ startedAt, timeLimitSeconds }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);

  useEffect(() => {
    if (!startedAt) {
      setSecondsLeft(timeLimitSeconds);
      return;
    }

    const tick = () => {
      try {
        const startTime = new Date(startedAt).getTime();
        if (isNaN(startTime)) {
          setSecondsLeft(timeLimitSeconds);
          return;
        }
        const elapsed = (Date.now() - startTime) / 1000;
        const left = Math.max(0, timeLimitSeconds - elapsed);
        setSecondsLeft(Math.floor(left));
      } catch {
        setSecondsLeft(timeLimitSeconds);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, timeLimitSeconds]);

  const pct = (secondsLeft / timeLimitSeconds) * 100;
  const isUrgent = secondsLeft <= 30;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-6">
      <div className="flex items-center gap-2 text-xs font-semibold mb-4 uppercase tracking-widest text-slate-400">
        <Clock size={14} />
        Time Remaining
      </div>
      <div className={`text-4xl font-bold font-mono mb-4 text-center ${isUrgent ? "text-red-400" : "text-cyan-300"}`}>
        {mins}:{secs.toString().padStart(2, "0")}
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-gradient-to-r from-red-600 to-red-500" : "bg-gradient-to-r from-violet-600 to-cyan-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
