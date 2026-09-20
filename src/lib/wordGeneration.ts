// ─────────────────────────────────────────────────────────────────────────────
//  lib/wordGeneration.ts
//  Shared "Concept Detective" word/content generator - AI prompt + emergency
//  local fallback. Extracted so both /api/generate-word (solo) and
//  /api/multiplayer/create (battle rooms) can generate a fresh secret word
//  without duplicating the prompt or the fallback dataset selection.
// ─────────────────────────────────────────────────────────────────────────────

import { EASY_PAIRS, MEDIUM_PAIRS, HARD_PAIRS } from "@/lib/fallbackData";
import { callAIProvider } from "@/lib/aiProvider";
import type { GameCategory, GameContent } from "@/types/game";

export const VALID_CATEGORIES: GameCategory[] = ["foundations", "science", "finance", "advanced"];

const CATEGORY_BRIEFS: Record<GameCategory, string> = {
  foundations:
    "Everyday objects, places, or ideas a curious beginner already has words for (e.g. compass, harbor, gravity-as-a-word, market). Keep it concrete and approachable.",
  science:
    "A natural phenomenon, process, or scientific concept (biology, chemistry, physics, earth/space science) - e.g. photosynthesis, erosion, momentum, osmosis. Prefer a PROCESS or PHENOMENON over a plain physical object when possible.",
  finance:
    "A money, markets, or economics concept - e.g. inflation, dividend, liquidity, compound interest, supply and demand. Prefer an abstract financial mechanism over a physical object.",
  advanced:
    "A challenging, abstract, cross-domain concept suitable for an advanced learner - e.g. equilibrium, paradox, entropy, symmetry. Favor abstract nouns over concrete ones.",
};

// The prompt asks the model for an a-z-only word, but that's not enforced -
// escape it before building a RegExp so a stray metacharacter can't throw a
// SyntaxError and crash the caller.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactSecretWord(story: string, secretWord: string): string {
  const safeWord = escapeRegExp(secretWord);
  let redacted = story.replace(new RegExp(`\\b${safeWord}\\b`, "gi"), "___");
  redacted = redacted.replace(new RegExp(`\\b${safeWord}s\\b`, "gi"), "___s");
  redacted = redacted.replace(new RegExp(`\\b${safeWord}es\\b`, "gi"), "___es");
  redacted = redacted.replace(new RegExp(`\\b${safeWord}ing\\b`, "gi"), "___ing");
  redacted = redacted.replace(new RegExp(`\\b${safeWord}ed\\b`, "gi"), "___ed");
  return redacted;
}

export interface GeneratedWord extends GameContent {
  word: string;
}

function getFallbackContent(level: number, excludeWords: string[], category: GameCategory): GeneratedWord {
  let list = EASY_PAIRS;
  if (level >= 6 && level <= 15) {
    list = MEDIUM_PAIRS;
  } else if (level > 15) {
    list = HARD_PAIRS;
  }

  let filteredList = list.filter((pair) => !excludeWords.includes(pair.word));
  if (filteredList.length === 0) {
    filteredList = list;
  }

  const fallback = filteredList[Math.floor(Math.random() * filteredList.length)];
  const mysteryHook = fallback.stories[0] || "";
  const takeaways: [string, string, string] = [
    fallback.stories[0] || "",
    fallback.stories[1] || "",
    fallback.stories[2] || "",
  ];

  return { word: fallback.word, category, mysteryHook, stories: fallback.stories, takeaways };
}

