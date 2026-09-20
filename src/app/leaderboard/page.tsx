"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Trophy, Loader2, ArrowLeft, Flame } from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/types/game";

interface WeeklyPlayer {
  rank: number;
  userId: string;
  displayName: string | null;
  gamesWon: number;
  fastestTimeSeconds: number | null;
  totalGuesses: number;
}

function WeeklyLeaderboardTab() {
  const [players, setPlayers] = useState<WeeklyPlayer[]>([]);
  const [week, setWeek] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/leaderboard/weekly");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success) {
          setPlayers(data.players);
          setWeek(data.week);
        } else {
          setError(data.error ?? "Failed to load weekly leaderboard.");
        }
      } catch {
        if (!cancelled) setError("Network error loading weekly leaderboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="text-peach animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center py-10 text-red-400 font-mono text-sm">{error}</p>;
  }

  if (players.length === 0) {
    return <p className="text-center py-10 text-peach/40 font-mono">No wins recorded this week yet.</p>;
  }

  return (
    <div className="space-y-3">
      {week && (
        <p className="text-center text-[11px] text-peach/40 font-mono uppercase tracking-widest mb-2">
          Week {week}
        </p>
      )}
      {players.map((p) => (
        <div
          key={p.userId}
          className="flex items-center justify-between p-4 bg-slateDark-700/[0.015] border border-slateDark-600/[0.03] rounded-xl hover:border-peach/30 hover:bg-slateDark-700/[0.03] transition-all duration-300 group"
        >
          <div className="flex items-center gap-4">
            <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold font-mono text-sm ${p.rank === 1 ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]" : p.rank === 2 ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" : p.rank === 3 ? "bg-amber-600/20 text-amber-600 border border-amber-600/30" : "bg-slateDark-700/5 text-peach/55 border border-slateDark-600/10"}`}>
              {p.rank}
            </span>
            <div>
              <p className="font-semibold text-peach/90 group-hover:text-peach-light transition-colors">
                {p.displayName || "Anonymous"}
              </p>
              <p className="text-[10px] text-peach/40 font-mono mt-0.5">{p.totalGuesses} total guesses</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="text-peach font-mono font-bold px-3 py-1 bg-peach/10 rounded border border-peach/20 shadow-[0_0_10px_rgba(254,218,184,0.1)]">
              {p.gamesWon} {p.gamesWon === 1 ? "win" : "wins"}
            </div>
            <div className="text-peach/55 font-mono text-xs">
              {formatDuration(p.fastestTimeSeconds)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"alltime" | "weekly">("alltime");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const fetchPlayers = async (pageIndex: number) => {
    const supabase = createClient();
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, current_level")
      .order("current_level", { ascending: false })
      .range(from, to);

    return { data, error };
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data, error } = await fetchPlayers(0);
      if (!error && data) {
        setPlayers(data);
        if (data.length < PAGE_SIZE) setHasMore(false);
      }
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const { data, error } = await fetchPlayers(nextPage);
    if (!error && data) {
      setPlayers((prev) => [...prev, ...data]);
      setPage(nextPage);
      if (data.length < PAGE_SIZE) setHasMore(false);
    }
    setLoadingMore(false);
  };

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPlayerRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasMore, page]);

  return (
    <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col p-4 md:p-8 relative">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center">
        <Link href="/" className="self-start flex items-center gap-2 text-peach hover:text-peach-light text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Game
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.15)]">
            <Trophy size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-peach-light">Global Leaderboard</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 mb-6 p-1 rounded-xl bg-slateDark-700/[0.02] border border-slateDark-600/[0.05]">
          <button
            type="button"
            onClick={() => setTab("alltime")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${tab === "alltime" ? "bg-peach/10 text-peach border border-peach/20" : "text-peach/55 hover:text-peach/90 border border-transparent"}`}
          >
            <Trophy size={13} /> All-Time (Level)
          </button>
          <button
            type="button"
            onClick={() => setTab("weekly")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${tab === "weekly" ? "bg-peach/10 text-peach border border-peach/20" : "text-peach/55 hover:text-peach/90 border border-transparent"}`}
          >
            <Flame size={13} /> This Week (Wins)
          </button>
        </div>

        {tab === "weekly" ? (
          <div className="w-full bg-slateDark-700/[0.02] border border-slateDark-600/[0.05] rounded-2xl p-4 md:p-6 mb-8 shadow-2xl">
            <WeeklyLeaderboardTab />
          </div>
        ) : (
        <div className="w-full bg-slateDark-700/[0.02] border border-slateDark-600/[0.05] rounded-2xl p-4 md:p-6 mb-8 shadow-2xl">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="text-peach animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <p className="text-center py-10 text-peach/40 font-mono">No players found.</p>
          ) : (
            <div className="space-y-3">
              {players.map((p, i) => {
                const isLast = i === players.length - 1;
                return (
                <div
                  ref={isLast ? lastPlayerRef : null}
                  key={p.id || i}
                  className="flex items-center justify-between p-4 bg-slateDark-700/[0.015] border border-slateDark-600/[0.03] rounded-xl hover:border-peach/30 hover:bg-slateDark-700/[0.03] transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold font-mono text-sm ${i === 0 ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]" : i === 1 ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" : i === 2 ? "bg-amber-600/20 text-amber-600 border border-amber-600/30" : "bg-slateDark-700/5 text-peach/55 border border-slateDark-600/10"}`}>
                      {i + 1}
                    </span>
                    <span className="font-semibold text-peach/90 group-hover:text-peach-light transition-colors">
                      {p.display_name || "Anonymous"}
                    </span>
                  </div>
                  <div className="text-peach font-mono font-bold px-3 py-1 bg-peach/10 rounded border border-peach/20 shadow-[0_0_10px_rgba(254,218,184,0.1)]">
                    Level {p.current_level}
                  </div>
                </div>
                );
              })}
              {loadingMore && (
                <div className="flex justify-center py-6">
                  <Loader2 size={24} className="text-peach animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </main>
  );
}
