// ─────────────────────────────────────────────────────────────────────────────
//  app/api/history/sync/route.ts
//  POST /api/history/sync - pushes a signed-in user's locally-stored guest
//  history into game_sessions. Called by syncGuestHistoryToDatabase() right
//  after login.
//
//  Warning: Integrity caveat: the client fully controls each entry's `won`,
//  `guessCount`, etc. - these rows feed the weekly leaderboard, so this
//  endpoint is a genuine spoofing surface (a user could sync fabricated
//  wins to inflate their own ranking). It's bounded and sanity-clamped
//  below, but not cryptographically verified - there's no way to re-verify
//  a historical guess against the AI evaluator after the fact. This is
//  currently low-risk in practice only because nothing in the app writes
//  to guest history yet (see lib/guestHistory.ts), so there's no real
//  traffic to exploit - but the endpoint itself doesn't know that.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

const MAX_ENTRIES_PER_SYNC = 100;
const VALID_MODES = ["solo", "battle"];

function clamp(value: unknown, min: number, max: number, fallback: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to sync history." }, { status: 401 });
  }

  let body: { entries?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ success: true, synced: 0 });
  }

  const adminClient = await createAdminClient();
  const now = new Date();
  const rows = body.entries
    .slice(0, MAX_ENTRIES_PER_SYNC)
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map((e) => {
      const createdAtCandidate = typeof e.createdAt === "string" ? new Date(e.createdAt) : null;
      const createdAt = createdAtCandidate && !Number.isNaN(createdAtCandidate.getTime()) && createdAtCandidate <= now
        ? createdAtCandidate.toISOString()
        : now.toISOString();

      return {
        user_id: user.id,
        mode: VALID_MODES.includes(e.mode as string) ? e.mode : "solo",
        won: Boolean(e.won),
        time_taken_seconds: clamp(e.timeTakenSeconds, 0, 24 * 60 * 60, null),
        guess_count: clamp(e.guessCount, 0, 1000, 0),
        category: typeof e.category === "string" ? e.category.slice(0, 20) : null,
        secret_word: typeof e.secretWord === "string" ? e.secretWord.slice(0, 100) : null,
        takeaways: Array.isArray(e.takeaways) ? e.takeaways.slice(0, 3).map((t) => String(t).slice(0, 500)) : null,
        max_guesses: clamp(e.maxGuesses, 1, 100, null),
        created_at: createdAt,
      };
    });

  const { error: insertError } = await adminClient.from("game_sessions").insert(rows);
  if (insertError) {
    console.error("[contextle][History] Failed to sync guest history:", insertError);
    return NextResponse.json({ success: false, error: "Failed to sync history." }, { status: 500 });
  }

  return NextResponse.json({ success: true, synced: rows.length });
}
