"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Loader2, Swords, ChevronDown, ScrollText, Search } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { GameCategory, GameSessionEntry } from "@/types/game";
import { GAME_CATEGORY_LABELS, formatDuration, formatRelativeDate } from "@/types/game";
import { getGuestHistory, syncGuestHistoryToDatabase } from "@/lib/guestHistory";

const PAGE_SIZE = 10;

function HistoryCard({ entry }: { entry: GameSessionEntry }) {
  const categoryLabel = entry.category ? GAME_CATEGORY_LABELS[entry.category as GameCategory] : null;
  const hasTakeaways = entry.takeaways && entry.takeaways.some(Boolean);

  return (
    <div className="rounded-2xl border border-peach-muted p-4 bg-slateDark-800">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {categoryLabel && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-peach-muted text-peach">
              {categoryLabel}
            </span>
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest text-peach/75 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slateDark-700/[0.06]">
            {entry.mode === "battle" ? (<><Swords size={10} /> 1v1 Duel</>) : "Solo Play"}
          </span>
        </div>
        <span className="text-[10px] text-peach/55 font-mono whitespace-nowrap">{formatRelativeDate(entry.createdAt)}</span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-sm font-semibold text-peach-light">{entry.secretWord ?? "Unknown concept"}</p>
          <span
            className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              entry.won ? "bg-peach/15 text-peach" : "bg-red-500/15 text-red-400"
            }`}
          >
            {entry.won ? "Win" : "Loss"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono font-semibold text-peach">
            {entry.guessCount}{entry.maxGuesses ? ` / ${entry.maxGuesses}` : ""} guesses
          </p>
          <p className="text-[10px] text-peach/55 font-mono mt-0.5">{formatDuration(entry.timeTakenSeconds)}</p>
        </div>
      </div>

      {hasTakeaways && (
        <details className="group mt-2">
          <summary className="text-[10px] font-bold cursor-pointer list-none flex items-center gap-1 pt-2 border-t border-slateDark-600/[0.06] text-peach">
            <ChevronDown size={11} className="transition-transform group-open:rotate-180" />
            Concept Takeaways
          </summary>
          <div className="mt-2 space-y-1.5 pl-1">
            {entry.takeaways!.filter(Boolean).map((t, i) => (
              <p key={i} className="text-[11px] text-peach/75 leading-relaxed flex gap-1.5">
                <span className="font-bold text-peach">{i + 1}.</span>
                <span>{t}</span>
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function CardSkeleton() {
  return <div className="rounded-2xl h-[104px] animate-pulse bg-slateDark-900" />;
}

export default function HistoryPage() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [entries, setEntries] = useState<GameSessionEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Non-null once we know this is a guest session - holds the FULL local
  // array, sliced in memory to simulate pagination (per spec).
  const [guestAll, setGuestAll] = useState<GameSessionEntry[] | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async (pageToLoad: number) => {
    try {
      const res = await fetch(`/api/history?page=${pageToLoad}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEntries((prev) => (pageToLoad === 1 ? data.sessions : [...prev, ...data.sessions]));
        setHasMore(data.hasMore);
        setPage(pageToLoad);
      } else {
        setError(data.error ?? "Failed to load history.");
      }
    } catch {
      setError("Network error loading history.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(u);
      setAuthChecked(true);

      if (u) {
        setSyncing(true);
        await syncGuestHistoryToDatabase();
        if (cancelled) return;
        setSyncing(false);
        await loadPage(1);
      } else {
        const guest = getGuestHistory();
        setGuestAll(guest);
        setEntries(guest.slice(0, PAGE_SIZE));
        setHasMore(guest.length > PAGE_SIZE);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    if (guestAll) {
      setEntries((prev) => {
        const next = guestAll.slice(0, prev.length + PAGE_SIZE);
        setHasMore(next.length < guestAll.length);
        return next;
      });
    } else {
      await loadPage(page + 1);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, guestAll, page, loadPage]);

  // Native IntersectionObserver on a dedicated bottom sentinel - no library.
  useEffect(() => {
    if (loading) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (observedEntries) => {
        if (observedEntries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, loadMore]);

  return (
    <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col p-4 md:p-8 items-center">
      <div className="max-w-2xl w-full">
        <Link href="/" className="flex items-center gap-2 text-peach hover:text-peach-light text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Game
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-peach/10">
            <ScrollText size={20} className="text-peach" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Game History</h1>
            <p className="text-peach/40 text-xs">
              {user ? "Solo rounds and 1v1 duels you've played" : "Local history for this device"}
            </p>
          </div>
        </div>

        {syncing && (
          <p className="text-[11px] text-peach/55 mb-4 flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" /> Syncing local history to your account...
          </p>
        )}

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        {!authChecked || loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slateDark-600/[0.06] rounded-2xl">
            <Search size={20} className="text-peach/35 mx-auto mb-3" />
            <p className="text-peach/55 text-sm font-medium mb-1">No games in your history yet</p>
            <p className="text-peach/35 text-xs max-w-xs mx-auto">
              {user
                ? "Play a solo round or a 1v1 battle to start building your history."
                : "Sign in and play a round - history for signed-out visitors isn't tracked yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => <HistoryCard key={entry.id} entry={entry} />)}
            {loadingMore && <CardSkeleton />}
            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
          </div>
        )}
      </div>
    </main>
  );
}
