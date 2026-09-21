// ─────────────────────────────────────────────────────────────────────────────
//  app/api/multiplayer/rematch/route.ts
//  Mutual-consensus rematch: each player flips their own rematch_p1/p2 flag
//  on a finished room. Only once BOTH flags are true does the round actually
//  reset - a fresh secret word, cleared ranks/guess counts, status back to
//  "active". The reset UPDATE is guarded with .eq("status", "finished") so
//  if both players' requests race past the consensus check simultaneously,
//  only one of them actually performs the reset (matches the same optimistic
//  finalize-race pattern used by guess/route.ts and forfeit/route.ts).
//  Both players learn the outcome purely through the existing battle_rooms
//  Realtime subscription - this route never needs to broadcast anything
//  itself.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { generateGameContent } from "@/lib/wordGeneration";
import type { GameCategory, BattleDifficulty } from "@/types/game";
import { DIFFICULTY_LEVEL } from "@/types/game";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to play." }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ success: false, error: "A room 'code' is required." }, { status: 400 });
  }

  const code = body.code.trim().toUpperCase();
  const adminClient = await createAdminClient();

  const { data: room, error: roomError } = await adminClient
    .from("battle_rooms")
    .select("code, status, category, difficulty, max_guesses, player1_id, player2_id, solved_word, rematch_p1, rematch_p2")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ success: false, error: "Room not found." }, { status: 404 });
  }

  if (room.status !== "finished") {
    return NextResponse.json({ success: false, error: "This battle hasn't finished yet." }, { status: 409 });
  }

  const isPlayer1 = room.player1_id === user.id;
  const isPlayer2 = room.player2_id === user.id;
  if (!isPlayer1 && !isPlayer2) {
    return NextResponse.json({ success: false, error: "You're not a player in this room." }, { status: 403 });
  }
  if (!room.player1_id || !room.player2_id) {
    return NextResponse.json({ success: false, error: "There's no opponent to rematch." }, { status: 409 });
  }

  const { data: flagged, error: flagError } = await adminClient
    .from("battle_rooms")
    .update(isPlayer1 ? { rematch_p1: true } : { rematch_p2: true })
    .eq("code", code)
    .eq("status", "finished")
    .select("rematch_p1, rematch_p2")
    .single();

  if (flagError || !flagged) {
    return NextResponse.json({ success: false, error: "Failed to request a rematch." }, { status: 500 });
  }

  const consensus = flagged.rematch_p1 && flagged.rematch_p2;
  if (!consensus) {
    return NextResponse.json({ success: true, started: false });
  }

  const category = room.category as GameCategory;
  const difficulty = room.difficulty as BattleDifficulty;
  const level = DIFFICULTY_LEVEL[difficulty];
  const excludeWords = room.solved_word ? [room.solved_word] : [];

  const { word, mysteryHook, stories, takeaways } = await generateGameContent(category, level, excludeWords);

  const { error: secretError } = await adminClient
    .from("battle_secrets")
    .upsert({ room_code: code, word }, { onConflict: "room_code" });

  if (secretError) {
    console.error("[contextle][Battle] Failed to store rematch secret:", secretError);
    return NextResponse.json({ success: false, error: "Failed to start the rematch." }, { status: 500 });
  }

  // Guard with .eq("status", "finished") so a near-simultaneous consensus
  // check from the opponent's own request can't reset the room twice.
  const { data: resetRoom, error: resetError } = await adminClient
    .from("battle_rooms")
    .update({
      status: "active",
      mystery_hook: mysteryHook,
      stories,
      takeaways,
      winner_id: null,
      win_reason: "solve",
      forfeit_by_id: null,
      solved_word: null,
      player1_best_rank: null,
      player1_last_rank: null,
      player1_guess_count: 0,
      player1_quota_exhausted_at: null,
      player2_best_rank: null,
      player2_last_rank: null,
      player2_guess_count: 0,
      player2_quota_exhausted_at: null,
      rematch_p1: false,
      rematch_p2: false,
      started_at: new Date().toISOString(),
      finished_at: null,
    })
    .eq("code", code)
    .eq("status", "finished")
    .select("code")
    .single();

  // Lost the reset race to the opponent's concurrent request - the room was
  // already reset by them, which is the same outcome from this caller's view.
  const started = Boolean(resetRoom) && !resetError;
  return NextResponse.json({ success: true, started });
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
