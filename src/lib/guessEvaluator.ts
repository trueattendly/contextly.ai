// ─────────────────────────────────────────────────────────────────────────────
//  lib/guessEvaluator.ts
//  Shared semantic-guess evaluation - used by both /api/guess (solo) and
//  /api/multiplayer/guess (battle), so the two modes always score guesses
//  identically. Contains no persistence - callers own what happens on a win.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIProvider } from "@/lib/aiProvider";
import type { FeedbackTier } from "@/types/game";
import { getFeedbackTier } from "@/types/game";

export interface BestPriorAnchor {
  word: string;
  rank: number;
}

// Strip XML/HTML tags, non-alpha characters, trim, lowercase - shared by
// every route that accepts a raw guess/word string from a client.
export function sanitizeGuessWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z\s'-]/g, "")
    .substring(0, 64);
}

export interface GuessEvaluation {
  rank: number;
  similarityPercentage: number;
  isCorrect: boolean;
  isSynonymWin: boolean;
  feedback: FeedbackTier;
  learningInsight: string;
}

// Thrown when no AI provider key is configured at all - callers should map
// this to a 503 "temporarily unavailable" response.
export class NoAiProviderError extends Error {
  constructor() {
    super("No AI provider API keys configured.");
    this.name = "NoAiProviderError";
  }
}

function hasAnyAiProviderKey(): boolean {
  return Boolean(
    process.env.CEREBRAS_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.SAMBANOVA_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );
}

export async function evaluateGuess(
  secretWord: string,
  guess: string,
  bestPriorAnchor: BestPriorAnchor | null
): Promise<GuessEvaluation> {
  if (guess === secretWord) {
    return {
      rank: 1,
      similarityPercentage: 100,
      isCorrect: true,
      isSynonymWin: false,
      feedback: getFeedbackTier(1, true, false),
      learningInsight: "Exact match - mystery solved!",
    };
  }

  if (!hasAnyAiProviderKey()) {
    console.error("[contextle] No AI provider API keys configured.");
    throw new NoAiProviderError();
  }

  const prompt = `
You are the semantic evaluation engine for Contextle, a hot/cold word deduction game.
Your task is to calculate the precise semantic distance between the TARGET word and the GUESS word.

<TARGET_CONTEXT>
Word: "${secretWord}"
</TARGET_CONTEXT>

<USER_GUESS>
"${guess}"
</USER_GUESS>
${
  bestPriorAnchor
    ? `
<CALIBRATION_ANCHOR>
Player's previous closest guess: "${bestPriorAnchor.word}" (Rank: ${bestPriorAnchor.rank}).
Use this anchor to maintain strict monotonicity. If the current GUESS is semantically closer to TARGET than "${bestPriorAnchor.word}", its rank MUST be < ${bestPriorAnchor.rank}.
</CALIBRATION_ANCHOR>`
    : ""
}

SCORING RULES:
1. POLARITY & ANTONYM PENALTY:
   - Antonyms, opposites, and inverse concepts (e.g. fire/water, cold/hot, dead/alive, love/hate) share topical context but have OPPOSITE polarity.
   - You MUST penalize antonyms: assign Rank 450-800, never Hot or Warm.

2. HYPERNYM / META-WORD SUPPRESSION:
   - Overly broad meta-words (e.g., "object", "thing", "entity", "item", "concept", "stuff", "matter") must NOT receive high scores.
   - Cap any generic hypernym at Rank 400+ to prevent meta-gaming.

3. EXACT SYNONYM OVERRIDE:
   - If GUESS is an exact functional equivalent or direct synonym of TARGET (e.g., "huge" vs "gigantic", "couch" vs "sofa"):
     - Set "isSynonymWin": true
     - Set "rank": 2
     - Set "similarityPercentage": 99

4. DISTANCE TIER CALIBRATION:
   - Rank 1: Exact target word match.
   - Rank 2-20: Direct synonyms, immediate sub-types, or defining components (e.g. "dog" -> "canine", "hound", "leash").
   - Rank 21-100 (Hot): Same specific category or strong direct association (e.g. "dog" -> "bone", "bark", "veterinarian").
   - Rank 101-300 (Warm): Same general field or everyday environment (e.g. "dog" -> "park", "pet", "fur").
   - Rank 301-600 (Cool): Weak or distant conceptual connection (e.g. "dog" -> "mammal", "grass", "fence").
   - Rank 601-1000 (Ice): Unrelated or opposite concepts (e.g. "dog" -> "algebra", "satellite", "refrigerator").

5. LEARNING INSIGHT (max 10-12 words, no more):
   - State the conceptual relationship between GUESS and TARGET, not a generic distance comment.
   - If Hot/Warm/Scorching/Synonym: state the associative link (e.g. target "photosynthesis", guess "chlorophyll" -> "Crucial pigment used by plants to absorb light").
   - If Cool/Ice: state the domain divergence concisely (e.g. guess "car" -> "Mechanical vehicle; target belongs to biological processes").

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema exactly. No markdown code blocks, no preamble, no explanation.
{
  "rank": <integer 1-1000>,
  "similarityPercentage": <integer 0-100>,
  "isCorrect": false,
  "isSynonymWin": <boolean>,
  "learningInsight": "<concise 10-12 word conceptual relationship>"
}
`.trim();

  const parsed = await callAIProvider<{
    rank?: number;
    similarityPercentage?: number;
    isCorrect?: boolean;
    isSynonymWin?: boolean;
    learningInsight?: string;
  }>(prompt, "Guess");

  const isSynonymWin = Boolean(parsed.isSynonymWin);
  const rank = isSynonymWin
    ? 2
    : Math.min(1000, Math.max(1, Math.round(parsed.rank ?? 999)));
  const similarityPercentage = isSynonymWin
    ? 99
    : Math.min(100, Math.max(0, Math.round(parsed.similarityPercentage ?? 0)));
  const rawInsight = (parsed.learningInsight ?? "").trim();
  const insightWordCount = rawInsight ? rawInsight.split(/\s+/).length : 0;
  const learningInsight =
    rawInsight && insightWordCount <= 15 ? rawInsight : "No strong conceptual link detected.";
  const feedback = getFeedbackTier(rank, false, isSynonymWin);

  return { rank, similarityPercentage, isCorrect: false, isSynonymWin, feedback, learningInsight };
}
