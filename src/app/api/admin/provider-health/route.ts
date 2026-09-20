// ─────────────────────────────────────────────────────────────────────────────
//  app/api/admin/provider-health/route.ts
//  On-demand health check - deliberately NOT a background poller. Pinging
//  all 6 providers costs real API quota/latency, so this only runs when an
//  admin clicks "Run Health Check", and tests every configured tier
//  independently (unlike the live waterfall, which stops at first success).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { buildProviderTiers, ALL_PROVIDER_TIER_NAMES } from "@/lib/aiProvider";
import { recordTelemetry } from "@/lib/telemetry";

const PING_PROMPT = 'Return exactly this JSON object and nothing else: {"ok": true}';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const configuredTiers = buildProviderTiers(PING_PROMPT, "[contextle][Health]");
  const configuredNames = new Set(configuredTiers.map((t) => t.name));

  const results = await Promise.all(
    configuredTiers.map(async (tier) => {
      const startedAt = Date.now();
      try {
        await tier.run();
        const latencyMs = Date.now() - startedAt;
        recordTelemetry({ context: "Health", tier: tier.name, success: true, latencyMs });
        return { tier: tier.name, configured: true, ok: true, latencyMs };
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const message = error instanceof Error ? error.message : String(error);
        recordTelemetry({ context: "Health", tier: tier.name, success: false, latencyMs, error: message });
        return { tier: tier.name, configured: true, ok: false, latencyMs, error: message };
      }
    })
  );

  // Report unconfigured tiers too, so the matrix always shows all 6.
  for (const name of ALL_PROVIDER_TIER_NAMES) {
    if (!configuredNames.has(name)) {
      results.push({ tier: name, configured: false, ok: false, latencyMs: 0 });
    }
  }

  const tierOrder: string[] = Array.from(ALL_PROVIDER_TIER_NAMES);
  results.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));

  return NextResponse.json({ success: true, results });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed. Use POST to run a health check." }, { status: 405 });
}
