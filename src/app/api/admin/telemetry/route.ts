import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getTelemetry, getTelemetrySummary } from "@/lib/telemetry";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ success: true, events: getTelemetry(), summary: getTelemetrySummary() });
}
