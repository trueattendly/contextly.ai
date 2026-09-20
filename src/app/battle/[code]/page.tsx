"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Loader2, Swords, Trophy, Copy, Check, Search, ArrowRight } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { GameCategory, BattleDifficulty } from "@/types/game";
import { GAME_CATEGORY_LABELS, DIFFICULTY_LABELS, formatDuration, getRankLabel, getRankColor } from "@/types/game";

interface BattleRoomRow {
  code: string;
  category: GameCategory;
  difficulty: BattleDifficulty;
  max_guesses: number;
  status: "waiting" | "active" | "finished";
  mystery_hook: string | null;
  stories: string[] | null;
  takeaways: [string, string, string] | null;
  player1_id: string;
  player2_id: string | null;
  player1_best_rank: number | null;
  player1_last_rank: number | null;
  player1_guess_count: number;
  player2_best_rank: number | null;
  player2_last_rank: number | null;
  player2_guess_count: number;
  winner_id: string | null;
  solved_word: string | null;
  started_at: string | null;
  finished_at: string | null;
}

function RankHud({
  label, rank, guesses, maxGuesses, highlight,
}: {
  label: string; rank: number | null; guesses: number; maxGuesses: number; highlight: boolean;
}) {
  const quotaExhausted = guesses >= maxGuesses;
  return (
    <div className={`glass rounded-xl p-4 border flex-1 ${highlight ? "border-peach/20 bg-peach/[0.03]" : "border-slateDark-600/[0.05]"}`}>
      <p className="text-[9px] font-bold text-peach/40 uppercase tracking-widest mb-2">{label}</p>
      {rank == null ? (
        <p className="text-peach/35 text-xs font-mono">No guesses yet</p>
      ) : (
        <>
          <p className={`font-mono font-bold text-lg ${getRankColor(rank)}`}>#{rank}</p>
          <p className="text-[10px] text-peach/40 mt-0.5">{getRankLabel(rank)}</p>
        </>
      )}
      <p className={`text-[9px] font-mono mt-2 ${quotaExhausted ? "text-red-400 font-bold" : "text-peach/35"}`}>
        {guesses} / {maxGuesses} guesses
      </p>
    </div>
  );
}

