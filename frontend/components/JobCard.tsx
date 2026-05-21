"use client";
import { Submission, Participant, Score, GenerationJob } from "@/lib/types";
import { Zap, Clock, CheckCircle, XCircle, PlayCircle, Sparkles } from "lucide-react";

interface Props {
  submission: Submission;
  participant?: Participant;
  score?: Score;
  canScore: boolean;
  onScore: () => void;
}

function JobStatusBadge({ job }: { job: GenerationJob | null }) {
  if (!job) return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/30">No job</span>;

  const icons = {
    queued: <Clock size={12} />,
    running: <PlayCircle size={12} />,
    completed: <CheckCircle size={12} />,
    failed: <XCircle size={12} />,
    timed_out: <XCircle size={12} />,
  };

  const colors = {
    queued: "bg-slate-800/80 text-slate-400 border-slate-700/30",
    running: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    completed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    timed_out: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border ${colors[job.status as keyof typeof colors]}`}>
      {icons[job.status as keyof typeof icons]} {job.status}
    </span>
  );
}

function JobOutput({ job }: { job: GenerationJob | null }) {
  if (!job) return null;

  if (job.status === "queued") {
    return (
      <div className="mt-5 p-5 rounded-xl space-y-3 bg-slate-900/40 border border-slate-700/20">
        <div className="h-4 w-3/4 rounded-lg bg-slate-800 animate-pulse" />
        <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse" />
        <div className="h-4 w-2/3 rounded-lg bg-slate-800 animate-pulse" />
        <p className="text-xs mt-3 text-slate-500">
          Waiting in queue...
        </p>
      </div>
    );
  }

  if (job.status === "running") {
    return (
      <div className="mt-5 p-5 rounded-xl bg-cyan-500/5 border border-cyan-500/15">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm font-medium text-cyan-300">
            AI is generating your campaign...
          </span>
        </div>
        <div className="space-y-2.5">
          <div className="h-4 w-4/5 rounded-lg bg-slate-800 animate-pulse" />
          <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse" />
          <div className="h-4 w-3/5 rounded-lg bg-slate-800 animate-pulse" />
          <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (job.status === "completed" && job.output) {
    return (
      <div className="mt-5 p-6 rounded-xl bg-violet-500/5 border border-violet-500/20">
        <div className="flex items-center gap-2 text-xs font-semibold mb-4 uppercase tracking-widest text-violet-300">
          <Sparkles size={14} />
          AI-GENERATED CAMPAIGN
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
          {job.output}
        </div>
      </div>
    );
  }

  if (job.status === "failed" || job.status === "timed_out") {
    return (
      <div className="mt-5 p-5 rounded-xl bg-red-500/5 border border-red-500/20">
        <div className="flex items-center gap-2.5 mb-2">
          <XCircle size={16} className="text-red-400" />
          <span className="text-sm font-semibold text-red-400">
            {job.status === "timed_out" ? "Generation timed out" : "Generation failed"}
          </span>
        </div>
        {job.error_message && (
          <p className="text-xs mt-2 text-slate-500">
            {job.error_message}
          </p>
        )}
        {job.retry_count > 0 && (
          <p className="text-xs mt-2 text-slate-500">
            Attempted {job.retry_count + 1} time{job.retry_count > 0 ? "s" : ""}
          </p>
        )}
      </div>
    );
  }

  return null;
}

export default function JobCard({ submission, participant, score, canScore, onScore }: Props) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600">
              {participant?.display_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-base text-slate-100">
                  {participant?.display_name || "Unknown"}
                </span>
                {participant?.eliminated && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">eliminated</span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(submission.submitted_at).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl mb-2 bg-slate-900/40 border border-slate-700/20">
            <div className="text-xs font-semibold mb-2 uppercase tracking-widest text-slate-500">PROMPT</div>
            <p className="text-sm italic text-slate-300">
              &ldquo;{submission.prompt_text}&rdquo;
            </p>
          </div>

          <JobOutput job={submission.job} />
        </div>

        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <JobStatusBadge job={submission.job} />

          {score && (
            <div className="text-right">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold bg-gradient-to-r from-violet-600 to-cyan-500 mx-auto mb-2">
                {score.points}
              </div>
              {score.rank && (
                <div className="text-xs text-slate-500">
                  Rank #{score.rank}
                </div>
              )}
            </div>
          )}

          {canScore && submission.job?.status === "completed" && (
            <button onClick={onScore} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-xs hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 flex items-center gap-1.5">
              <Zap size={14} fill="white" />
              Score
            </button>
          )}
        </div>
      </div>

      {score?.host_note && (
        <div className="mt-5 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <div className="text-xs font-semibold mb-2 uppercase tracking-widest text-yellow-300">HOST NOTE</div>
          <p className="text-sm text-slate-300">
            {score.host_note}
          </p>
        </div>
      )}
    </div>
  );
}
