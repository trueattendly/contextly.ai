// ─────────────────────────────────────────────────────────────────────────────
//  app/api/history/route.ts
//  GET /api/history?page=1&limit=10 - paginated game_sessions for the
//  authenticated user. Guests never call this route; the /history page
//  reads localStorage directly for them (see lib/guestHistory.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import type { GameSessionEntry } from "@/types/game";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to view history." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const adminClient = await createAdminClient();
  const { data, error, count } = await adminClient
    .from("game_sessions")
    .select("id, mode, won, time_taken_seconds, guess_count, category, secret_word, takeaways, max_guesses, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[contextle][History] Failed to fetch game_sessions:", error);
    return NextResponse.json({ success: false, error: "Failed to load history." }, { status: 500 });
  }

  const sessions: GameSessionEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    mode: row.mode,
    won: row.won,
    timeTakenSeconds: row.time_taken_seconds,
    guessCount: row.guess_count,
    category: row.category,
    secretWord: row.secret_word,
    takeaways: row.takeaways,
    maxGuesses: row.max_guesses,
    createdAt: row.created_at,
  }));

  const total = count ?? 0;
  const hasMore = offset + sessions.length < total;

  return NextResponse.json({ success: true, sessions, page, hasMore, total });
}
