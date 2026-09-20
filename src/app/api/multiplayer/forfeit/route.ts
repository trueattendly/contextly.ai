// ─────────────────────────────────────────────────────────────────────────────
//  app/api/multiplayer/forfeit/route.ts
//  Lets a player resign from an active battle room, awarding an instant win
//  to their opponent. The resigning player's identity comes from their own
//  session (never a client-supplied id) - otherwise anyone could forfeit a
//  room on someone else's behalf.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

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
    .select("code, status, category, takeaways, max_guesses, player1_id, player2_id, player1_guess_count, player2_guess_count, started_at")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ success: false, error: "Room not found." }, { status: 404 });
  }

  if (room.status !== "active") {
    return NextResponse.json({ success: false, error: "This battle isn't active." }, { status: 409 });
  }

  const isPlayer1 = room.player1_id === user.id;
  const isPlayer2 = room.player2_id === user.id;
  if (!isPlayer1 && !isPlayer2) {
    return NextResponse.json({ success: false, error: "You're not a player in this room." }, { status: 403 });
  }

  const winnerId = isPlayer1 ? room.player2_id : room.player1_id;
  if (!winnerId) {
    return NextResponse.json({ success: false, error: "There's no opponent yet to award the win to." }, { status: 409 });
  }

  const { data: secret } = await adminClient.from("battle_secrets").select("word").eq("room_code", code).single();
  const nowIso = new Date().toISOString();

  // Guard with .eq("status", "active") so a forfeit racing a near-simultaneous
  // solve (the opponent's own request) can't both finalize the room.
  const { data: finishedRoom, error: finishError } = await adminClient
    .from("battle_rooms")
    .update({
      status: "finished",
      winner_id: winnerId,
      win_reason: "forfeit",
      forfeit_by_id: user.id,
      solved_word: secret?.word?.toLowerCase() ?? null,
      finished_at: nowIso,
    })
    .eq("code", code)
    .eq("status", "active")
    .select("code")
    .single();

  if (finishError || !finishedRoom) {
    return NextResponse.json({ success: false, error: "This battle already finished." }, { status: 409 });
  }

  const timeTakenSeconds = room.started_at
    ? Math.max(0, Math.round((Date.now() - new Date(room.started_at).getTime()) / 1000))
    : null;
  const winnerGuessCount = isPlayer1 ? room.player2_guess_count : room.player1_guess_count;

  try {
    await adminClient.from("game_sessions").insert({
      user_id: winnerId,
      mode: "battle",
      won: true,
      time_taken_seconds: timeTakenSeconds,
      guess_count: winnerGuessCount,
      category: room.category ?? null,
      secret_word: secret?.word?.toLowerCase() ?? null,
      takeaways: room.takeaways ?? null,
      max_guesses: room.max_guesses,
    });
  } catch (err) {
    console.warn("[contextle][Battle] Failed to insert into game_sessions:", err);
  }

  return NextResponse.json({ success: true, winnerId });
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