export default function BattleRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [room, setRoom] = useState<BattleRoomRow | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isGuessing, setIsGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, [supabase]);

  const fetchRoom = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from("battle_rooms").select("*").eq("code", code).single();
    if (!fetchError && data) {
      setRoom(data as BattleRoomRow);
      setNotFound(false);
    } else {
      setNotFound(true);
    }
    setLoadingRoom(false);
  }, [code, supabase]);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      fetchRoom();
    });
  }, [user, fetchRoom]);

  // Realtime: the opponent's guesses arrive here as row UPDATEs containing
  // only rank/guess-count/status columns - never the guessed word itself.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`battle-room-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_rooms", filter: `code=eq.${code}` },
        (payload) => setRoom(payload.new as BattleRoomRow)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, code, supabase]);

  // Unified gameplay timer: ticks from started_at, freezes once finished.
  useEffect(() => {
    if (!room?.started_at || room.status === "finished") return;
    const startMs = new Date(room.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [room?.started_at, room?.status]);

  // Once finished, the displayed time is derived directly from the fixed
  // started_at/finished_at pair rather than the ticking `elapsed` state.
  const displaySeconds =
    room?.status === "finished" && room.started_at && room.finished_at
      ? Math.max(0, Math.round((new Date(room.finished_at).getTime() - new Date(room.started_at).getTime()) / 1000))
      : elapsed;

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/multiplayer/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchRoom();
      } else {
        setError(data.error ?? "Failed to join room.");
      }
    } catch {
      setError("Network error joining room.");
    } finally {
      setJoining(false);
    }
  };

  const handleGuess = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isGuessing || room?.status !== "active" || myQuotaExhausted) return;
    setIsGuessing(true);
    setError(null);
    try {
      const res = await fetch("/api/multiplayer/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, word: inputValue }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInputValue("");
        await fetchRoom(); // Picks up my own committed rank/status, including a win.
      } else {
        setError(data.error ?? "Evaluation failed.");
      }
    } catch {
      setError("Network error. Check connection.");
    } finally {
      setIsGuessing(false);
      inputRef.current?.focus();
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable - non-critical.
    }
  };

  if (authLoading || (user && loadingRoom)) {
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
        <p className="text-peach/55 text-sm mb-6 max-w-sm">You need to be signed in to join this battle room.</p>
        <Link href="/" className="px-5 py-2 rounded-lg bg-peach text-slateDark-900 text-sm font-semibold hover:bg-peach-light active:bg-peach-dark shadow-md transition-colors">
          Back to Game
        </Link>
      </main>
    );
  }

  if (notFound || !room) {
    return (
      <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-xl font-bold mb-2">Room {code}</h1>
        <p className="text-peach/55 text-sm mb-6 max-w-sm">This room doesn&apos;t exist yet, or you haven&apos;t joined it.</p>
        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slateDark-900 bg-peach hover:bg-peach-light active:bg-peach-dark disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2 mb-4 shadow-md"
        >
          {joining ? <Loader2 size={13} className="animate-spin" /> : <Swords size={13} />}
          {joining ? "Joining..." : `Join Room ${code}`}
        </button>
        <Link href="/battle" className="text-peach text-xs hover:text-peach-light transition-colors">
          Back to Battle Lobby
        </Link>
      </main>
    );
  }

  const isPlayer1 = room.player1_id === user.id;
  const myRank = {
    last: isPlayer1 ? room.player1_last_rank : room.player2_last_rank,
    best: isPlayer1 ? room.player1_best_rank : room.player2_best_rank,
    guesses: isPlayer1 ? room.player1_guess_count : room.player2_guess_count,
  };
  const oppRank = {
    last: isPlayer1 ? room.player2_last_rank : room.player1_last_rank,
    best: isPlayer1 ? room.player2_best_rank : room.player1_best_rank,
    guesses: isPlayer1 ? room.player2_guess_count : room.player1_guess_count,
  };
  const iWon = room.winner_id === user.id;
  const isWaitingForOpponent = room.status === "waiting";
  const stories = room.stories ?? [];
  const myQuotaExhausted = myRank.guesses >= room.max_guesses;
  const winnerRank = iWon ? myRank.best : oppRank.best;
  const winSummary =
    winnerRank != null && winnerRank <= 2
      ? (winnerRank === 1 ? "Solved it exactly!" : "Won with a synonym!")
      : "Won by closest proximity - both quotas reached";

  return (
    <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col p-4 md:p-8 items-center">
      <div className="max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/battle" className="flex items-center gap-2 text-peach hover:text-peach-light text-sm transition-colors">
            <ArrowLeft size={16} /> Lobby
          </Link>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slateDark-700/[0.03] border border-slateDark-600/[0.08] text-[11px] font-mono font-bold tracking-widest text-peach/75 hover:border-slateDark-600/20 transition-all cursor-pointer"
          >
            {copied ? <Check size={12} className="text-peach" /> : <Copy size={12} />}
            {code}
          </button>
        </div>

        {isWaitingForOpponent ? (
          <div className="glass rounded-2xl border border-slateDark-600/[0.05] p-10 flex flex-col items-center text-center">
            <Loader2 size={24} className="text-peach animate-spin mb-4" />
            <h1 className="text-lg font-bold mb-2">Waiting for an opponent...</h1>
            <p className="text-peach/55 text-xs max-w-xs">
              Share the code <span className="font-mono font-bold text-peach">{code}</span> with a friend so they can join.
            </p>
          </div>
        ) : (
          <>
            {/* Timer + category + difficulty */}
            <div className="flex items-center justify-between mb-5 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-peach/55 uppercase tracking-widest px-2 py-1 rounded-md bg-slateDark-700/[0.03] border border-slateDark-600/[0.06]">
                  {GAME_CATEGORY_LABELS[room.category]}
                </span>
                <span className="text-[10px] font-bold text-peach/55 uppercase tracking-widest px-2 py-1 rounded-md bg-slateDark-700/[0.03] border border-slateDark-600/[0.06]">
                  {DIFFICULTY_LABELS[room.difficulty]}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-peach" aria-label="Elapsed time">
                {formatDuration(displaySeconds)}
              </span>
            </div>

            {room.mystery_hook && (
              <div className="glass rounded-xl p-4 border border-peach/10 bg-peach/[0.02] mb-5">
                <p className="text-[9px] font-bold text-peach uppercase tracking-widest mb-1.5">Mystery Briefing</p>
                <p className="text-peach/90 text-sm leading-relaxed">{room.mystery_hook}</p>
              </div>
            )}

            {/* HUD */}
            <div className="flex gap-3 mb-6">
              <RankHud label="You" rank={myRank.last} guesses={myRank.guesses} maxGuesses={room.max_guesses} highlight />
              <RankHud label="Opponent" rank={oppRank.last} guesses={oppRank.guesses} maxGuesses={room.max_guesses} highlight={false} />
            </div>

            {room.status === "active" && (
              myQuotaExhausted ? (
                <div className="mb-6 glass rounded-xl border border-peach-light/30 bg-peach-light/10 p-4 text-center">
                  <p className="text-xs font-semibold text-peach-light">Out of guesses! Waiting for opponent to finish...</p>
                </div>
              ) : (
                <form onSubmit={handleGuess} className="mb-6">
                  <div className="flex items-center gap-2 p-1.5 glass rounded-xl border border-slateDark-600 focus-within:border-peach focus-within:ring-1 focus-within:ring-peach transition-all duration-200">
                    <div className="pl-2.5 text-peach/40"><Search size={15} /></div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => { setInputValue(e.target.value); setError(null); }}
                      placeholder="Type a guess word..."
                      disabled={isGuessing}
                      maxLength={64}
                      className="flex-1 bg-transparent text-peach placeholder:text-slateDark-600 text-xs outline-none py-2 disabled:opacity-40 font-medium"
                    />
                    <button
                      type="submit"
                      aria-label="Submit guess"
                      disabled={!inputValue.trim() || isGuessing}
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slateDark-900 bg-peach hover:bg-peach-light active:bg-peach-dark disabled:opacity-30 transition-all duration-150 cursor-pointer shadow-md"
                    >
                      {isGuessing ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                    </button>
                  </div>
                </form>
              )
            )}

            {error && <p className="text-center text-xs text-red-400 font-medium mb-4">{error}</p>}

            {stories.length > 0 && (
              <div className="glass rounded-xl p-4 border border-slateDark-600/[0.04] space-y-2">
                <p className="text-[9px] font-bold text-peach/40 uppercase tracking-widest mb-1">Clues</p>
                {stories.map((s, i) => (
                  <p key={i} className="text-xs text-peach/55 leading-relaxed italic">{s}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Victory screen */}
      {room.status === "finished" && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full border border-peach/30 shadow-[0_30px_70px_rgba(0,0,0,0.8)] text-center">
            <div className="w-10 h-10 mx-auto mb-4 rounded-xl flex items-center justify-center bg-peach/10 border border-peach/20">
              <Trophy size={18} className="text-peach" />
            </div>
            <h2 className="font-bold text-lg text-peach-light tracking-tight mb-1">
              {iWon ? "You Won!" : "Opponent Won"}
            </h2>
            <p className="text-[11px] font-semibold text-peach mb-3">{winSummary}</p>

            <div className="flex gap-2 mb-4">
              <div className={`flex-1 rounded-xl border p-3 ${iWon ? "border-peach/30 bg-peach/[0.05]" : "border-slateDark-600/[0.06] bg-slateDark-700/[0.02]"}`}>
                <p className="text-[9px] font-bold text-peach/40 uppercase tracking-widest mb-1">Your Best</p>
                <p className={`font-mono font-bold text-base ${myRank.best != null ? getRankColor(myRank.best) : "text-peach/35"}`}>
                  {myRank.best != null ? `#${myRank.best}` : "-"}
                </p>
              </div>
              <div className={`flex-1 rounded-xl border p-3 ${!iWon ? "border-peach/30 bg-peach/[0.05]" : "border-slateDark-600/[0.06] bg-slateDark-700/[0.02]"}`}>
                <p className="text-[9px] font-bold text-peach/40 uppercase tracking-widest mb-1">Opponent Best</p>
                <p className={`font-mono font-bold text-base ${oppRank.best != null ? getRankColor(oppRank.best) : "text-peach/35"}`}>
                  {oppRank.best != null ? `#${oppRank.best}` : "-"}
                </p>
              </div>
            </div>

            {room.solved_word && (
              <p className="text-peach/55 text-xs leading-relaxed mb-1">
                The concept was &ldquo;<span className="text-peach font-semibold">{room.solved_word}</span>&rdquo; - solved in {formatDuration(displaySeconds)}.
              </p>
            )}
            {room.takeaways && room.takeaways.some(Boolean) && (
              <div className="text-left mb-5 mt-4 rounded-xl border border-slateDark-600/[0.06] bg-slateDark-700/[0.02] p-3.5 space-y-2">
                <p className="text-[10px] font-bold text-peach/55 uppercase tracking-widest mb-1.5">Aha! Takeaways</p>
                {room.takeaways.filter(Boolean).map((fact, i) => (
                  <p key={i} className="text-xs text-peach/75 leading-relaxed flex gap-2">
                    <span className="text-peach font-bold">{i + 1}.</span>
                    <span>{fact}</span>
                  </p>
                ))}
              </div>
            )}
            <Link
              href="/battle"
              className="mt-2 w-full inline-flex py-2 px-4 rounded-lg font-semibold text-xs text-slateDark-900 bg-peach hover:bg-peach-light active:bg-peach-dark transition-all duration-150 items-center justify-center gap-1.5 shadow-md"
            >
              New Battle
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
