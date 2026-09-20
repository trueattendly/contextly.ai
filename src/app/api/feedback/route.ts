// ─────────────────────────────────────────────────────────────────────────────
//  app/api/feedback/route.ts
//  Public feedback submission - open to every visitor, signed in or not.
//  Stored in-memory (see lib/feedback.ts) rather than a new table, per the
//  "zero DB migration" scope of this pass.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { recordFeedback } from "@/lib/feedback";

const MAX_MESSAGE_LENGTH = 2000;

// Simple per-IP throttle - feedback is public and unauthenticated, so this
// is the only practical abuse guard available without new infrastructure.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  let body: { message?: unknown; email?: unknown; page?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!message) {
    return NextResponse.json({ success: false, error: "A 'message' field is required." }, { status: 400 });
  }
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 200) : null;
  const page = typeof body.page === "string" ? body.page.trim().slice(0, 200) : null;

  // Attach the user id when signed in, but feedback works for anonymous visitors too.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Not signed in / auth check failed - feedback is still accepted anonymously.
  }

  recordFeedback({ message, email, page, userId });
  return NextResponse.json({ success: true });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
