// ─────────────────────────────────────────────────────────────────────────────
//  app/api/multiplayer/guess/route.ts
//  Evaluates a battle guess with the same evaluator used by solo play, then
//  writes ONLY rank/guess-count columns back to battle_rooms - the guessed
//  word itself is never persisted anywhere the opponent's client can read,
//  and the room's realtime UPDATE event (which the opponent is subscribed
//  to) is built entirely from those safe columns.
//
//  Difficulty-quota engine: each room has a max_guesses quota (10/15/20 for
//  easy/medium/hard, set at creation). A guess is rejected outright once a
//  player's own quota is used up. If a player hits Rank 1 / a synonym win,
//  they win immediately. Otherwise, once BOTH players have exhausted their
//  quota without either solving it, the match is resolved by best rank
//  (lower wins), tie-broken by whoever exhausted their quota first - the
//  only per-player timestamp available to compare "elapsed time" by, since
//  battle rounds don't keep a full per-guess history (see note below).
//
//  Known simplification vs. solo mode: battle rounds don't keep a per-guess
//  history, so there's no "already guessed that" dedupe and no rank
//  monotonicity anchor across a player's own guesses within a room. Adding
//  either would need a battle_guesses table, which isn't justified for a
//  1v1 round that already ends in a handful of guesses.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { evaluateGuess, NoAiProviderError, sanitizeGuessWord } from "@/lib/guessEvaluator";
import type { GuessResponse } from "@/types/game";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to play." }, { status: 401 });
  }

  let body: { code?: unknown; word?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ success: false, error: "A room 'code' is required." }, { status: 400 });
  }
  if (typeof body.word !== "string" || !body.word.trim()) {
    return NextResponse.json({ success: false, error: "A 'word' field is required." }, { status: 400 });
  }

  const code = body.code.trim().toUpperCase();
  const guess = sanitizeGuessWord(body.word);
  if (!guess) {
    return NextResponse.json({ success: false, error: "Invalid word input." }, { status: 400 });
  }

  const adminClient = await createAdminClient();

  const { data: room, error: roomError } = await adminClient
    .from("battle_rooms")
    .select(
      "code, status, category, takeaways, max_guesses, player1_id, player2_id, player1_best_rank, player1_guess_count, player1_quota_exhausted_at, player2_best_rank, player2_guess_count, player2_quota_exhausted_at, started_at"
    )
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

  const myGuessCount = isPlayer1 ? room.player1_guess_count : room.player2_guess_count;
  if (myGuessCount >= room.max_guesses) {
    return NextResponse.json(
      { success: false, isQuotaExhausted: true, error: "You've used all your guesses for this round." },
      { status: 409 }
    );
  }

  const { data: secret, error: secretError } = await adminClient
    .from("battle_secrets")
    .select("word")
    .eq("room_code", code)
    .single();

  if (secretError || !secret) {
    console.error("[contextle][Battle] Failed to load room secret:", secretError);
    return NextResponse.json({ success: false, error: "This battle's secret word could not be loaded." }, { status: 500 });
  }

  try {
    const result = await evaluateGuess(secret.word.toLowerCase(), guess, null);

    const prevBestRank = isPlayer1 ? room.player1_best_rank : room.player2_best_rank;
    const otherGuessCount = isPlayer1 ? room.player2_guess_count : room.player1_guess_count;
    const otherBestRank = isPlayer1 ? room.player2_best_rank : room.player1_best_rank;
    const otherQuotaExhaustedAt = isPlayer1 ? room.player2_quota_exhausted_at : room.player1_quota_exhausted_at;

    const newGuessCount = myGuessCount + 1;
    const newBestRank = prevBestRank == null ? result.rank : Math.min(prevBestRank, result.rank);
    const won = result.isCorrect || result.isSynonymWin;
    const justExhaustedQuota = !won && newGuessCount >= room.max_guesses;
    const nowIso = new Date().toISOString();

    const progressUpdate: Record<string, unknown> = isPlayer1
      ? { player1_last_rank: result.rank, player1_best_rank: newBestRank, player1_guess_count: newGuessCount }
      : { player2_last_rank: result.rank, player2_best_rank: newBestRank, player2_guess_count: newGuessCount };
    if (justExhaustedQuota) {
      progressUpdate[isPlayer1 ? "player1_quota_exhausted_at" : "player2_quota_exhausted_at"] = nowIso;
    }

    let finished = false;
    let winnerId: string | null = null;
    let finalizeUpdate: Record<string, unknown> | null = null;

    if (won) {
      winnerId = user.id;
      finalizeUpdate = { ...progressUpdate, status: "finished", winner_id: winnerId, solved_word: secret.word.toLowerCase(), finished_at: nowIso };
    } else if (justExhaustedQuota && otherGuessCount >= room.max_guesses) {
      // Mutual quota exhaustion, neither player solved it - resolve by best
      // rank (lower wins), tie-broken by who exhausted their quota first.
      if (otherBestRank == null || newBestRank < otherBestRank) {
        winnerId = user.id;
      } else if (newBestRank > otherBestRank) {
        winnerId = isPlayer1 ? room.player2_id : room.player1_id;
      } else {
        const myExhaustedAt = new Date(nowIso).getTime();
        const otherExhaustedAt = otherQuotaExhaustedAt ? new Date(otherQuotaExhaustedAt).getTime() : Infinity;
        winnerId = myExhaustedAt <= otherExhaustedAt ? user.id : (isPlayer1 ? room.player2_id : room.player1_id);
      }
      finalizeUpdate = { ...progressUpdate, status: "finished", winner_id: winnerId, solved_word: secret.word.toLowerCase(), finished_at: nowIso };
    }

    if (finalizeUpdate) {
      // Guard with .eq("status","active") so a near-simultaneous resolution
      // from the opponent's request can't both finalize the room.
      const { data: finishedRoom, error: finishError } = await adminClient
        .from("battle_rooms")
        .update(finalizeUpdate)
        .eq("code", code)
        .eq("status", "active")
        .select("code")
        .single();

      finished = Boolean(finishedRoom) && !finishError;

      if (finished && winnerId) {
        const timeTakenSeconds = room.started_at
          ? Math.max(0, Math.round((Date.now() - new Date(room.started_at).getTime()) / 1000))
          : null;
        try {
          await adminClient.from("game_sessions").insert({
            user_id: winnerId,
            mode: "battle",
            won: true,
            time_taken_seconds: timeTakenSeconds,
            guess_count: winnerId === user.id ? newGuessCount : otherGuessCount,
            category: room.category ?? null,
            secret_word: secret.word.toLowerCase(),
            takeaways: room.takeaways ?? null,
            max_guesses: room.max_guesses,
          });
        } catch (err) {
          console.warn("[contextle][Battle] Failed to insert into game_sessions:", err);
        }
      } else if (!finished) {
        // Lost the race to finalize - the opponent's concurrent request
        // already resolved the room. Still record our own progress.
        await adminClient.from("battle_rooms").update(progressUpdate).eq("code", code);
      }
    } else {
      await adminClient.from("battle_rooms").update(progressUpdate).eq("code", code);
    }

    return NextResponse.json<GuessResponse & { battleWon: boolean; isQuotaExhausted: boolean }>({
      success: true,
      word: guess,
      ...result,
      battleWon: won && finished && winnerId === user.id,
      isQuotaExhausted: justExhaustedQuota,
    });
  } catch (error) {
    if (error instanceof NoAiProviderError) {
      return NextResponse.json(
        { success: false, error: "Semantic evaluation service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
    console.error("[contextle][Battle] Guess evaluation failed:", error);
    return NextResponse.json(
      { success: false, error: "Semantic evaluation service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
