// ─────────────────────────────────────────────────────────────────────────────
//  app/api/guess/route.ts
//  Secure server-side Route Handler:
//   1. Validates user session via Supabase
//   2. Fetches current level's secret word from DB
//   3. Evaluates semantic similarity via AI providers (server-side only)
//   4. On correct guess, advances the user to the next level in DB
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import type { GuessResponse, ConceptReveal } from "@/types/game";
import { parseGameContent } from "@/types/game";
import { evaluateGuess, NoAiProviderError, sanitizeGuessWord } from "@/lib/guessEvaluator";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Security: rate-limit map (per-user, in-memory, resets on cold start) ─────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60;           // max guesses per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// A client-reported elapsed time is inherently unverifiable (there's no
// server-side clock anchor for solo games), but it's clamped to a sane range
// so a bad/negative value from the client can't corrupt the leaderboard.
function clampTimeTakenSeconds(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.min(24 * 60 * 60, Math.max(0, Math.round(raw)));
}

// ── Advance the user to the next level, clear the active word, record the
//    round in game_sessions for the weekly leaderboard, and build the
//    "Aha!" concept reveal card shown on the Victory modal (exact match or
//    synonym win both count as solving the level). ─────────────────────────
async function advanceLevel(
  adminClient: SupabaseClient,
  userId: string,
  currentLevel: number,
  guess: string,
  secretWord: string,
  rawContent: string | null,
  guessCount: number,
  timeTakenSeconds: number | null
): Promise<{ newLevel: number; concept: ConceptReveal }> {
  const newLevel = currentLevel + 1;
  const content = parseGameContent(rawContent);

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      current_level: newLevel,
      active_word: null,
      current_story: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("[contextle] Failed to advance level:", updateError);
  }

  try {
    await adminClient.from("played_words").insert({ user_id: userId, word: guess });
  } catch (err) {
    console.warn(
      "[contextle] Failed to insert into played_words table (might not exist):",
      err
    );
  }

  try {
    await adminClient.from("game_sessions").insert({
      user_id: userId,
      mode: "solo",
      won: true,
      time_taken_seconds: timeTakenSeconds,
      guess_count: guessCount,
      category: content?.category ?? null,
      secret_word: secretWord,
      takeaways: content?.takeaways ?? null,
    });
  } catch (err) {
    console.warn("[contextle] Failed to insert into game_sessions (might not exist):", err);
  }

  return {
    newLevel,
    concept: {
      category: content?.category ?? "foundations",
      mysteryHook: content?.mysteryHook ?? "",
      takeaways: content?.takeaways ?? ["", "", ""],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/guess
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate - verify active Supabase session ───────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "You must be logged in to play." },
      { status: 401 }
    );
  }

  // ── 2. Rate Limiting (per user) ────────────────────────────────────────────
  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Slow down, genius!" },
      { status: 429 }
    );
  }

  // ── 3. Parse & Validate Body ───────────────────────────────────────────────
  let body: {
    word?: unknown;
    level?: unknown;
    guessedWords?: unknown;
    bestPriorGuess?: unknown;
    timeTakenSeconds?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (typeof body.word !== "string" || body.word.trim() === "") {
    return NextResponse.json(
      { success: false, error: "A 'word' field is required." },
      { status: 400 }
    );
  }

  const guess = sanitizeGuessWord(body.word);
  if (!guess) {
    return NextResponse.json(
      { success: false, error: "Invalid word input." },
      { status: 400 }
    );
  }

  const guessedWords = Array.isArray(body.guessedWords) ? body.guessedWords : [];
  if (guessedWords.includes(guess)) {
    return NextResponse.json(
      {
        success: false,
        error: `Already guessed "${guess}"`,
      },
      { status: 400 }
    );
  }

  const requestedLevel =
    typeof body.level === "number" ? Math.round(body.level) : null;
  const timeTakenSeconds = clampTimeTakenSeconds(body.timeTakenSeconds);

  // Extract optional calibration anchor to maintain ordinal monotonicity
  let bestPriorAnchor: { word: string; rank: number } | null = null;
  if (
    body.bestPriorGuess &&
    typeof body.bestPriorGuess === "object" &&
    "word" in body.bestPriorGuess &&
    "rank" in body.bestPriorGuess
  ) {
    const bg = body.bestPriorGuess as { word: unknown; rank: unknown };
    if (
      typeof bg.word === "string" &&
      typeof bg.rank === "number" &&
      bg.rank > 1 &&
      bg.rank < 1000
    ) {
      bestPriorAnchor = {
        word: sanitizeGuessWord(bg.word),
        rank: Math.round(bg.rank),
      };
    }
  }

  // ── 4. Fetch user's current level and active word from DB ─────────────────
  const adminClient = await createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("current_level, active_word, current_story")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[contextle] Failed to fetch profile:", profileError);
    return NextResponse.json(
      { success: false, error: "Profile not found. Please re-login." },
      { status: 404 }
    );
  }

  const currentLevel = profile.current_level;

  // Validate: the user can only guess for their current level
  if (requestedLevel !== null && requestedLevel !== currentLevel) {
    return NextResponse.json(
      {
        success: false,
        error: "Level mismatch. Please refresh the page.",
      },
      { status: 409 }
    );
  }

  // ── 5. Check if user has an active word generated ──────────────────────────
  if (!profile.active_word) {
    return NextResponse.json(
      {
        success: false,
        error: "No active word found for this level. Please click 'Take the Word' first.",
      },
      { status: 400 }
    );
  }

  const secretWord = profile.active_word.toLowerCase();
  const guessCount = guessedWords.length + 1;

  // ── 6. Semantic Evaluation (shared with /api/multiplayer/guess) ────────────
  try {
    const result = await evaluateGuess(secretWord, guess, bestPriorAnchor);

    if (result.isCorrect || result.isSynonymWin) {
      const { newLevel, concept } = await advanceLevel(
        adminClient,
        user.id,
        currentLevel,
        guess,
        secretWord,
        profile.current_story,
        guessCount,
        timeTakenSeconds
      );

      return NextResponse.json<GuessResponse>({
        success: true,
        word: guess,
        ...result,
        concept,
        newLevel,
      });
    }

    return NextResponse.json<GuessResponse>({
      success: true,
      word: guess,
      ...result,
    });
  } catch (error) {
    if (error instanceof NoAiProviderError) {
      return NextResponse.json(
        { success: false, error: "Semantic evaluation service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
    console.error("[contextle][Guess] All AI providers failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Semantic evaluation service temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
