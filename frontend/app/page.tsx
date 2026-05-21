"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore, isAuthenticated } from "@/store/authStore";
import { Zap, Activity, Bot, Trophy, ArrowRight } from "lucide-react";

const FeatureCard = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-7 text-left hover:border-violet-500/30 hover:bg-slate-900/80 transition-all duration-300">
    <div className="mb-5">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-violet-500/15 border border-violet-500/25">
        <Icon size={22} className="text-violet-400" />
      </div>
    </div>
    <h3 className="text-base font-semibold mb-2 text-slate-100">{title}</h3>
    <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
  </div>
);

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [token, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-violet-900/20 to-transparent" />

      <div className="relative z-10 text-center max-w-4xl mx-auto w-full">
        {/* Logo */}
        <div className="inline-flex items-center gap-3 mb-10 px-5 py-2.5 rounded-full bg-slate-800/40 border border-slate-700/30">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600">
            <Zap size={18} fill="white" className="text-white" />
          </div>
          <span className="text-xs font-semibold tracking-widest text-violet-300 uppercase">
            POIRO · AI BATTLE ROOM
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-5">
          <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
            Create. Compete. Conquer.
          </span>
        </h1>

        <p className="text-base md:text-lg mb-10 max-w-2xl mx-auto text-slate-400 leading-relaxed">
          A real-time AI creative battle platform. Submit your prompts, watch the AI generate stunning campaign concepts, and let the best idea win.
        </p>

        <div className="flex gap-4 justify-center flex-wrap mb-16">
          <Link href="/register">
            <button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 flex items-center gap-2">
              Start Battling
              <ArrowRight size={16} />
            </button>
          </Link>
          <Link href="/login">
            <button className="bg-transparent text-slate-400 border border-slate-700/50 px-8 py-3 rounded-xl font-medium text-sm hover:border-violet-500/40 hover:text-slate-100 hover:bg-violet-500/5 transition-all duration-300">
              Sign In
            </button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard icon={Activity} title="Real-time WebSockets" description="Live room and job state updates" />
          <FeatureCard icon={Bot} title="AI Generation Jobs" description="Async processing with state tracking" />
          <FeatureCard icon={Trophy} title="Host Judging" description="Score, rank, and eliminate participants" />
        </div>
      </div>
    </main>
  );
}
