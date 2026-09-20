import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { generateGameContent, VALID_CATEGORIES } from "@/lib/wordGeneration";
import type { GameCategory } from "@/types/game";
import { parseGameContent } from "@/types/game";

// ── DB-Backed Rate Limiting (per user, serverless-safe) ──
async function checkDbRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  maxRequests = 5,
  windowMs = 60000
): Promise<boolean> {
  try {
    const now = new Date();
    const { data: limitData, error } = await adminClient
      .from("user_rate_limits")
      .select("request_count, window_start")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 is PostgreSQL code for zero rows returned
      console.warn("[contextle] Error reading user_rate_limits table:", error.message);
      return false; // Bypass rate limit if query fails (graceful degradation)
    }

    if (!limitData) {
      const { error: insertError } = await adminClient
        .from("user_rate_limits")
        .insert({
          user_id: userId,
          request_count: 1,
          window_start: now.toISOString()
        });
      if (insertError) console.warn("[contextle] Error inserting into user_rate_limits:", insertError.message);
      return false;
    }

    const windowStart = new Date(limitData.window_start);
    const diffMs = now.getTime() - windowStart.getTime();

    if (diffMs > windowMs) {
      const { error: updateError } = await adminClient
        .from("user_rate_limits")
        .update({
          request_count: 1,
          window_start: now.toISOString()
        })
        .eq("user_id", userId);
      if (updateError) console.warn("[contextle] Error resetting user_rate_limits:", updateError.message);
      return false;
    }

    if (limitData.request_count >= maxRequests) {
      return true; // Rate limited!
    }

    const { error: incError } = await adminClient
      .from("user_rate_limits")
      .update({
        request_count: limitData.request_count + 1
      })
      .eq("user_id", userId);
    if (incError) console.warn("[contextle] Error incrementing user_rate_limits:", incError.message);

    return false;
  } catch (err) {
    console.warn("[contextle] DB rate limit check bypassed:", err);
    return false; // Graceful degradation
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/generate-word - API route to generate a new word
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify Supabase session authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to play." }, { status: 401 });
  }

  // 2. Fetch user's current level & atomically acquire lock
  const adminClient = await createAdminClient();

  // DB-Backed Rate Limiting Check (Serverless/Edge safe)
  const rateLimited = await checkDbRateLimit(adminClient, user.id);
  if (rateLimited) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a minute before generating another word." },
      { status: 429 }
    );
  }

  // Atomically acquire generation lock
  // Update profiles table, setting active_word to "generating" only if it is currently null
  const { data: lockProfile } = await adminClient
    .from("profiles")
    .update({
      active_word: "generating",
      updated_at: new Date().toISOString()
    })
    .eq("id", user.id)
    .is("active_word", null)
    .select("current_level, active_word, current_story, updated_at");

  let profile = lockProfile && lockProfile.length > 0 ? lockProfile[0] : null;

  if (!profile) {
    // Fetch the profile to see if it is already generating or has a word
    const { data: existingProfile, error: fetchError } = await adminClient
      .from("profiles")
      .select("current_level, active_word, current_story, updated_at")
      .eq("id", user.id)
      .single();

    if (fetchError || !existingProfile) {
      return NextResponse.json({ success: false, error: "Profile not found." }, { status: 404 });
    }

    if (existingProfile.active_word === "generating") {
      const updatedAt = existingProfile.updated_at ? new Date(existingProfile.updated_at).getTime() : 0;
      const lockAgeMs = Date.now() - updatedAt;

      // Break stuck serverless timeout locks older than 2 minutes (120,000ms)
      if (lockAgeMs > 120000) {
        console.warn("[contextle] Auto-breaking stuck serverless lock older than 2 minutes.");
        const { data: breakLockProfile } = await adminClient
          .from("profiles")
          .update({
            active_word: "generating",
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id)
          .select("current_level, active_word, current_story, updated_at");

        if (breakLockProfile && breakLockProfile.length > 0) {
          profile = breakLockProfile[0];
        } else {
          profile = existingProfile;
        }
      } else {
        return NextResponse.json(
          { success: false, error: "A word is already being generated for you. Please wait." },
          { status: 409 }
        );
      }
    }

    // If a word is already generated, return it immediately to resolve the race condition
    if (profile === null && existingProfile.active_word && existingProfile.current_story) {
      const content = parseGameContent(existingProfile.current_story);
      if (content) {
        return NextResponse.json({ success: true, ...content });
      }
    }

    if (!profile) {
      profile = existingProfile;
    }
  }

  let excludeWords: string[] = [];
  let reqLevel: number | null = null;
  let category: GameCategory = "foundations";
  try {
    const body = await request.json();
    if (body) {
      if (Array.isArray(body.excludeWords)) {
        excludeWords = body.excludeWords.map((w: unknown) => String(w).trim().toLowerCase()).filter(Boolean);
      }
      if (typeof body.level === "number") {
        reqLevel = Math.round(body.level);
      }
      if (VALID_CATEGORIES.includes(body.category)) {
        category = body.category;
      }
    }
  } catch {
    // Prevent throwing an error if body is empty
  }

  const currentLevel = reqLevel !== null ? reqLevel : profile.current_level;

  // 3. Fetch played words server-side from played_words table (Optimized: limit to last 25)
  let dbPlayedWords: string[] = [];
  try {
    const { data: playedData } = await adminClient
      .from("played_words")
      .select("word")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(25);
    if (playedData) {
      dbPlayedWords = playedData.map(row => row.word.trim().toLowerCase());
    }
  } catch (err) {
    console.warn("[contextle] played_words table not available (can be created using SQL):", err);
  }

  const allExcluded = Array.from(new Set([...excludeWords, ...dbPlayedWords]));

  // generateGameContent never throws - it falls back to a local hand-authored
  // pair internally if every AI provider tier is exhausted.
  const { word: cleanWord, mysteryHook, stories, takeaways } = await generateGameContent(
    category,
    currentLevel,
    allExcluded
  );

  const serializedContent = JSON.stringify({ category, mysteryHook, stories, takeaways });

  console.log("[contextle][DB] Saving generated content to profile:", {
    id: user.id,
    active_word: cleanWord,
    category,
    stories_count: stories.length
  });

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      active_word: cleanWord,
      current_story: serializedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[contextle] Failed to save generated word to profile:", updateError);
    await adminClient.from("profiles").update({ active_word: null }).eq("id", user.id).eq("active_word", "generating");
    return NextResponse.json(
      { success: false, error: "Failed to start game in database." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    category,
    mysteryHook,
    stories,
    takeaways,
  });
}

// Reject all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
