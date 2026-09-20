// ─────────────────────────────────────────────────────────────────────────────
//  proxy.ts
//  (Renamed from middleware.ts - Next.js's `middleware` file convention is
//  deprecated in favor of `proxy`. Proxy defaults to the Node.js runtime,
//  unlike the deprecated Edge-runtime-only `middleware.ts`, which is what
//  makes the Node `crypto`-based admin session check below actually work.)
//
//  Refreshes Supabase auth session on every navigation to keep cookies fresh,
//  and gates /admin pages behind the admin session cookie.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/adminAuth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Gate every /admin page except the login page itself - API routes under
  // /api/admin/* do their own cookie check (see lib/adminAuth.ts) as well,
  // so this is a page-level UX redirect, not the only enforcement point.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT remove this getUser() call.
  // It refreshes the auth token if expired, keeping the session alive.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser favicon)
     * - public files with common extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
