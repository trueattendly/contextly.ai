"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Swords, ArrowLeft, Loader2, Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { GameCategory, BattleDifficulty } from "@/types/game";
import { GAME_CATEGORY_LABELS, VALID_DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_MAX_GUESSES } from "@/types/game";

const CATEGORY_OPTIONS: GameCategory[] = ["foundations", "science", "finance", "advanced"];

export default function BattleLobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [category, setCategory] = useState<GameCategory>("foundations");
  const [difficulty, setDifficulty] = useState<BattleDifficulty>("medium");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/multiplayer/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, difficulty }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/battle/${data.code}`);
      } else {
        setError(data.error ?? "Failed to create battle room.");
      }
    } catch {
      setError("Network error creating battle room.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/multiplayer/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/battle/${data.code}`);
      } else {
        setError(data.error ?? "Failed to join battle room.");
      }
    } catch {
      setError("Network error joining battle room.");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slateDark-800">
        <Loader2 size={16} className="text-peach animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-xl font-bold mb-2">Sign in to battle</h1>
        <p className="text-peach/55 text-sm mb-6 max-w-sm">You need to be signed in to create or join a 1v1 battle.</p>
        <Link href="/" className="px-5 py-2 rounded-lg bg-peach text-slateDark-900 text-sm font-semibold hover:bg-peach-light active:bg-peach-dark shadow-md transition-colors">
          Back to Game
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col p-4 md:p-10 items-center">
      <div className="max-w-lg w-full">
        <Link href="/" className="self-start flex items-center gap-2 text-peach hover:text-peach-light text-sm mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to Game
        </Link>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-peach/10 border border-peach/20 flex items-center justify-center mb-4">
            <Swords size={26} className="text-peach" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">1v1 Battle</h1>
          <p className="text-peach/55 text-sm max-w-sm">Race an opponent to guess the same secret concept first.</p>
        </div>

        {error && (
          <p className="text-center text-xs text-red-400 font-medium mb-4">{error}</p>
        )}

        <div className="glass rounded-2xl border border-slateDark-600/[0.05] p-6 mb-5 space-y-4">
          <h2 className="text-[10px] font-bold text-peach/55 uppercase tracking-widest">Create a Room</h2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                  category === cat
                    ? "bg-peach/10 border-peach/30 text-peach"
                    : "bg-slateDark-700/[0.02] border-slateDark-600/[0.06] text-peach/55 hover:border-slateDark-600/20 hover:text-peach/90"
                }`}
              >
                {GAME_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {VALID_DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border flex flex-col items-center gap-0.5 ${
                  difficulty === d
                    ? "bg-peach/10 border-peach/30 text-peach"
                    : "bg-slateDark-700/[0.02] border-slateDark-600/[0.06] text-peach/55 hover:border-slateDark-600/20 hover:text-peach/90"
                }`}
              >
                <span>{DIFFICULTY_LABELS[d]}</span>
                <span className="text-[9px] opacity-70">{DIFFICULTY_MAX_GUESSES[d]} guesses</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-slateDark-900 bg-peach hover:bg-peach-light active:bg-peach-dark disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Swords size={13} />}
            {creating ? "Creating..." : "Create Battle Room"}
          </button>
        </div>

        <div className="glass rounded-2xl border border-slateDark-600/[0.05] p-6 space-y-4">
          <h2 className="text-[10px] font-bold text-peach/55 uppercase tracking-widest">Join a Room</h2>
          <form onSubmit={handleJoin} className="flex items-center gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="flex-1 px-3 py-2.5 rounded-lg bg-slateDark-900 border border-slateDark-600 text-peach placeholder:text-slateDark-600 text-xs font-mono tracking-widest outline-none focus:border-peach focus:ring-1 focus:ring-peach"
            />
            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold text-peach-light bg-slateDark-700/[0.05] hover:bg-slateDark-700/[0.08] border border-slateDark-600/[0.08] disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {joining ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
              Join
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
