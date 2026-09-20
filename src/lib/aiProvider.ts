import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordTelemetry } from "@/lib/telemetry";

type LogContext = "WordGen" | "Guess" | "Health";

export interface ProviderTier {
  name: string;
  run: () => Promise<unknown>;
}

// Canonical tier order/names - used both by the live waterfall and by the
// admin dashboard's health check to know which tiers exist even when unconfigured.
export const ALL_PROVIDER_TIER_NAMES = [
  "Tier 1 Cerebras",
  "Tier 2 Groq",
  "Tier 3 SambaNova",
  "Tier 4 Gemini",
  "Tier 5 Mistral",
  "Tier 6 OpenRouter",
] as const;

const TIER_TIMEOUT_MS = 5000;

const JSON_SYSTEM_PROMPT =
  "You are an API. Return ONLY a valid raw JSON object matching the requested schema. Never return markdown blocks, explanations, or code fences.";

// Models occasionally wrap JSON in code fences or add a conversational
// preamble/epilogue despite instructions not to. Strip fences first, then
// fall back to slicing between the first `{` and last `}` before giving up.
function parseJsonLoose(rawText: string): unknown {
  const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error("Could not extract valid JSON from model response.");
  }
}

interface OpenAICompatSpec {
  name: string;
  apiKey: string;
  url: string;
  model: string;
}

// Shared by every OpenAI-chat-completions-compatible tier (Groq, SambaNova,
// Cerebras, Mistral, OpenRouter) - one attempt, one timeout, no retries: a
// 429/5xx/parse failure fails over to the next tier immediately instead of
// burning latency retrying a provider that's already down.
async function callOpenAICompatTier(spec: OpenAICompatSpec, prompt: string, logPrefix: string): Promise<unknown> {
  const response = await fetch(spec.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${spec.apiKey}` },
    body: JSON.stringify({
      model: spec.model,
      messages: [
        { role: "system", content: JSON_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      top_p: 0.1,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(TIER_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`${spec.name} API returned status ${response.status}`);
  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error(`${spec.name} API returned empty content.`);
  console.log(`${logPrefix} ${spec.name} raw response:`, rawText);
  return parseJsonLoose(rawText);
}

async function callGeminiTier(apiKey: string, prompt: string, logPrefix: string): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.0,
      topP: 0.1,
      responseMimeType: "application/json",
    },
    systemInstruction: `You are a JSON API.
Return only valid JSON.
Never return markdown.
Never return explanations.
Never return code fences.`,
  });

  const result = await model.generateContent(prompt, { timeout: TIER_TIMEOUT_MS });
  const rawText = result.response.text().trim();
  console.log(`${logPrefix} Gemini raw response:`, rawText);
  return parseJsonLoose(rawText);
}

// Builds the ordered list of tiers whose API key is actually configured.
// Shared by the live waterfall and the admin dashboard's on-demand health
// check, so both enumerate providers identically.
export function buildProviderTiers(prompt: string, logPrefix: string): ProviderTier[] {
  const tiers: ProviderTier[] = [];

  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (cerebrasKey) {
    tiers.push({
      name: "Tier 1 Cerebras",
      run: () => callOpenAICompatTier(
        { name: "Cerebras", apiKey: cerebrasKey, url: "https://api.cerebras.ai/v1/chat/completions", model: "llama-3.3-70b" },
        prompt,
        logPrefix
      ),
    });
  }

  const groqKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  if (groqKey) {
    tiers.push({
      name: "Tier 2 Groq",
      run: () => callOpenAICompatTier(
        { name: "Groq", apiKey: groqKey, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
        prompt,
        logPrefix
      ),
    });
  }

  const sambaNovaKey = process.env.SAMBANOVA_API_KEY;
  if (sambaNovaKey) {
    tiers.push({
      name: "Tier 3 SambaNova",
      run: () => callOpenAICompatTier(
        { name: "SambaNova", apiKey: sambaNovaKey, url: "https://api.sambanova.ai/v1/chat/completions", model: "Meta-Llama-3.1-70B-Instruct" },
        prompt,
        logPrefix
      ),
    });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    tiers.push({ name: "Tier 4 Gemini", run: () => callGeminiTier(geminiKey, prompt, logPrefix) });
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    tiers.push({
      name: "Tier 5 Mistral",
      run: () => callOpenAICompatTier(
        { name: "Mistral", apiKey: mistralKey, url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
        prompt,
        logPrefix
      ),
    });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    tiers.push({
      name: "Tier 6 OpenRouter",
      run: () => callOpenAICompatTier(
        { name: "OpenRouter", apiKey: openRouterKey, url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct" },
        prompt,
        logPrefix
      ),
    });
  }

  return tiers;
}

export async function callAIProvider<T>(prompt: string, context: LogContext): Promise<T> {
  const logPrefix = context === "WordGen" ? "[contextle]" : "[contextle][Guess]";
  const tiers = buildProviderTiers(prompt, logPrefix);

  for (const tier of tiers) {
    const startedAt = Date.now();
    try {
      console.log(`${logPrefix} ${tier.name}...`);
      const parsed = await tier.run();
      console.log(`${logPrefix} ${tier.name} parsed JSON:`, parsed);
      recordTelemetry({ context, tier: tier.name, success: true, latencyMs: Date.now() - startedAt });
      return parsed as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${logPrefix} ${tier.name} failed, failing over.`, message);
      recordTelemetry({ context, tier: tier.name, success: false, latencyMs: Date.now() - startedAt, error: message });
    }
  }

  throw new Error("All AI providers exhausted.");
}
