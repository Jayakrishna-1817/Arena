"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore, isAuthenticated } from "@/store/authStore";
import { roomsAPI } from "@/lib/api";
import { Room } from "@/lib/types";
import { Zap, LogOut, Plus, DoorOpen, Users, Crown, Gamepad2 } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", challenge_prompt: "" });
  const [joinCode, setJoinCode] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this room? This action cannot be undone!")) {
      return;
    }
    setDeleteRoomId(roomId);
    try {
      await roomsAPI.delete(roomId);
      await loadRooms();
    } finally {
      setDeleteRoomId(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadRooms();
  }, [token, router]);

  const loadRooms = async () => {
    try {
      const res = await roomsAPI.list();
      setRooms(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const res = await roomsAPI.create(createForm);
      router.push(`/room/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to create room";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const res = await roomsAPI.join(joinCode.toUpperCase());
      router.push(`/room/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to join room";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      lobby: "bg-slate-800/80 text-slate-400 border-slate-700/30",
      active: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
      completed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    };
    return colors[status as keyof typeof colors] || colors.lobby;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-violet-900/20 to-transparent" />

      <nav className="sticky top-0 z-50 border-b border-slate-800/30 px-8 py-5 flex items-center justify-between bg-slate-950/95 backdrop-blur-xl">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-r from-violet-600 to-cyan-500">
            <Zap size={20} fill="white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
            Battle Room
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-violet-500/20 border border-violet-500/40 text-violet-300">
              {user?.display_name?.charAt(0).toUpperCase() || "?"}
            </div>
            <span className="text-sm font-medium text-slate-400">
              {user?.display_name}
            </span>
          </div>
          <button
            onClick={() => { clearAuth(); router.push("/"); }}
            className="bg-slate-800/50 border border-slate-700/30 text-slate-400 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-800/80 hover:text-slate-100 transition-all"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-5">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-slate-100">
              Your Arenas
            </h1>
            <p className="text-base text-slate-400">
              Create a room or join an existing battle
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => { setShowJoin(true); setShowCreate(false); setFormError(""); }}
              className="bg-slate-800/50 border border-slate-700/30 text-slate-400 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-800/80 hover:text-slate-100 transition-all"
            >
              <DoorOpen size={18} />
              Join Room
            </button>
            <button 
              onClick={() => { setShowCreate(true); setShowJoin(false); setFormError(""); }}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
            >
              <Plus size={18} />
              Create Room
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-8 mb-10">
            <h2 className="text-xl font-semibold mb-6 text-slate-100">
              Create a Battle Room
            </h2>
            {formError && (
              <div className="mb-5 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-400">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-300">
                  Room Title
                </label>
                <input 
                  className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-100 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80 transition-all" 
                  placeholder="e.g. Cyberpunk Campaign Battle"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  required 
                  minLength={3} 
                  maxLength={120} 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-300">
                  Challenge Prompt
                </label>
                <textarea 
                  className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl px-4 py-3.5 text-slate-100 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80 transition-all min-h-[120px] resize-none"
                  placeholder="e.g. Create the most insane luxury cyberpunk perfume campaign for Gen-Z."
                  value={createForm.challenge_prompt}
                  onChange={(e) => setCreateForm({ ...createForm, challenge_prompt: e.target.value })}
                  required 
                  minLength={10} 
                  maxLength={1000} 
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  type="submit" 
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300" 
                  disabled={formLoading}
                >
                  {formLoading ? "Creating..." : "Create Room"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowCreate(false)} 
                  className="bg-slate-800/50 border border-slate-700/30 text-slate-400 px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800/80 hover:text-slate-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showJoin && (
          <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-8 mb-10">
            <h2 className="text-xl font-semibold mb-6 text-slate-100">
              Join a Battle Room
            </h2>
            {formError && (
              <div className="mb-5 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-400">
                {formError}
              </div>
            )}
            <form onSubmit={handleJoin} className="flex flex-col md:flex-row gap-4">
              <input 
                className="flex-1 bg-slate-900/50 border border-slate-700/30 rounded-xl px-5 py-3.5 font-mono text-lg tracking-widest uppercase text-slate-100 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80 transition-all"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6} 
                required 
              />
              <div className="flex gap-4">
                <button 
                  type="submit" 
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold whitespace-nowrap hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300" 
                  disabled={formLoading}
                >
                  {formLoading ? "Joining..." : "Join"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowJoin(false)} 
                  className="bg-slate-800/50 border border-slate-700/30 text-slate-400 px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800/80 hover:text-slate-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-7 space-y-4">
                <div className="h-5 w-2/3 rounded-lg bg-slate-800 animate-pulse" />
                <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse" />
                <div className="h-4 w-3/4 rounded-lg bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/60 border border-slate-700/20 rounded-2xl">
            <Gamepad2 size={56} className="text-slate-500 mx-auto mb-6" />
            <h3 className="text-xl font-semibold mb-2 text-slate-100">
              No arenas yet
            </h3>
            <p className="text-base mb-8 max-w-md mx-auto text-slate-400">
              Create your first battle room or join one with a code
            </p>
            <button 
              onClick={() => setShowCreate(true)} 
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
            >
              Create First Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => (
              <div key={room.id} className="relative group">
                <Link href={`/room/${room.id}`}>
                  <div className="bg-slate-900/60 border border-slate-700/20 rounded-2xl p-7 cursor-pointer hover:border-violet-500/30 hover:bg-slate-900/80 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-lg text-slate-100 hover:text-violet-300 transition-colors">
                        {room.title}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(room.status)}`}>
                        {room.status}
                      </span>
                    </div>
                    <p className="text-sm mb-6 line-clamp-2 text-slate-400">
                      {room.challenge_prompt}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-violet-300">
                        {room.code}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users size={14} />
                        {room.participants.length} participant{room.participants.length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                        {room.host_id === user?.id ? <Crown size={14} className="text-yellow-400" /> : <Gamepad2 size={14} />}
                        {room.host_id === user?.id ? "Host" : "Player"}
                      </span>
                    </div>
                  </div>
                </Link>
                {room.host_id === user?.id && (
                  <button
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    disabled={deleteRoomId === room.id}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                  >
                    {deleteRoomId === room.id ? (
                      <div className="w-4 h-4 border border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
