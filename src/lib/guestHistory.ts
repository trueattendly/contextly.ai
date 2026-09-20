// ─────────────────────────────────────────────────────────────────────────────
//  lib/guestHistory.ts
//  Client-side localStorage history for unauthenticated visitors.
//
//  Honest caveat: as of this writing, every gameplay route (/api/guess,
//  /api/multiplayer/guess) requires an authenticated Supabase session before
//  it will evaluate a guess - there is currently no code path where a guest
//  actually plays a round. `recordGuestHistoryEntry` is exported so a future
//  no-login play mode can call it, but nothing calls it today, so this will
//  render an empty state in practice, not because of a bug but because
//  there's nothing to read yet.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameSessionEntry } from "@/types/game";

const STORAGE_KEY = "contextle_guest_history";

export interface GuestHistoryEntry extends GameSessionEntry {
  synced?: boolean;
}

export function getGuestHistory(): GuestHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Not currently called anywhere - see module note above.
export function recordGuestHistoryEntry(entry: Omit<GuestHistoryEntry, "id">): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getGuestHistory();
    const full: GuestHistoryEntry = { ...entry, id: crypto.randomUUID() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([full, ...existing]));
  } catch {
    // Storage full/unavailable - losing a local history entry isn't worth surfacing an error for.
  }
}

export function clearGuestHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

// Pushes any locally-stored guest games into Supabase under the now-signed-in
// user's id, then clears local storage so they aren't pushed twice on a
// later login. Safe to call on every login - it's a no-op when empty.
export async function syncGuestHistoryToDatabase(): Promise<{ synced: number }> {
  const entries = getGuestHistory();
  if (entries.length === 0) return { synced: 0 };

  try {
    const res = await fetch("/api/history/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      clearGuestHistory();
      return { synced: data.synced ?? entries.length };
    }
  } catch {
    // Network error - leave local entries in place to retry on next login.
  }
  return { synced: 0 };
}
