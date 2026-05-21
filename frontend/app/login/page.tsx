"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Zap, ArrowLeft, Trophy, Users, Bot } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      setAuth(res.data.user, res.data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Invalid email or password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

      {/* Left Section */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-16">
        <div>
          <div className="inline-flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600">
              <Zap size={24} fill="white" className="text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-100">Battle Room</span>
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Enter the Arena.
            </span>
            <br />
            <span className="text-slate-100">Let creativity win.</span>
          </h1>

          <p className="text-lg mb-12 max-w-lg text-slate-400 leading-relaxed">
            Join real-time AI creative battles. Submit your prompts, watch AI generate stunning concepts, and compete with others.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="text-left">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-violet-500/15 border border-violet-500/25">
              <Trophy size={20} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold mb-1 text-slate-100">Host Judging</h3>
            <p className="text-xs text-slate-400">Score and rank participants</p>
          </div>

          <div className="text-left">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-violet-500/15 border border-violet-500/25">
              <Users size={20} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold mb-1 text-slate-100">Multiplayer</h3>
            <p className="text-xs text-slate-400">Real-time room experience</p>
          </div>

          <div className="text-left">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-violet-500/15 border border-violet-500/25">
              <Bot size={20} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold mb-1 text-slate-100">AI Generation</h3>
            <p className="text-xs text-slate-400">Async job processing</p>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <Link href="/" className="inline-flex items-center gap-2 mb-8 text-sm font-medium text-slate-400 hover:text-violet-400 transition-colors">
              <ArrowLeft size={16} />
              Back to Home
            </Link>

            <h1 className="text-3xl font-semibold mb-2 text-slate-100">Welcome back</h1>
            <p className="text-sm text-slate-400">Ready for the next round?</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/30 rounded-2xl p-7">
            {error && (
              <div className="mb-5 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">
                  Email
                </label>
                <input
                  className="w-full bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                <input
                  className="w-full bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  type="password"
                  placeholder="Your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Enter Arena"}
              </button>
            </form>

            <p className="text-center mt-7 text-xs text-slate-500">
              New here?{" "}
              <Link href="/register" className="font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
