// ─────────────────────────────────────────────────────────────────────────────
//  app/api/multiplayer/room/[code]/route.ts
//  Fetches a battle room plus resolved display names for both players. Uses
//  the caller's own session-scoped client (not the admin client) for both
//  queries: the existing "Players can view their own battle room" RLS
//  policy already enforces "only player1/player2 may read this room" - the
//  same access control the battle page already relies on for a bare room
//  fetch - and `profiles` is public-readable by policy, so no service-role
//  bypass is needed for either query.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

// Fallback order: `username` -> `display_name` (this schema's `profiles`
// table has no separate `full_name` column - `display_name` already IS the
// resolved Google full_name/name, populated at signup in
// src/app/auth/callback/route.ts) -> the local part of `email` -> a
// positional "Player N" label. Never returns an empty/null/undefined name.
function resolveName(profile: ProfileRow | undefined, positionalFallback: string): string {
  const username = profile?.username?.trim();
  if (username) return username;

  const displayName = profile?.display_name?.trim();
  if (displayName) return displayName;

  const emailPrefix = profile?.email?.split("@")[0]?.trim();
  if (emailPrefix) return emailPrefix;

  return positionalFallback;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "You must be logged in to play." }, { status: 401 });
  }

  const { code: rawCode } = await context.params;
  const code = rawCode?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ success: false, error: "A room code is required." }, { status: 400 });
  }

  // RLS makes this return no row at all for a room the caller hasn't joined
  // yet - the same "not found" outcome the battle page already treats as
  // "show the Join button" for a brand-new code, so no separate 403 needed.
  const { data: room, error: roomError } = await supabase
    .from("battle_rooms")
    .select("*")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ success: false, error: "Room not found." }, { status: 404 });
  }

  const playerIds = [room.player1_id, room.player2_id].filter((id): id is string => Boolean(id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, email")
    .in("id", playerIds);

  const profilesById = new Map((profiles ?? []).map((p) => [p.id as string, p as ProfileRow]));

  const player1 = { id: room.player1_id as string, name: resolveName(profilesById.get(room.player1_id), "Player 1") };
  const player2 = room.player2_id
    ? { id: room.player2_id as string, name: resolveName(profilesById.get(room.player2_id), "Player 2") }
    : null;

  return NextResponse.json({ success: true, room, player1, player2 });
}

// Reject all other HTTP methods
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
