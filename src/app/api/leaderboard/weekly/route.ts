// ─────────────────────────────────────────────────────────────────────────────
//  app/api/leaderboard/weekly/route.ts
//  Public GET - no auth required. Aggregates game_sessions in JS rather than
//  a DB view/RPC: at this game's scale, a week's worth of session rows is
//  small, and this avoids adding a stored procedure to the SQL migration.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

function getIsoWeekInfo(date: Date): { label: string; start: Date; end: Date } {
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday=0 .. Sunday=6

  // ISO week number: based on the Thursday of this week (ISO 8601 rule).
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() - dayNum + 3);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Week bounds: Monday 00:00 UTC through the following Monday.
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - dayNum);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return { label: `${isoYear}-W${String(week).padStart(2, "0")}`, start, end };
}

interface WeeklyEntry {
  userId: string;
  gamesWon: number;
  fastestTimeSeconds: number | null;
  totalGuesses: number;
}

export async function GET(): Promise<NextResponse> {
  const adminClient = await createAdminClient();
  const { label, start, end } = getIsoWeekInfo(new Date());

  const { data: sessions, error } = await adminClient
    .from("game_sessions")
    .select("user_id, time_taken_seconds, guess_count")
    .eq("won", true)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) {
    console.error("[contextle][Leaderboard] Failed to fetch weekly sessions:", error);
    return NextResponse.json({ success: false, error: "Failed to load weekly leaderboard." }, { status: 500 });
  }

  const byUser = new Map<string, WeeklyEntry>();
  for (const session of sessions ?? []) {
    const entry = byUser.get(session.user_id) ?? {
      userId: session.user_id,
      gamesWon: 0,
      fastestTimeSeconds: null,
      totalGuesses: 0,
    };
    entry.gamesWon += 1;
    entry.totalGuesses += session.guess_count ?? 0;
    if (typeof session.time_taken_seconds === "number") {
      entry.fastestTimeSeconds =
        entry.fastestTimeSeconds === null
          ? session.time_taken_seconds
          : Math.min(entry.fastestTimeSeconds, session.time_taken_seconds);
    }
    byUser.set(session.user_id, entry);
  }

  const ranked = Array.from(byUser.values())
    .sort((a, b) => {
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const aFastest = a.fastestTimeSeconds ?? Infinity;
      const bFastest = b.fastestTimeSeconds ?? Infinity;
      if (aFastest !== bFastest) return aFastest - bFastest;
      return a.totalGuesses - b.totalGuesses;
    })
    .slice(0, 20);

  if (ranked.length === 0) {
    return NextResponse.json({ success: true, week: label, players: [] });
  }

  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, display_name")
    .in("id", ranked.map((r) => r.userId));

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const players = ranked.map((entry, idx) => ({
    rank: idx + 1,
    userId: entry.userId,
    displayName: nameById.get(entry.userId) ?? null,
    gamesWon: entry.gamesWon,
    fastestTimeSeconds: entry.fastestTimeSeconds,
    totalGuesses: entry.totalGuesses,
  }));

  return NextResponse.json({ success: true, week: label, players });
}