// Generates one secret word/concept plus its mystery hook, 3 clue stories,
// and 3 post-win takeaways. Falls back to a local hand-authored pair if
// every AI provider tier is exhausted - never throws.
export async function generateGameContent(
  category: GameCategory,
  level: number,
  excludeWords: string[]
): Promise<GeneratedWord> {
  const prompt = `
Generate EXACTLY ONE secret CONCEPT and its supporting clues for a Level ${level} "Concept Detective" word guessing game.
Your concept choice and clue difficulty MUST strictly match the level guidelines below.

Category for this round: "${category}" - ${CATEGORY_BRIEFS[category]}

Requirements:
* Return ONLY valid raw JSON.
* Do NOT return markdown.
* Do NOT return explanations.
* Do NOT return code fences.
* The response must match this schema exactly:
{
  "word": "<secret_word>",
  "mysteryHook": "<one captivating detective-style teaser sentence that never mentions the word or its root letters>",
  "stories": [
    "<clue_1>",
    "<clue_2>",
    "<clue_3>"
  ],
  "takeaways": [
    "<fascinating fact 1, safe to reveal only after the word is solved>",
    "<fascinating fact 2>",
    "<fascinating fact 3>"
  ]
}

Rules:
* The word must be a single lowercase noun (it may name a process or phenomenon, e.g. "photosynthesis", "inflation").
* The word must contain only letters a-z.
* The word must be between 3 and 20 characters.
* The secret word MUST NOT be any of these previously solved words: [${excludeWords.map((w) => `"${w}"`).join(", ")}].
* The stories array must contain exactly 3 strings.
* The takeaways array must contain exactly 3 strings, each a short standalone learning fact about the concept (may name the word directly, since it is only shown after the player wins).
* Each story must be unique.
* Do not include the secret word in mysteryHook or in any story.
* Write natural, fluent English.
* Use correct spelling and grammar.
* Every story must start with a capital letter.
* Every story must end with punctuation.

Vocabulary Selection Bands:
* LEVELS 1-5: Very common everyday nouns (e.g. apple, chair, clock, garden).
* LEVELS 6-10: Common but less obvious nouns (e.g. harbor, glacier, artifact, compass).
* LEVELS 11-20: Educational, scientific, historical, geographical nouns (e.g. labyrinth, telescope, velocity, catalyst).
* LEVELS 21-35: Advanced concrete nouns (e.g. aqueduct, monastery, observatory, citadel).
* LEVELS 36-50: Difficult concrete nouns (e.g. parchment, reliquary, catacomb, obelisk).
* LEVELS 51-70: Advanced concrete nouns. Rare, university-level vocabulary. Avoid household objects, common animals, or common foods.
* LEVELS 71-90: Scientific and historical nouns. Not commonly used in daily speech.
* LEVELS 91+: Abstract concepts (e.g. serendipity, equilibrium, anomaly, paradox, symmetry).

Clue Difficulty and Strength Scaling:
* LEVELS 1-10: Clue 1 = direct, Clue 2 = moderate, Clue 3 = direct. Use direct descriptions, utility based, physical appearance.
* LEVELS 11-35: Clue 1 = indirect, Clue 2 = indirect, Clue 3 = moderate. Use atmospheric, indirect, contextual clues. Avoid naming associated objects. (Good clue: "Generations have relied upon it as a point of arrival after long and uncertain journeys.")
* LEVELS 36+: All 3 clues MUST be highly indirect. Use narrative, symbolic, historical, abstract, puzzle-like clues. Never reveal purpose, function, location, or obvious associations.

GLOBAL RULES:
* DO NOT reveal the answer.
* DO NOT reveal direct synonyms.
* DO NOT reveal obvious related objects.
* DO NOT reveal famous examples.
* DO NOT reveal defining characteristics.
* DO NOT create clues that instantly identify the answer.
* Generate clues appropriate to the requested level. Higher levels must produce significantly harder words and significantly more indirect clues.

Example of a Good indirect clue: "The passage of time has transformed it from a practical necessity into a symbol of another age." or "It stands as a silent witness to countless arrivals and departures."
Example of a Bad direct clue: "Ships arrive here." or "Fishermen unload their catch here."

Return JSON only.
`.trim();

  try {
    const parsed = await callAIProvider<{
      word: string;
      mysteryHook?: string;
      stories: string[];
      takeaways?: string[];
    }>(prompt, "WordGen");
    const cleanWord = parsed.word.trim().toLowerCase();

    // Redact AI word leaks instead of rejecting them (saves API quota)
    const stories = (parsed.stories || []).map((s: string) => redactSecretWord(s.trim(), cleanWord)).filter(Boolean);
    const mysteryHook = redactSecretWord((parsed.mysteryHook || stories[0] || "").trim(), cleanWord);
    const rawTakeaways = (parsed.takeaways || []).map((t) => t.trim()).filter(Boolean);
    const takeaways: [string, string, string] = [
      rawTakeaways[0] || stories[0] || "",
      rawTakeaways[1] || stories[1] || "",
      rawTakeaways[2] || stories[2] || "",
    ];

    return { word: cleanWord, category, mysteryHook, stories, takeaways };
  } catch (error) {
    console.warn("[contextle] All AI routes failed or keys missing. Using local emergency fallback.", error);
    return getFallbackContent(level, excludeWords, category);
  }
}
