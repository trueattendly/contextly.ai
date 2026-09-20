// ─────────────────────────────────────────────────────────────────────────────
//  lib/feedback.ts
//  In-memory user feedback inbox - same "zero DB migration" trade-off as
//  telemetry.ts: capped ring buffer, per-instance, resets on cold start.
//  If durability matters, a single `feedback` table would be a trivial
//  follow-up migration - deliberately not added here since it wasn't asked for.
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackEntry {
  id: string;
  timestamp: number;
  message: string;
  email: string | null;
  page: string | null;
  userId: string | null;
}

const MAX_ENTRIES = 200;
const entries: FeedbackEntry[] = [];

export function recordFeedback(entry: Omit<FeedbackEntry, "id" | "timestamp">): FeedbackEntry {
  const full: FeedbackEntry = { ...entry, id: crypto.randomUUID(), timestamp: Date.now() };
  entries.unshift(full);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  return full;
}

export function getFeedback(): FeedbackEntry[] {
  return entries;
}
