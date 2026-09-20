// ─────────────────────────────────────────────────────────────────────────────
//  lib/adminAuth.ts
//  Minimal signed-cookie admin session - no new dependency (no jsonwebtoken/
//  jose), no database table. Login is a username+password check against
//  ADMIN_USERNAME/ADMIN_PASSWORD; the session cookie is then an HMAC-SHA256
//  signature (keyed by the separate ADMIN_SECRET_KEY) over a JSON payload
//  containing only an expiry timestamp, verified with a timing-safe compare.
//  This is intentionally simple: a single shared admin login, not a
//  multi-user auth system.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "contextle_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// The token-signing secret is independent of the login credentials, so
// rotating the login password doesn't invalidate the signing scheme.
function getSigningSecret(): string | null {
  return process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD || null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Timing-safe compare that tolerates different-length inputs without an
// early-return length check (which would otherwise leak length via timing).
function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  const maxLen = Math.max(aBuf.length, bBuf.length, 1);
  const aPadded = Buffer.concat([aBuf], maxLen);
  const bPadded = Buffer.concat([bBuf], maxLen);
  return timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword || !username || !password) return false;
  const usernameOk = timingSafeStringEqual(username, expectedUsername);
  const passwordOk = timingSafeStringEqual(password, expectedPassword);
  return usernameOk && passwordOk;
}

export function createAdminSessionToken(): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  const secret = getSigningSecret();
  if (!secret || !token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expected = sign(encodedPayload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export const ADMIN_SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

// Shared guard for every /api/admin/* route handler (route-level check -
// belt-and-braces alongside the middleware page redirect).
export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}
