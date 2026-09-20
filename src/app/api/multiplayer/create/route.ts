// ─────────────────────────────────────────────────────────────────────────────
//  app/api/multiplayer/create/route.ts
//  Creates a 1v1 battle room: generates a fresh secret word (never the
//  creator's in-progress solo word - that would already be spoiled for
//  them), a unique 6-character room code, and persists the word into
//  battle_secrets, a table with no client-facing RLS policy at all.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { generateGameContent, VALID_CATEGORIES } from "@/lib/wordGeneration";
import type { GameCategory, BattleDifficulty } from "@/types/game";
import { VALID_DIFFICULTIES, DIFFICULTY_MAX_GUESSES, DIFFICULTY_LEVEL } from "@/types/game";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - avoids ambiguity when read aloud/typed
const ROOM_CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to play." }, { status: 401 });
  }

  let category: GameCategory = "foundations";
  let difficulty: BattleDifficulty = "medium";
  try {
    const body = await request.json();
    if (body) {
      if (VALID_CATEGORIES.includes(body.category)) category = body.category;
      if (VALID_DIFFICULTIES.includes(body.difficulty)) difficulty = body.difficulty;
    }
  } catch {
    // Empty body is fine - defaults apply.
  }

  // Word complexity is bound strictly to difficulty, not an arbitrary
  // client-supplied level - this is what makes the quota meaningful.
  const maxGuesses = DIFFICULTY_MAX_GUESSES[difficulty];
  const level = DIFFICULTY_LEVEL[difficulty];

  const adminClient = await createAdminClient();
  const { word, mysteryHook, stories, takeaways } = await generateGameContent(category, level, []);

  // Retry on the (very unlikely) chance of a room code collision.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { error: insertError } = await adminClient.from("battle_rooms").insert({
      code,
      category,
      difficulty,
      max_guesses: maxGuesses,
      status: "waiting",
      mystery_hook: mysteryHook,
      stories,
      takeaways,
      player1_id: user.id,
    });

    if (!insertError) {
      const { error: secretError } = await adminClient
        .from("battle_secrets")
        .insert({ room_code: code, word });

      if (secretError) {
        console.error("[contextle][Battle] Failed to store room secret:", secretError);
        await adminClient.from("battle_rooms").delete().eq("code", code);
        return NextResponse.json({ success: false, error: "Failed to create battle room." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        code,
        category,
        difficulty,
        maxGuesses,
        mysteryHook,
        stories,
        takeaways,
      });
    }

    // Postgres unique_violation - try a different code. Any other error is fatal.
    if (insertError.code !== "23505") {
      console.error("[contextle][Battle] Failed to create battle room:", insertError);
      return NextResponse.json({ success: false, error: "Failed to create battle room." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: "Could not allocate a room code. Please try again." }, { status: 500 });
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
