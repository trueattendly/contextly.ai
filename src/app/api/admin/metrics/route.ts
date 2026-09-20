// ─────────────────────────────────────────────────────────────────────────────
//  app/api/admin/metrics/route.ts
//  Traffic/session metrics computed from the EXISTING game_sessions and
//  profiles tables - no schema changes. Aggregated in JS (small row counts
//  at this scale), same approach as the public weekly leaderboard route.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const adminClient = await createAdminClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [todaySessionsRes, totalUsersRes] = await Promise.all([
    adminClient
      .from("game_sessions")
      .select("user_id, won, guess_count")
      .gte("created_at", todayStart.toISOString()),
    adminClient.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  if (todaySessionsRes.error) {
    console.error("[contextle][Admin] Failed to load game_sessions:", todaySessionsRes.error);
    return NextResponse.json({ success: false, error: "Failed to load metrics." }, { status: 500 });
  }

  const todaySessions = todaySessionsRes.data ?? [];
  const gamesPlayedToday = todaySessions.length;
  const activeUsersToday = new Set(todaySessions.map((s) => s.user_id)).size;
  const solvedToday = todaySessions.filter((s) => s.won);
  const avgGuessesPerSolve = solvedToday.length
    ? Math.round((solvedToday.reduce((sum, s) => sum + (s.guess_count ?? 0), 0) / solvedToday.length) * 10) / 10
    : null;

  return NextResponse.json({
    success: true,
    gamesPlayedToday,
    activeUsersToday,
    avgGuessesPerSolve,
    totalRegisteredUsers: totalUsersRes.count ?? null,
  });
}
