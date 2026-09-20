// ─────────────────────────────────────────────────────────────────────────────
//  types/game.ts – Shared TypeScript types for the Contextle game
// ─────────────────────────────────────────────────────────────────────────────

export type GameCategory = "foundations" | "science" | "finance" | "advanced";

export const GAME_CATEGORY_LABELS: Record<GameCategory, string> = {
  foundations: "Foundations",
  science: "Science & Nature",
  finance: "Money & Markets",
  advanced: "Advanced Concepts",
};

// ─── Battle difficulty (1v1 quota engine) ──────────────────────────────────
export type BattleDifficulty = "easy" | "medium" | "hard";
export const VALID_DIFFICULTIES: BattleDifficulty[] = ["easy", "medium", "hard"];
export const DIFFICULTY_LABELS: Record<BattleDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const DIFFICULTY_MAX_GUESSES: Record<BattleDifficulty, number> = {
  easy: 10,
  medium: 15,
  hard: 20,
};

// Maps a battle difficulty onto the same level-number vocabulary bands the
// word-generation prompt defines, so word complexity is deterministic
// rather than left to whatever level a player happened to be on solo.
export const DIFFICULTY_LEVEL: Record<BattleDifficulty, number> = {
  easy: 3,    // "Very common everyday nouns" band (1-5)
  medium: 15, // "Educational, scientific, historical, geographical nouns" band (11-20)
  hard: 55,   // "Rare, university-level vocabulary" band (51-70)
};

export type FeedbackTier = "Exact" | "Synonym" | "Scorching" | "Hot" | "Warm" | "Cool" | "Ice";

// Derived server-side from rank/win state - kept deterministic rather than
// left to the model, since the rank bands are already fixed by the prompt.
export function getFeedbackTier(rank: number, isCorrect: boolean, isSynonymWin: boolean): FeedbackTier {
  if (isCorrect) return "Exact";
  if (isSynonymWin) return "Synonym";
  if (rank <= 20) return "Scorching";
  if (rank <= 100) return "Hot";
  if (rank <= 300) return "Warm";
  if (rank <= 600) return "Cool";
  return "Ice";
}

// Formats a duration in seconds as MM:SS (or H:MM:SS past an hour) -
// used by both the gameplay timer and the weekly leaderboard's fastest-time column.
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return "--:--";
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Relative date formatting for history cards - "Just now" / "5m ago" /
// "Yesterday" / "3 days ago" / falls back to a plain date past ~a month.
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.round(diffDay / 7)}w ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// One row from `game_sessions` - a completed solo round or a finished
// battle's outcome, shaped for the /history page.
export interface GameSessionEntry {
  id: string;
  mode: "solo" | "battle";
  won: boolean;
  timeTakenSeconds: number | null;
  guessCount: number;
  category: GameCategory | null;
  secretWord: string | null;
  takeaways: [string, string, string] | null;
  maxGuesses: number | null;
  createdAt: string;
}

// The "Aha!" card revealed only once a level is solved (exact match or synonym win).
export interface ConceptReveal {
  category: GameCategory;
  mysteryHook: string;
  takeaways: [string, string, string];
}

export interface GuessResponse {
  success: boolean;
  word: string;
  rank: number;
  similarityPercentage: number;
  isCorrect: boolean;
  isSynonymWin?: boolean;
  feedback?: FeedbackTier;
  learningInsight?: string; // Short conceptual why-this-is-close/far note
  concept?: ConceptReveal;  // Present only on a win (isCorrect or isSynonymWin)
  error?: string;
  newLevel?: number; // Returned when the user levels up
}

export interface GuessEntry extends GuessResponse {
  id: string;       // unique ID for Framer Motion keying
  timestamp: number;
}

export type RankTier = "hot" | "warm" | "cold" | "ice";

export function getRankTier(rank: number): RankTier {
  if (rank <= 50)  return "hot";
  if (rank <= 200) return "warm";
  if (rank <= 500) return "cold";
  return "ice";
}

export function getRankLabel(rank: number): string {
  if (rank === 1)   return "Exact Match";
  if (rank <= 10)  return "Scorching";
  if (rank <= 50)  return "Very Hot";
  if (rank <= 100) return "Warm";
  if (rank <= 200) return "Cool";
  if (rank <= 500) return "Cold";
  return "Freezing";
}

export function getRankColor(rank: number): string {
  if (rank <= 50)  return "text-peach";
  if (rank <= 200) return "text-peach-light";
  if (rank <= 500) return "text-peach/70";
  return "text-peach/50";
}

export function getRankBarClass(rank: number): string {
  if (rank <= 50)  return "rank-hot";
  if (rank <= 200) return "rank-warm";
  if (rank <= 500) return "rank-cold";
  return "rank-ice";
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  current_level: number;
  active_word?: string | null;
  current_story?: string | null;
  updated_at: string;
}

// ─── Game Level (matches Supabase `game_levels` table) ────────────────────
export interface GameLevel {
  level_number: number;
  secret_word: string;
  difficulty: "easy" | "medium" | "hard";
}

// ─── Active word content stored (as JSON) in `profiles.current_story` ─────
// Kept as a single JSON text column rather than new tables/columns to avoid
// a migration - this is the full payload generated alongside the secret word.
export interface GameContent {
  category: GameCategory;
  mysteryHook: string;
  stories: string[];
  takeaways: [string, string, string];
}

function defaultGameContent(fallbackText: string): GameContent {
  return {
    category: "foundations",
    mysteryHook: fallbackText,
    stories: fallbackText ? [fallbackText] : [],
    takeaways: [fallbackText, "", ""],
  };
}

// Parses `profiles.current_story`. Tolerates the legacy shape (a plain JSON
// array of clue strings), malformed/partial JSON, and unexpected value
// types - always resolves to a valid GameContent (never throws) so a
// corrupt or pre-upgrade row can't crash the guess/generate-word routes or
// the page render. Returns null only when there is no active word at all.
export function parseGameContent(raw: string | null | undefined): GameContent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const stories = parsed.map((s) => String(s));
      return {
        category: "foundations",
        mysteryHook: stories[0] ?? "",
        stories,
        takeaways: [stories[0] ?? "", stories[1] ?? "", stories[2] ?? ""],
      };
    }
    if (parsed && typeof parsed === "object") {
      const stories = Array.isArray(parsed.stories) ? parsed.stories.map((s: unknown) => String(s)) : [];
      return {
        category: (["foundations", "science", "finance", "advanced"] as const).includes(parsed.category)
          ? parsed.category
          : "foundations",
        mysteryHook: typeof parsed.mysteryHook === "string" ? parsed.mysteryHook : stories[0] ?? "",
        stories,
        takeaways: Array.isArray(parsed.takeaways) && parsed.takeaways.length === 3
          ? [String(parsed.takeaways[0]), String(parsed.takeaways[1]), String(parsed.takeaways[2])]
          : [stories[0] ?? "", stories[1] ?? "", stories[2] ?? ""],
      };
    }
    // Valid JSON, but neither an array nor an object (e.g. a bare string/number) -
    // treat the raw text itself as the content rather than silently dropping it.
    return defaultGameContent(String(parsed ?? raw));
  } catch {
    // Not valid JSON at all - oldest legacy rows stored a plain clue string.
    return defaultGameContent(raw);
  }
}
