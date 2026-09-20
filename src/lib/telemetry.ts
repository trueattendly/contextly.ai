// ─────────────────────────────────────────────────────────────────────────────
//  lib/telemetry.ts
//  In-memory AI provider call log - deliberately NOT persisted to a table.
//  Per the "zero DB migration" constraint on the admin dashboard, this is a
//  capped ring buffer scoped to a single serverless instance's lifetime: it
//  resets on cold start and isn't shared across concurrent instances/regions.
//  That's a real limitation, not a bug - a production-grade version of this
//  would ship spans to Sentry/Logtail/a real logs table, which is explicitly
//  out of scope here.
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  timestamp: number;
  context: "Guess" | "WordGen" | "Health";
  tier: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

const MAX_EVENTS = 200;
const events: TelemetryEvent[] = [];

export function recordTelemetry(event: Omit<TelemetryEvent, "timestamp">): void {
  events.unshift({ ...event, timestamp: Date.now() });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

export function getTelemetry(): TelemetryEvent[] {
  return events;
}

export function getTelemetrySummary() {
  const byTier = new Map<string, { attempts: number; failures: number; totalLatencyMs: number }>();
  for (const e of events) {
    const entry = byTier.get(e.tier) ?? { attempts: 0, failures: 0, totalLatencyMs: 0 };
    entry.attempts += 1;
    if (!e.success) entry.failures += 1;
    entry.totalLatencyMs += e.latencyMs;
    byTier.set(e.tier, entry);
  }
  return Array.from(byTier.entries()).map(([tier, s]) => ({
    tier,
    attempts: s.attempts,
    failures: s.failures,
    avgLatencyMs: s.attempts ? Math.round(s.totalLatencyMs / s.attempts) : 0,
  }));
}
