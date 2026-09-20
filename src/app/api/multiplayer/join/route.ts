// ─────────────────────────────────────────────────────────────────────────────
//  app/api/multiplayer/join/route.ts
//  Pairs the caller as player 2 on a waiting battle room and starts the
//  match clock. The atomic conditional UPDATE (status='waiting' AND
//  player2_id IS NULL) is what prevents two simultaneous joiners from both
//  succeeding on the same room.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to play." }, { status: 401 });
  }

  let rawCode: unknown;
  try {
    const body = await request.json();
    rawCode = body?.code;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (typeof rawCode !== "string" || !rawCode.trim()) {
    return NextResponse.json({ success: false, error: "A room 'code' is required." }, { status: 400 });
  }
  const code = rawCode.trim().toUpperCase();

  const adminClient = await createAdminClient();

  const { data: room, error: fetchError } = await adminClient
    .from("battle_rooms")
    .select("code, status, category, difficulty, max_guesses, player1_id, player2_id, mystery_hook, stories, takeaways")
    .eq("code", code)
    .single();

  if (fetchError || !room) {
    return NextResponse.json({ success: false, error: "Room not found." }, { status: 404 });
  }

  if (room.player1_id === user.id) {
    return NextResponse.json({ success: false, error: "You can't join your own room." }, { status: 400 });
  }

  if (room.status !== "waiting" || room.player2_id) {
    // Someone already in this room is the same person reconnecting - let them back in.
    if (room.player2_id === user.id) {
      return NextResponse.json({
        success: true,
        code: room.code,
        category: room.category,
        difficulty: room.difficulty,
        maxGuesses: room.max_guesses,
        mysteryHook: room.mystery_hook,
        stories: room.stories,
        takeaways: room.takeaways,
      });
    }
    return NextResponse.json({ success: false, error: "This room is no longer joinable." }, { status: 409 });
  }

  const { data: updatedRoom, error: updateError } = await adminClient
    .from("battle_rooms")
    .update({ player2_id: user.id, status: "active", started_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "waiting")
    .is("player2_id", null)
    .select("code, category, difficulty, max_guesses, mystery_hook, stories, takeaways")
    .single();

  if (updateError || !updatedRoom) {
    return NextResponse.json({ success: false, error: "This room was just taken. Try another code." }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    code: updatedRoom.code,
    category: updatedRoom.category,
    difficulty: updatedRoom.difficulty,
    maxGuesses: updatedRoom.max_guesses,
    mysteryHook: updatedRoom.mystery_hook,
    stories: updatedRoom.stories,
    takeaways: updatedRoom.takeaways,
  });
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
